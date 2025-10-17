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
    const diet = preferences?.dietaryPreference || 'none';
    const religion = preferences?.religiousPreference || 'none';
    const caloriePlan = preferences?.caloriePlan || 'none';
    const allergies = preferences?.allergies || 'none';

    const model = req.body?.model || 'llama-3.1-8b-instant';

    // Improved prompt with stricter formatting requirements
    const prompt = `
You are a culinary assistant. Create EXACTLY 5 different and varied recipes.

STRICT REQUIREMENTS:
- Use ONLY ingredients from the inventory provided below
- Each recipe MUST be significantly different from the others
- Follow dietary preference: ${diet}
- Follow religious preference: ${religion}
- Follow calorie goal: ${caloriePlan}
- Avoid allergies: ${allergies}
- Return EXACTLY 5 recipes, no more, no less

Return ONLY valid JSON in this EXACT format (no additional text):
{
  "recipes": [
    {
      "title": "Recipe Name Here",
      "description": "Brief description of the dish",
      "ingredients": ["ingredient 1 with quantity", "ingredient 2 with quantity"],
      "instructions": ["Step 1", "Step 2", "Step 3"],
      "servings": 2,
      "estimatedCalories": 450
    }
  ]
}

Available Inventory:
${JSON.stringify(inventory, null, 2)}

Remember: Return EXACTLY 5 different recipes in the JSON format above.
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

    // Validate each recipe has required fields
    const validRecipes = recipes.filter(recipe => {
      return recipe.title && 
             recipe.description && 
             Array.isArray(recipe.ingredients) && 
             Array.isArray(recipe.instructions) &&
             recipe.ingredients.length > 0 &&
             recipe.instructions.length > 0;
    });

    console.log(`${validRecipes.length} valid recipes after filtering`);

    // If we don't have at least 5 valid recipes, return an error
    if (validRecipes.length < 5) {
      console.error('Not enough valid recipes. Got:', validRecipes.length);
      throw new Error(`AI model only generated ${validRecipes.length} valid recipes. Expected at least 5.`);
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