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

  if (typeof body?.targetIngredient !== 'string' || !body.targetIngredient.trim()) {
    errors.push('targetIngredient is required');
  }

  if (!Array.isArray(body?.inventory)) {
    errors.push('inventory must be an array');
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

  // Apply rate limiting
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
    // Verify authentication
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
      targetIngredient,
      inventory,
      model,
    } = body;

    const userInventory = await getUserInventory(uid);
    const inventorySnapshot = inventory.length ? inventory : userInventory;

    // Extract just the ingredient names from inventory for cleaner prompt
    const availableIngredientNames = inventorySnapshot
      .map(item => item.name || item)
      .filter(Boolean);

    // Define ingredient categories that can have external suggestions
    const EXCEPTION_CATEGORIES = {
      baking: {
        keywords: ['flour', 'bread flour', 'cake flour', 'all-purpose flour', 'self-rising flour',
                   'pastry flour', 'whole wheat flour', 'almond flour', 'coconut flour',
                   'baking powder', 'baking soda', 'yeast', 'cornstarch', 'tapioca'],
        description: 'Baking ingredients (flours, leavening agents, starches)'
      },
      spices: {
        keywords: ['cumin', 'coriander', 'paprika', 'turmeric', 'cinnamon', 'nutmeg',
                   'ginger', 'cardamom', 'cloves', 'allspice', 'cayenne', 'chili powder',
                   'curry powder', 'oregano', 'basil', 'thyme', 'rosemary', 'sage',
                   'bay leaf', 'fennel', 'anise', 'saffron', 'vanilla', 'extract'],
        description: 'Spices, herbs, and seasonings'
      },
      specialty: {
        keywords: ['miso', 'tahini', 'harissa', 'gochujang', 'fish sauce', 'oyster sauce',
                   'worcestershire', 'sriracha', 'vinegar', 'rice wine', 'mirin',
                   'sesame oil', 'truffle oil', 'coconut milk', 'condensed milk'],
        description: 'Specialty and ethnic ingredients'
      }
    };

    // Check if target ingredient falls into exception categories
    const targetLower = targetIngredient.toLowerCase();
    let allowExternalSuggestions = false;
    let matchedCategory = null;

    for (const [category, config] of Object.entries(EXCEPTION_CATEGORIES)) {
      if (config.keywords.some(keyword => targetLower.includes(keyword) || keyword.includes(targetLower))) {
        allowExternalSuggestions = true;
        matchedCategory = config.description;
        break;
      }
    }

    const inventoryConstraint = allowExternalSuggestions
      ? `Available Inventory (preferred): ${JSON.stringify(availableIngredientNames, null, 2)}

SPECIAL EXCEPTION: The target ingredient "${targetIngredient}" is categorized as "${matchedCategory}".
You MAY suggest common alternatives that are NOT in the inventory if they are:
1. Commonly available in most kitchens or stores
2. Essential for the recipe's success
3. Have similar properties to the target ingredient

However, PREFER inventory items when suitable alternatives exist.`
      : `Available Inventory (REQUIRED): ${JSON.stringify(availableIngredientNames, null, 2)}

STRICT CONSTRAINT: ONLY suggest ingredients from the Available Inventory list above.
The target ingredient "${targetIngredient}" does NOT qualify for external suggestions.`;

    const prompt = `
You are a culinary expert specializing in ingredient substitutions. The user wants to cook "${recipeTitle}" but needs a substitute for: "${targetIngredient}".

Your task: Suggest 1-3 suitable alternative ingredients that would work well in this recipe context.

RULES:
1. Consider flavor profiles, cooking properties, and nutritional similarity
2. Be practical - suggest substitutes that make culinary sense for this recipe
3. Provide clear reasoning for each suggestion
4. If no good substitutes can be found, return an empty suggestions array
5. Common pantry staples (salt, pepper, oil, water, sugar) can be suggested even if not listed

${inventoryConstraint}

Return strict JSON in this exact format:
{
  "targetIngredient": "${targetIngredient}",
  "suggestions": [
    {
      "ingredient": "substitute ingredient name",
      "reason": "brief explanation why this substitute works",
      "inInventory": true or false
    }
  ]
}

Recipe Title: ${recipeTitle}
Recipe Description: ${recipeDescription || 'N/A'}
Target Ingredient to Replace: ${targetIngredient}
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
        temperature: 0.7,
        max_tokens: 1500,
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

    if (!parsed?.targetIngredient || !Array.isArray(parsed?.suggestions)) {
      console.error('Invalid response structure:', parsed);
      throw new Error('AI model did not return valid response structure');
    }

    // Sanitize and validate the response
    const sanitizedSuggestions = parsed.suggestions
      .filter((sug) =>
        sug &&
        typeof sug.ingredient === 'string' &&
        typeof sug.reason === 'string' &&
        typeof sug.inInventory === 'boolean'
      )
      .map((sug) => ({
        ingredient: sug.ingredient,
        reason: sug.reason,
        inInventory: sug.inInventory,
      }));

    return res.status(200).json({
      targetIngredient: parsed.targetIngredient,
      suggestions: sanitizedSuggestions,
      hasResults: sanitizedSuggestions.length > 0
    });
  } catch (error) {
    console.error('Suggest ingredient substitutes error:', error);
    return res.status(500).json({
      error: error.message || 'Failed to suggest ingredient substitutes'
    });
  }
};