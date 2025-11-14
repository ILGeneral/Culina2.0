import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import fetch from "node-fetch";
import {onCall, CallableContext} from "firebase-functions/v1/https";
import {onDocumentDeleted} from "firebase-functions/v2/firestore";

admin.initializeApp();
const db = admin.firestore();

/**
 * Helper function to load user preferences and inventory.
 * @param {string} uid - The user ID.
 * @return {Promise<object>} User preferences and inventory.
 */
async function getUserContext(uid: string) {
  const userDoc = await db.collection("users").doc(uid).get();
  if (!userDoc.exists) {
    throw new functions.https.HttpsError("not-found", "User not found");
  }

  const preferences = userDoc.get("preferences") || {};
  const invSnap = await db
    .collection("users")
    .doc(uid)
    .collection("ingredients")
    .get();
  const inventory = invSnap.docs.map((d) => ({
    id: d.id,
    ...d.data(),
  }));

  return {preferences, inventory};
}

/**
 * Generates a recipe using the Groq API based on user inventory and prefs.
 * @param {object} data - The data passed to the function.
 * @param {CallableContext} context - The context of the function call.
 * @return {Promise<{recipe: object}>} The generated recipe.
 */
export const generateRecipe = onCall(
  async (data: {model?: string}, context: CallableContext) => {
    const uid = context.auth?.uid;
    if (!uid) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "Login required"
      );
    }

    const {preferences, inventory} = await getUserContext(uid);
    const diet = preferences?.diet;
    const religion = preferences?.religion;
    const caloriePlan = preferences?.caloriePlan;
    const prompt = `
You are a culinary assistant.
Create at least FIVE different recipes that use ONLY ingredients from the
user's inventory.
Honor dietary preference: ${diet}, religious preference: ${religion},
calorie goal: ${caloriePlan}.
Return strict JSON:
{
  "recipes": [
    {
      "title": "string",
      "description": "string",
      "ingredients": ["string"],
      "instructions": ["string"],
      "servings": number,
      "estimatedCalories": number
    }
  ]
}
Inventory:
${JSON.stringify(inventory, null, 2)}
    `.trim();

    const GROQ_API_KEY = functions.config().groq?.key;
    const model = data?.model || "llama3-70b-8192";

    const resp = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${GROQ_API_KEY?.trim()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages: [{role: "user", content: prompt}],
          temperature: 0.4,
          response_format: {type: "json_object"},
        }),
      }
    );

    if (!resp.ok) {
      throw new functions.https.HttpsError(
        "internal",
        "Groq request failed"
      );
    }

    interface GroqResponse {
      choices?: {message?: {content?: string}}[];
    }
    const json = (await resp.json()) as GroqResponse;
    const content = json?.choices?.[0]?.message?.content ?? "";

    interface GroqPayload {
      recipes?: unknown;
    }

    let recipes: unknown;
    try {
      const parsed = JSON.parse(content) as GroqPayload;
      recipes = parsed.recipes;
    } catch {
      throw new functions.https.HttpsError(
        "data-loss",
        "Model did not return valid JSON"
      );
    }

    if (!Array.isArray(recipes) || recipes.length < 5) {
      throw new functions.https.HttpsError(
        "data-loss",
        "Model returned fewer than five recipes"
      );
    }

    return {recipes};
  }
);

/**
 * Confirms a recipe has been cooked and deducts ingredients.
 * @param {object} data - Must contain 'recipeId'.
 * @param {CallableContext} context - The context of the function call.
 * @return {Promise<{ok: boolean}>} A success object.
 */
export const confirmRecipeUse = onCall(
  async (data: {recipeId: string}, context: CallableContext) => {
    const uid = context.auth?.uid;
    if (!uid) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "Login required"
      );
    }

    const {recipeId} = data;
    const recipeRef = db.collection("recipes").doc(recipeId);
    const invCol = db.collection("users").doc(uid).collection("ingredients");

    await db.runTransaction(async (tx) => {
      const recSnap = await tx.get(recipeRef);
      if (!recSnap.exists) {
        throw new functions.https.HttpsError(
          "not-found",
          "Recipe not found"
        );
      }

      if (recSnap.get("ownerId") !== uid) {
        throw new functions.https.HttpsError(
          "permission-denied",
          "Not the owner of this recipe"
        );
      }

      const ingredients = recSnap.get("ingredients") || [];
      const invSnap = await invCol.get();

      const byName = new Map<string, {
        ref: admin.firestore.DocumentReference;
        data: admin.firestore.DocumentData
      }>(
        invSnap.docs.map((d) => [
          d.get("name").toLowerCase(),
          {ref: d.ref, data: d.data()},
        ])
      );

      // Verify and deduct
      for (const ing of ingredients) {
        const ingName = ing.name?.toLowerCase() || ing.toLowerCase();
        const inv = byName.get(ingName);
        if (!inv) {
          throw new functions.https.HttpsError(
            "failed-precondition",
            `Missing ${ing.name || ing}`
          );
        }

        const qtyNeeded = typeof ing === "string" ? 1 : (ing.qty || 1);
        if (inv.data.quantity < qtyNeeded) {
          throw new functions.https.HttpsError(
            "failed-precondition",
            `Not enough ${ing.name || ing}`
          );
        }

        tx.update(inv.ref, {
          quantity: Math.max(0, inv.data.quantity - qtyNeeded),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }
    });

    return {ok: true};
  }
);

/**
 * Rates a recipe on a scale of 1-5.
 * @param {object} data - Must contain 'recipeId' and 'score'.
 * @param {CallableContext} context - The context of the function call.
 * @return {Promise<{ok: boolean}>} A success object.
 */
export const rateRecipe = onCall(
  async (
    data: {recipeId: string; score: number},
    context: CallableContext
  ) => {
    const uid = context.auth?.uid;
    if (!uid) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "Login required"
      );
    }

    const {recipeId, score} = data;
    if (![1, 2, 3, 4, 5].includes(score)) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Score must be 1–5"
      );
    }

    const recipeRef = db.collection("recipes").doc(recipeId);
    const ratingRef = recipeRef.collection("ratings").doc(uid);

    await db.runTransaction(async (tx) => {
      const rec = await tx.get(recipeRef);
      if (!rec.exists) {
        throw new functions.https.HttpsError(
          "not-found",
          "Recipe not found"
        );
      }
      if (rec.get("ownerId") === uid) {
        throw new functions.https.HttpsError(
          "failed-precondition",
          "Cannot rate your own recipe"
        );
      }

      const curr = await tx.get(ratingRef);
      if (curr.exists) {
        tx.update(ratingRef, {
          score,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      } else {
        tx.set(ratingRef, {
          score,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }

      const ratingsSnap = await recipeRef.collection("ratings").get();
      const scores = ratingsSnap.docs.map((d) => d.get("score"));
      const count = scores.length;
      const avg = count ? scores.reduce((a, b) => a + b, 0) / count : 0;

      tx.update(recipeRef, {ratings: {count, avg}});
    });

    return {ok: true};
  }
);

/**
 * Submits a user report or feedback.
 * @param {object} data - Report data including type and description.
 * @param {CallableContext} context - The context of the function call.
 * @return {Promise<object>} A success object with the report ID.
 */
export const submitReport = onCall(
  async (data: Record<string, unknown>, context: CallableContext) => {
    const uid = context?.auth?.uid;
    if (!uid) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "Login required"
      );
    }

    const type = data?.type ?? null;
    const description = data?.description ?? null;
    const appVersion = data?.appVersion ?? "unknown";
    const device = data?.device ?? "unknown";

    if (!type || !description) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Missing required fields: 'type' and/or 'description'."
      );
    }

    try {
      const doc = await db.collection("reports").add({
        reporterId: uid,
        type,
        description,
        appVersion,
        device,
        emailSent: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      return {
        success: true,
        message: "Report successfully submitted.",
        reportId: doc.id,
      };
    } catch (error) {
      throw new functions.https.HttpsError(
        "internal",
        "Failed to submit report. Please try again later."
      );
    }
  }
);

/**
 * Updates a shared recipe while maintaining data integrity.
 * @param {object} data - Must contain 'sharedRecipeId' and update fields.
 * @param {CallableContext} context - The context of the function call.
 * @return {Promise<{success: boolean}>} A success object.
 */
export const updateSharedRecipe = onCall(
  async (
    data: {
      sharedRecipeId: string;
      title?: string;
      description?: string;
      ingredients?: (string | {name: string; qty?: string})[];
      instructions?: string[];
      servings?: number;
      estimatedCalories?: number;
      prepTime?: string;
      cookTime?: string;
      difficulty?: "Easy" | "Medium" | "Hard";
      cuisine?: string;
      tags?: string[];
      imageUrl?: string;
    },
    context: CallableContext
  ) => {
    const uid = context.auth?.uid;
    if (!uid) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "Login required"
      );
    }

    const {sharedRecipeId, ...updateFields} = data;

    if (!sharedRecipeId) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "sharedRecipeId is required"
      );
    }

    // Remove undefined fields
    const cleanedFields = Object.fromEntries(
      Object.entries(updateFields).filter(([, value]) => value !== undefined)
    );

    if (Object.keys(cleanedFields).length === 0) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "No fields to update"
      );
    }

    const sharedRecipeRef = db.collection("sharedRecipes").doc(sharedRecipeId);

    try {
      await db.runTransaction(async (tx) => {
        const doc = await tx.get(sharedRecipeRef);

        if (!doc.exists) {
          throw new functions.https.HttpsError(
            "not-found",
            "Shared recipe not found"
          );
        }

        // Verify ownership
        if (doc.get("userId") !== uid) {
          throw new functions.https.HttpsError(
            "permission-denied",
            "You can only edit your own shared recipes"
          );
        }

        // Add updatedAt timestamp
        const updateData = {
          ...cleanedFields,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        };

        tx.update(sharedRecipeRef, updateData);
      });

      return {success: true};
    } catch (error) {
      if (error instanceof functions.https.HttpsError) {
        throw error;
      }
      throw new functions.https.HttpsError(
        "internal",
        "Failed to update shared recipe"
      );
    }
  }
);

/**
 * Simple test endpoint to verify backend is running.
 */
export const helloTest = functions.https.onRequest((req, res) => {
  res.send("Culina backend is alive!");
});

/**
 * Cloud Function trigger: Cascade delete shared recipes when user deletes
 * original recipe.
 * This prevents orphaned shared recipes in the community feed.
 * Triggers on: users/{userId}/recipes/{recipeId} deletion
 */
export const onRecipeDeleted = onDocumentDeleted(
  "users/{userId}/recipes/{recipeId}",
  async (event) => {
    const userId = event.params.userId;
    const recipeId = event.params.recipeId;

    try {
      // Find all shared recipes that reference this deleted recipe
      const sharedRecipesQuery = await db
        .collection("sharedRecipes")
        .where("userId", "==", userId)
        .where("userRecipeId", "==", recipeId)
        .get();

      // If no shared recipes found, exit early
      if (sharedRecipesQuery.empty) {
        console.log(
          `No shared recipes found for userId: ${userId}, recipeId: ${recipeId}`
        );
        return null;
      }

      // Use batch delete for efficiency (max 500 per batch)
      const batch = db.batch();
      let deleteCount = 0;

      for (const doc of sharedRecipesQuery.docs) {
        // Delete the shared recipe document
        batch.delete(doc.ref);
        deleteCount++;

        // Note: Firestore automatically handles subcollection cleanup
        // based on your retention policies, or you can manually delete
        // comments and ratings subcollections if needed
      }

      // Commit the batch delete
      await batch.commit();

      console.log(
        `Successfully deleted ${deleteCount} shared recipe(s) ` +
        `for userId: ${userId}, recipeId: ${recipeId}`
      );

      return null;
    } catch (error) {
      console.error(
        `Error deleting shared recipes for userId: ${userId}, ` +
        `recipeId: ${recipeId}`,
        error
      );
      // Don't throw error - allow the original delete to succeed
      return null;
    }
  }
);

/**
 * Cloud Function trigger: Cascade delete subcollections when a shared recipe
 * is deleted.
 * This cleans up comments and ratings when a user unshares a recipe.
 * Triggers on: sharedRecipes/{recipeId} deletion
 */
export const onSharedRecipeDeleted = onDocumentDeleted(
  "sharedRecipes/{recipeId}",
  async (event) => {
    const recipeId = event.params.recipeId;

    try {
      const batch = db.batch();
      let deleteCount = 0;

      // Delete all comments for this shared recipe
      const commentsQuery = await db
        .collection("sharedRecipes")
        .doc(recipeId)
        .collection("comments")
        .get();

      for (const doc of commentsQuery.docs) {
        batch.delete(doc.ref);
        deleteCount++;
      }

      // Delete all ratings (subcollection) for this shared recipe
      const ratingsQuery = await db
        .collection("sharedRecipes")
        .doc(recipeId)
        .collection("ratings")
        .get();

      for (const doc of ratingsQuery.docs) {
        batch.delete(doc.ref);
        deleteCount++;
      }

      // Delete any top-level ratings that reference this recipe
      const topLevelRatingsQuery = await db
        .collection("ratings")
        .where("sharedRecipeId", "==", recipeId)
        .get();

      for (const doc of topLevelRatingsQuery.docs) {
        batch.delete(doc.ref);
        deleteCount++;
      }

      // Commit all deletes
      if (deleteCount > 0) {
        await batch.commit();
        console.log(
          `Successfully deleted ${deleteCount} subcollection ` +
          `document(s) for sharedRecipeId: ${recipeId}`
        );
      }

      return null;
    } catch (error) {
      console.error(
        `Error deleting subcollections for sharedRecipeId: ${recipeId}`,
        error
      );
      return null;
    }
  }
);
