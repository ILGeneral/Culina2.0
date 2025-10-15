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

    const { recipeId, score } = req.body;

    if (!recipeId || !score) {
      return res.status(400).json({ error: 'recipeId and score are required' });
    }

    if (![1, 2, 3, 4, 5].includes(score)) {
      return res.status(400).json({ error: 'Score must be 1-5' });
    }

    const recipeRef = db.collection('recipes').doc(recipeId);
    const ratingRef = recipeRef.collection('ratings').doc(uid);

    await db.runTransaction(async (tx) => {
      const rec = await tx.get(recipeRef);
      if (!rec.exists) {
        throw new Error('Recipe not found');
      }
      if (rec.get('ownerId') === uid) {
        throw new Error('Cannot rate your own recipe');
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

      const ratingsSnap = await recipeRef.collection('ratings').get();
      const scores = ratingsSnap.docs.map((d) => d.get('score'));
      const count = scores.length;
      const avg = count ? scores.reduce((a, b) => a + b, 0) / count : 0;

      tx.update(recipeRef, { ratings: { count, avg } });
    });

    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ error: error.message });
  }
};  