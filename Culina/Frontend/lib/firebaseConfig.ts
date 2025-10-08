// lib/firebaseConfig.ts
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyAGsx_FhTWt-hHvoPZwdg9j5CVkoy77ZJQ",
  authDomain: "culinatwoo.firebaseapp.com",
  projectId: "culinatwoo",
  storageBucket: "culinatwoo.firebasestorage.app",
  messagingSenderId: "1075153987793",
  appId: "1:1075153987793:web:bd1426392f0437cb413df0",
  measurementId: "G-5W3QPDM3KF",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
