const admin = require('firebase-admin');

// Initialize Firebase Admin (only once)
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

async function getUserContext(uid) {
  const userDoc = await db.collection('users').doc(uid).get();
  if (!userDoc.exists) {
    throw new Error('User not found');
  }

  const preferences = userDoc.get('preferences') || {};
  const invSnap = await db
    .collection('users')
    .doc(uid)
    .collection('ingredients')
    .get();

  const inventory = invSnap.docs.map((d) => ({
    id: d.id,
    ...d.data(),
  }));

  return { preferences, inventory };
}

module.exports = async (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Verify Firebase auth token
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized - No token provided' });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await admin.auth().verifyIdToken(token);
    const uid = decodedToken.uid;

    console.log('User authenticated:', uid);

    // Gather user data
    const { preferences, inventory } = await getUserContext(uid);
    const diet = preferences?.diet || 'none';
    const religion = preferences?.religion || preferences?.religiousPreference || 'none';
    const caloriePlan = preferences?.caloriePlan || 'none';
    const allergies = preferences?.allergies || [];

    const model = req.body?.model || 'llama-3.1-8b-instant';

    // Log the preferences being used
    console.log('User preferences:', {
      diet,
      religion,
      caloriePlan,
      allergies: allergies.length > 0 ? allergies : 'none'
    });

    // Improved prompt with stricter formatting requirements
    const allergyText = allergies.length > 0 ? allergies.join(', ') : 'none';
    
    // Extract just ingredient names for clearer prompt
    const availableIngredients = inventory.map(item => item.name || item.ingredient).filter(Boolean);
    
    const prompt = `
You are a culinary assistant. Create EXACTLY 5 different and varied recipes.

CRITICAL INVENTORY CONSTRAINT:
You can ONLY use these ingredients (nothing else):
${availableIngredients.map(ing => `- ${ing}`).join('\n')}

DO NOT include ANY ingredients not in this list above. Every ingredient in your recipes MUST come from this list.

ADDITIONAL REQUIREMENTS:
- Each recipe MUST be significantly different from the others
${diet !== 'none' ? `- MUST follow dietary restriction: ${diet} (strictly enforce - e.g., vegan means NO animal products)` : '- No specific dietary restrictions'}
${religion !== 'none' && religion !== '' ? `- MUST follow religious dietary law: ${religion} (strictly enforce)` : '- No religious dietary restrictions'}
${caloriePlan !== 'none' ? `- Target calorie goal per day: ${caloriePlan} calories` : '- No specific calorie restrictions'}
${allergies.length > 0 ? `- STRICTLY AVOID these allergens: ${allergyText} (do NOT include in any form)` : '- No known allergies'}
- Return EXACTLY 5 recipes, no more, no less

Return ONLY valid JSON in this EXACT format (no additional text). 
Every ingredient must be an object with separate fields: name as a string, quantity as a number, 
and unit as a string or null if not applicable:
{
  "recipes": [
    {
      "title": "Recipe Name Here",
      "description": "Brief description of the dish",
      "ingredients": [
        {
          "name": "Ingredient name",
          "quantity": 1.5,
          "unit": "cups"
        }
      ],
      "instructions": ["Step 1", "Step 2", "Step 3"],
      "servings": 2,
      "estimatedCalories": 450
    }
  ]
}

REMINDER: Every single ingredient in your recipes must be from the available ingredients list shown above.
`.trim();

    const fetch = (await import('node-fetch')).default;

    const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7, // Increased for more variety
        max_tokens: 4000, // Ensure enough tokens for 5 recipes
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

    console.log('Raw Groq response:', content.substring(0, 500));

    let parsedData;
    try {
      parsedData = JSON.parse(content);
    } catch (e) {
      console.error('JSON parse error:', e);
      console.error('Content that failed to parse:', content);
      throw new Error('Invalid JSON response from AI model');
    }

    // Validate the response structure
    if (!parsedData.recipes || !Array.isArray(parsedData.recipes)) {
      console.error('Invalid response structure:', parsedData);
      throw new Error('AI model did not return recipes array');
    }

    const recipes = parsedData.recipes;

    // Log what we got
    console.log(`AI returned ${recipes.length} recipes`);
    
    // Create a set of available ingredient names for quick lookup (case-insensitive)
    const availableIngredientsSet = new Set(
      inventory.map(item => (item.name || item.ingredient || '').toLowerCase().trim())
    );

    // Validate each recipe has required fields AND uses only available ingredients
    const validRecipes = recipes.filter(recipe => {
      // Check basic structure
      const hasValidStructure = recipe.title && 
                                recipe.description && 
                                Array.isArray(recipe.ingredients) && 
                                Array.isArray(recipe.instructions) &&
                                recipe.ingredients.length > 0 &&
                                recipe.instructions.length > 0;
      
      if (!hasValidStructure) {
        console.log(`Recipe "${recipe.title}" failed structure validation`);
        return false;
      }

      // Check if all ingredients are in inventory
      const missingIngredients = recipe.ingredients.filter(ing => {
        const ingredientName = (ing.name || '').toLowerCase().trim();
        return !availableIngredientsSet.has(ingredientName);
      });

      if (missingIngredients.length > 0) {
        console.log(`Recipe "${recipe.title}" uses unavailable ingredients:`, 
                    missingIngredients.map(i => i.name).join(', '));
        return false;
      }

      return true;
    });

    console.log(`${validRecipes.length} valid recipes after filtering`);

    // If we don't have at least 5 valid recipes, return an error
    if (validRecipes.length < 5) {
      console.error('Not enough valid recipes. Got:', validRecipes.length);
      throw new Error(`AI model only generated ${validRecipes.length} valid recipes using available ingredients. Expected at least 5.`);
    }

    // Return exactly 5 recipes (in case AI returned more)
    const finalRecipes = validRecipes.slice(0, 5);

    console.log(`Successfully generated ${finalRecipes.length} recipes`);
    return res.status(200).json({ recipes: finalRecipes });

  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({
      error: error.message || 'Failed to generate recipes',
    });
  }
};