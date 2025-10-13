import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import {
  initializeAuth,
  getReactNativePersistence,
} from "firebase/auth/react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getFunctions } from "firebase/functions";

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

// Initialize Auth with persistence
let auth: Auth;
try {
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage),
  });
} catch {
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