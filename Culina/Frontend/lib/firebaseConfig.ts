import { initializeApp } from "firebase/app";
import { getFirestore, collection } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyAGsx_FhTWt-hHvoPZwdg9j5CVkoy77ZJQ",
  authDomain: "culinatwoo.firebaseapp.com",
  projectId: "culinatwoo",
  storageBucket: "culinatwoo.appspot.com",
  messagingSenderId: "1075153987793",
  appId: "1:1075153987793:web:bd1426392f0437cb413df0",
  measurementId: "G-5W3QPDM3KF"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firestore, Auth, Storage
export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);

// ✅ Export collection references (required for Firestore utils)
export const recipesCollection = collection(db, "recipes");
export const usersCollection = collection(db, "users");
