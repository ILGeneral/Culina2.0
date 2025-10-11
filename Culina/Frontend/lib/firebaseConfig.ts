import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
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

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const functions = getFunctions(app);

export default app;
