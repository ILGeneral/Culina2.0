import { useEffect, useState } from "react";
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebaseConfig"; // or "@/lib/firebase" depending on your setup
import { getAuth } from "firebase/auth";

export type Ingredient = {
  id?: string;
  name: string;
  quantity: number;
  unit: string;
  type?: string; // e.g. "Meat", "Vegetable"
  caloriesPerUnit?: number;
  imageUrl?: string; // Firebase Storage URL
  createdAt?: any;
  updatedAt?: any;
};

export function useInventory() {
  const [inventory, setInventory] = useState<Ingredient[]>([]);
  const [loading, setLoading] = useState(true);
  const auth = getAuth();

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    const invRef = collection(db, "users", user.uid, "inventory");
    const q = query(invRef, orderBy("name", "asc"));

    const unsub = onSnapshot(q, (snapshot) => {
      const items: Ingredient[] = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as Ingredient[];
      setInventory(items);
      setLoading(false);
    });

    return () => unsub();
  }, [auth.currentUser]);

  //  Add ingredient
  const addIngredient = async (item: Omit<Ingredient, "id">) => {
    const user = auth.currentUser;
    if (!user) throw new Error("Not authenticated");

    const ref = collection(db, "users", user.uid, "inventory");
    await addDoc(ref, {
      ...item,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  };

  // Update ingredient
  const updateIngredient = async (id: string, updates: Partial<Ingredient>) => {
    const user = auth.currentUser;
    if (!user) throw new Error("Not authenticated");

    const ref = doc(db, "users", user.uid, "inventory", id);
    await updateDoc(ref, {
      ...updates,
      updatedAt: new Date(),
    });
  };

  // Delete ingredient
  const deleteIngredient = async (id: string) => {
    const user = auth.currentUser;
    if (!user) throw new Error("Not authenticated");

    const ref = doc(db, "users", user.uid, "inventory", id);
    await deleteDoc(ref);
  };

  return {
    inventory,
    loading,
    addIngredient,
    updateIngredient,
    deleteIngredient,
  };
}
