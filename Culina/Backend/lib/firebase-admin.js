/**
 Shared Firebase Admin initialization module
 Ensures Firebase Admin is initialized once and credentials are validated
 */
import admin from 'firebase-admin';

let firebaseInitialized = false;

/**
 Get initialized Firebase Admin instance
 returns admin.app.App Firebase Admin app instance
 throws Error If Firebase credentials are missing
 */
export function getFirebaseAdmin() {
  if (firebaseInitialized && admin.apps.length > 0) {
    return admin;
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      'Missing Firebase credentials. Ensure FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY are set.'
    );
  }

  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey,
      }),
    });

    firebaseInitialized = true;
    console.log('Firebase Admin initialized successfully');
  } catch (error) {
    console.error('Firebase Admin initialization failed:', error);
    throw error;
  }

  return admin;
}

/*
  Verify Firebase ID token from request headers
  param Object req - HTTP request object
  returns {Promise<{uid: string, email: string}>} Decoded token with user info
  throws Error If token is missing or invalid
 */
export async function verifyAuthToken(req) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('Missing authorization header. Please include "Authorization: Bearer <token>"');
  }

  const token = authHeader.split('Bearer ')[1];

  if (!token) {
    throw new Error('Invalid authorization header format');
  }

  try {
    const admin = getFirebaseAdmin();
    const decodedToken = await admin.auth().verifyIdToken(token);

    return {
      uid: decodedToken.uid,
      email: decodedToken.email || null,
    };
  } catch (error) {
    console.error('Token verification failed:', error.message);
    throw new Error('Invalid or expired authentication token');
  }
}

/*
 Get Firestore database instance
 returns admin.firestore.Firestore Firestore instance
 */
export function getFirestore() {
  const admin = getFirebaseAdmin();
  return admin.firestore();
}
