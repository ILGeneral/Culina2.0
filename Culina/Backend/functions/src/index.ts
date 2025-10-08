import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import fetch from "node-fetch";
import { onCall, CallableContext } from "firebase-functions/v1/https";
admin.initializeApp();
const db = admin.firestore();

/* Helper: load user prefs + inventory */
async function getUserContext(uid: string) {
  const userDoc = await db.collection("users").doc(uid).get();
  if (!userDoc.exists) {
    throw new functions.https.HttpsError("not-found", "User not found");
  }

  const preferences = userDoc.get("preferences") || {};
  const invSnap = await db
    .collection("users")
    .doc(uid)
    .collection("inventory")
    .get();
  const inventory = invSnap.docs.map((d) => ({
    id: d.id,
    ...d.data(),
  }));

  return { preferences, inventory };
}

/* 1️⃣ Generate Recipe (Groq API) */
export const generateRecipe = onCall(
  async (data: any, context: CallableContext) => {
    const uid = context.auth?.uid;
    if (!uid) {
      throw new functions.https.HttpsError("unauthenticated", "Login required");
    }

    const { preferences, inventory } = await getUserContext(uid);
    const prompt = `
You are a culinary assistant. Create ONE recipe that uses ONLY ingredients from the user's inventory.
Honor dietary preference: ${preferences?.diet}, religious preference: ${preferences?.religion}, calorie goal: ${preferences?.caloriePlan}.
Return strict JSON:
{
  "title": string,
  "shortDesc": string,
  "servings": number,
  "estKcal": number,
  "ingredients": [{"name":string,"qty":number,"unit":string,"kcal":number}],
  "steps": [string]
}
Inventory:
${JSON.stringify(inventory, null, 2)}
    `.trim();

    const GROQ_API_KEY = functions.config().groq?.key;
    const model = data?.model || "llama3-70b-8192";

    const resp = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.4,
      }),
    });

    if (!resp.ok) {
      throw new functions.https.HttpsError("internal", "Groq request failed");
    }

    const json = (await resp.json()) as any;
    const content = json?.choices?.[0]?.message?.content ?? "";

    let recipe: any;
    try {
      recipe = JSON.parse(content);
    } catch {
      throw new functions.https.HttpsError(
        "data-loss",
        "Model did not return valid JSON"
      );
    }

    const docRef = await db.collection("recipes").add({
      ownerId: uid,
      ...recipe,
      source: "AI",
      visibility: "private",
      editedByUser: false,
      tags: [],
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return { recipeId: docRef.id, recipe };
  }
);

/* 2️⃣ Confirm Recipe Use */
export const confirmRecipeUse = onCall(
  async (data: any, context: CallableContext) => {
    const uid = context.auth?.uid;
    if (!uid) {
      throw new functions.https.HttpsError("unauthenticated", "Login required");
    }

    const { recipeId } = data as { recipeId: string };
    const recipeRef = db.collection("recipes").doc(recipeId);
    const invCol = db.collection("users").doc(uid).collection("inventory");

    await db.runTransaction(async (tx) => {
      const recSnap = await tx.get(recipeRef);
      if (!recSnap.exists) {
        throw new functions.https.HttpsError("not-found", "Recipe not found");
      }

      if (recSnap.get("ownerId") !== uid) {
        throw new functions.https.HttpsError(
          "permission-denied",
          "Not the owner of this recipe"
        );
      }

      const ingredients = recSnap.get("ingredients") || [];
      const invSnap = await invCol.get();
      const byName = new Map(
        invSnap.docs.map((d) => [
          d.get("name").toLowerCase(),
          { ref: d.ref, data: d.data() },
        ])
      );

      // Verify and deduct
      for (const ing of ingredients) {
        const inv = byName.get(ing.name.toLowerCase());
        if (!inv) {
          throw new functions.https.HttpsError(
            "failed-precondition",
            `Missing ${ing.name}`
          );
        }
        if (inv.data.quantity < ing.qty || inv.data.unit !== ing.unit) {
          throw new functions.https.HttpsError(
            "failed-precondition",
            `Not enough ${ing.name} or unit mismatch`
          );
        }

        tx.update(inv.ref, {
          quantity: Math.max(0, inv.data.quantity - ing.qty),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }
    });

    return { ok: true };
  }
);

/* 3️⃣ Rate Recipe */
export const rateRecipe = onCall(
  async (data: any, context: CallableContext) => {
    const uid = context.auth?.uid;
    if (!uid) {
      throw new functions.https.HttpsError("unauthenticated", "Login required");
    }

    const { recipeId, score } = data as { recipeId: string; score: number };
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
        throw new functions.https.HttpsError("not-found", "Recipe not found");
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

      tx.update(recipeRef, { ratings: { count, avg } });
    });

    return { ok: true };
  }
);

/* 4️⃣ Submit Report */
export const submitReport = onCall(
  async (data: any, context: CallableContext) => {
    const uid = context.auth?.uid;
    if (!uid) {
      throw new functions.https.HttpsError("unauthenticated", "Login required");
    }

    const { type, description, appVersion, device } = data as {
      type: string;
      description: string;
      appVersion?: string;
      device?: string;
    };

    const doc = await db.collection("reports").add({
      reporterId: uid,
      type,
      description,
      appVersion,
      device,
      emailSent: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return { reportId: doc.id };
  }
);

/* 5️⃣ Simple test endpoint */
export const helloTest = functions.https.onRequest((req, res) => {
  res.send("✅ Culina backend is alive!");
});
