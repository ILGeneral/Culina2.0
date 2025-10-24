import admin from 'firebase-admin';
import { recipeGenLimiter } from '../lib/rate-limiter.js';

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

const db = admin.firestore();

async function getUserInventory(uid) {
  const snapshot = await db.collection('users').doc(uid).collection('inventory').get();
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

function validateBody(body) {
  const errors = [];
  if (typeof body?.recipeTitle !== 'string' || !body.recipeTitle.trim()) {
    errors.push('recipeTitle is required');
  }

  if (!Array.isArray(body?.recipeIngredients) || !body.recipeIngredients.length) {
    errors.push('recipeIngredients must be a non-empty array');
  }

  if (!Array.isArray(body?.missingIngredients) || !body.missingIngredients.length) {
    errors.push('missingIngredients must be a non-empty array');
  }

  if (body?.missingIngredients?.length > 2) {
    errors.push('missingIngredients length must be 1 or 2');
  }

  if (!Array.isArray(body?.inventory) || !body.inventory.length) {
    errors.push('inventory must be a non-empty array');
  }

  return errors;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // ✅ STEP 1: Apply rate limiting
  try {
    await new Promise((resolve, reject) => {
      recipeGenLimiter(req, res, (result) => {
        if (result instanceof Error) {
          return reject(result);
        }
        resolve(result);
      });
    });
  } catch (rateLimitError) {
    return;
  }

  try {
    // ✅ STEP 2: Verify authentication
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized - No token provided' });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await admin.auth().verifyIdToken(token);
    const uid = decodedToken.uid;

    const body = req.body ?? {};
    const validationErrors = validateBody(body);
    if (validationErrors.length) {
      return res.status(400).json({ error: validationErrors.join(', ') });
    }

    const {
      recipeTitle,
      recipeDescription,
      recipeIngredients,
      missingIngredients,
      inventory,
      model,
    } = body;

    const userInventory = await getUserInventory(uid);
    const inventorySnapshot = inventory.length ? inventory : userInventory;

    const prompt = `
You are a culinary assistant. The user wants to cook a recipe titled "${recipeTitle}" but is missing up to two ingredients. Provide up to two alternative recipes that avoid the missing ingredients while staying close in style or flavor profile. Use ONLY ingredients available from the inventory provided. Include simple pantry staples such as salt, pepper, water, or oil if necessary.

Return strict JSON in this format:
{
  "alternatives": [
    {
      "title": "Recipe name",
      "description": "Short description",
      "ingredients": ["Ingredient as string"],
      "instructions": ["Step as string"]
    }
  ]
}

Original recipe description (may be empty): ${recipeDescription ?? 'N/A'}
Original recipe ingredients: ${JSON.stringify(recipeIngredients, null, 2)}
Missing ingredients: ${JSON.stringify(missingIngredients, null, 2)}
Available inventory: ${JSON.stringify(inventorySnapshot, null, 2)}
`.trim();

    const fetch = (await import('node-fetch')).default;

    const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: model || 'llama-3.1-8b-instant',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.6,
        max_tokens: 2000,
        response_format: { type: 'json_object' },
      }),
    });

    if (!groqResponse.ok) {
      const errorText = await groqResponse.text();
      console.error('Groq API error:', errorText);
      throw new Error('Groq request failed');
    }

    const json = await groqResponse.json();
    const content = json?.choices?.[0]?.message?.content ?? '';

    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch (error) {
      console.error('Groq JSON parse error:', error);
      console.error('Content that failed to parse:', content);
      throw new Error('Invalid JSON response from AI model');
    }

    if (!Array.isArray(parsed?.alternatives) || !parsed.alternatives.length) {
      console.error('Invalid alternatives structure:', parsed);
      throw new Error('AI model did not return alternatives array');
    }

    const sanitizedAlternatives = parsed.alternatives
      .filter((alt) =>
        alt && typeof alt.title === 'string' && Array.isArray(alt.ingredients) && Array.isArray(alt.instructions)
      )
      .map((alt) => ({
        title: alt.title,
        description: typeof alt.description === 'string' ? alt.description : '',
        ingredients: alt.ingredients,
        instructions: alt.instructions,
      }));

    if (!sanitizedAlternatives.length) {
      throw new Error('AI model did not provide valid alternatives');
    }

    return res.status(200).json({ alternatives: sanitizedAlternatives });
  } catch (error) {
    console.error('Suggest alternatives error:', error);
    return res.status(500).json({ error: error.message || 'Failed to suggest alternatives' });
  }
};
