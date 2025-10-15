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
    // Verify Firebase Auth token
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized - No token provided' });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await admin.auth().verifyIdToken(token);
    const uid = decodedToken.uid;

    console.log('✅ User authenticated:', uid);

    // Get user context
    const { preferences, inventory } = await getUserContext(uid);
    const diet = preferences?.dietaryPreference || 'none';
    const religion = preferences?.religiousPreference || 'none';
    const caloriePlan = preferences?.caloriePlan || 'none';

    console.log('📦 Inventory items:', inventory.length);

    const model = req.body?.model || 'llama-3.1-8b-instant';

    const prompt = `
You are a culinary assistant. Create ONE recipe that uses ONLY
ingredients from the user's inventory.
Honor dietary preference: ${diet}, religious preference: ${religion},
calorie goal: ${caloriePlan}.
Return strict JSON:
{
  "title": "string",
  "description": "string",
  "ingredients": ["string"],
  "instructions": ["string"],
  "servings": number,
  "estimatedCalories": number
}
Inventory:
${JSON.stringify(inventory, null, 2)}
    `.trim();

    // Call Groq API
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
        temperature: 0.4,
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

    let recipe;
    try {
      recipe = JSON.parse(content);
    } catch (e) {
      console.error('JSON parse error:', e);
      throw new Error('Model did not return valid JSON');
    }

    console.log('✅ Recipe generated successfully');

    return res.status(200).json({ recipe });
  } catch (error) {
    console.error('❌ Error:', error);
    return res.status(500).json({ 
      error: error.message || 'Failed to generate recipe' 
    });
  }
};