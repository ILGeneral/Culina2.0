const admin = require('firebase-admin');

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

module.exports = async (req, res) => {
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
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await admin.auth().verifyIdToken(token);
    const uid = decodedToken.uid;

    const { recipeId } = req.body;
    if (!recipeId) {
      return res.status(400).json({ error: 'recipeId is required' });
    }

    const recipeRef = db.collection('recipes').doc(recipeId);
    const invCol = db.collection('users').doc(uid).collection('ingredients');

    await db.runTransaction(async (tx) => {
      const recSnap = await tx.get(recipeRef);
      if (!recSnap.exists) {
        throw new Error('Recipe not found');
      }

      if (recSnap.get('ownerId') !== uid) {
        throw new Error('Not the owner of this recipe');
      }

      const ingredients = recSnap.get('ingredients') || [];
      const invSnap = await invCol.get();

      const byName = new Map(
        invSnap.docs.map((d) => [
          d.get('name').toLowerCase(),
          { ref: d.ref, data: d.data() },
        ])
      );

      for (const ing of ingredients) {
        const ingName = ing.name?.toLowerCase() || ing.toLowerCase();
        const inv = byName.get(ingName);
        if (!inv) {
          throw new Error(`Missing ${ing.name || ing}`);
        }

        const qtyNeeded = typeof ing === 'string' ? 1 : (ing.qty || 1);
        if (inv.data.quantity < qtyNeeded) {
          throw new Error(`Not enough ${ing.name || ing}`);
        }

        tx.update(inv.ref, {
          quantity: Math.max(0, inv.data.quantity - qtyNeeded),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }
    });

    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ error: error.message });
  }
};