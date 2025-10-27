import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import fetch from "node-fetch";
import {onCall, CallableContext} from "firebase-functions/v1/https";

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
Create at least FIVE different recipes that use ONLY ingredients from the user's inventory.
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
 * Simple test endpoint to verify backend is running.
 */
export const helloTest = functions.https.onRequest((req, res) => {
  res.send("Culina backend is alive!");
});
