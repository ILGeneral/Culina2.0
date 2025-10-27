import { useEffect, useState } from "react";
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, orderBy } from "firebase/firestore";
import { db, auth } from "@/lib/firebaseConfig";
import { onAuthStateChanged } from "firebase/auth";

export type Ingredient = {
  id?: string;
  name: string;
  quantity: number;
  unit: string;
  type?: string;
  caloriesPerUnit?: number;
  imageUrl?: string;
  createdAt?: any;
  updatedAt?: any;
};

export function useInventory() {
  const [inventory, setInventory] = useState<Ingredient[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [authReady, setAuthReady] = useState(false);

  // Step 1: Wait for auth to be ready
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUserId(user?.uid || null);
      setAuthReady(true);
      if (!user) {
        setLoading(false);
        setInventory([]);
      }
    });
    return unsubscribe;
  }, []);

  // Step 2: Set up Firestore listener only after auth token is ready
  useEffect(() => {
    if (!userId || !authReady) {
      setInventory([]);
      setLoading(false);
      return;
    }

    let unsubscribe: (() => void) | null = null;
    let isMounted = true;

    // Add a small delay to ensure auth token has fully propagated
    const timer = setTimeout(() => {
      if (!isMounted) return;

      const invRef = collection(db, "users", userId, "inventory");
      const q = query(invRef, orderBy("name", "asc"));

      unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          if (!isMounted) return;

          const items: Ingredient[] = snapshot.docs.map((d) => ({
            id: d.id,
            ...d.data(),
          })) as Ingredient[];

          console.log(`[useInventory] Snapshot updated: ${items.length} items`);
          console.log('[useInventory] Current inventory:', items.map(i => `${i.name}: ${i.quantity}`));

          setInventory(items);
          setLoading(false);
        },
        (error) => {
          if (!isMounted) return;
          console.error("Inventory snapshot error:", error);
          setLoading(false);
        }
      );
    }, 100);

    // Cleanup function - clear both timer and listener
    return () => {
      isMounted = false;
      clearTimeout(timer);
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [userId, authReady]);

  // Add ingredient
  const addIngredient = async (item: Omit<Ingredient, "id">) => {
    if (!userId) throw new Error("Not authenticated");

    const ref = collection(db, "users", userId, "inventory");
    await addDoc(ref, {
      ...item,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  };

  // Update ingredient
  const updateIngredient = async (id: string, updates: Partial<Ingredient>) => {
    if (!userId) throw new Error("Not authenticated");

    console.log(`[useInventory] Updating ingredient ${id} with:`, updates);
    const ref = doc(db, "users", userId, "inventory", id);
    try {
      await updateDoc(ref, {
        ...updates,
        updatedAt: new Date(),
      });
      console.log(`[useInventory] Successfully updated ingredient ${id}`);
    } catch (error) {
      console.error(`[useInventory] Error updating ingredient ${id}:`, error);
      throw error;
    }
  };

  // Delete ingredient
  const deleteIngredient = async (id: string) => {
    if (!userId) throw new Error("Not authenticated");

    console.log(`[useInventory] Deleting ingredient ${id}`);
    const ref = doc(db, "users", userId, "inventory", id);
    try {
      await deleteDoc(ref);
      console.log(`[useInventory] Successfully deleted ingredient ${id}`);
    } catch (error) {
      console.error(`[useInventory] Error deleting ingredient ${id}:`, error);
      throw error;
    }
  };

  return {
    inventory,
    loading,
    addIngredient,
    updateIngredient,
    deleteIngredient,
  };
}