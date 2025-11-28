import { initializeApp, getApps, getApp } from "firebase/app";
import {
  initializeAuth,
  getAuth,
  // @ts-ignore - React Native persistence may not be in all type definitions
  getReactNativePersistence
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getFunctions } from "firebase/functions";
import AsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
  apiKey: "AIzaSyAGsx_FhTWt-hHvoPZwdg9j5CVkoy77ZJQ",
  authDomain: "culinatwoo.firebaseapp.com",
  projectId: "culinatwoo",
  storageBucket: "culinatwoo.firebasestorage.app",
  messagingSenderId: "1075153987793",
  appId: "1:1075153987793:web:bd1426392f0437cb413df0",
  measurementId: "G-5W3QPDM3KF",
};

// Initialize Firebase App safely
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Initialize Auth with AsyncStorage persistence for React Native
let auth;
try {
  // Try to initialize with React Native persistence if available
  if (typeof getReactNativePersistence === 'function') {
    auth = initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage)
    });
  } else {
    // Fallback to regular auth (web persistence with AsyncStorage polyfill)
    auth = getAuth(app);
  }
} catch (error) {
  // If auth is already initialized, get the existing instance
  auth = getAuth(app);
}

// Initialize other services
const db = getFirestore(app);
const storage = getStorage(app);
const functions = getFunctions(app);

// Export collection references
import { collection } from "firebase/firestore";

export const recipesCollection = collection(db, "recipes");
export const usersCollection = collection(db, "users");
export const ingredientsCollection = collection(db, "ingredients");

export { app, auth, db, storage, functions };