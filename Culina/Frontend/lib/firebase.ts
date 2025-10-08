// lib/firebase.ts
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, connectAuthEmulator } from "firebase/auth";
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore";
import { getFunctions, connectFunctionsEmulator } from "firebase/functions";

// ✅ Your Firebase project config (from Firebase Console → Project Settings)
const firebaseConfig = {
    apiKey: "AIzaSyAGsx_FhTWt-hHvoPZwdg9j5CVkoy77ZJQ",
    authDomain: "culinatwoo.firebaseapp.com",
    projectId: "culinatwoo",
    storageBucket: "culinatwoo.appspot.com",
    messagingSenderId: "1075153987793",
    appId: "1:1075153987793:web:bd1426392f0437cb413df0",
    measurementId: "G-5W3QPDM3KF"
};

// ✅ Initialize app safely (prevent re-initialization on hot reload)
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// ✅ Initialize services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const functions = getFunctions(app);

// ✅ Use local emulators only in development
if (__DEV__) {
  console.log("🔗 Using Firebase local emulators...");
  connectAuthEmulator(auth, "http://127.0.0.1:9099");
  connectFirestoreEmulator(db, "127.0.0.1", 8080);
  connectFunctionsEmulator(functions, "127.0.0.1", 5001);
}

export { app };
