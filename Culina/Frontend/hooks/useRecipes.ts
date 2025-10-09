import { useEffect, useState } from "react";
import {
  onSnapshot,
  query,
  orderBy,
  where,
  QueryDocumentSnapshot,
  DocumentData,
} from "firebase/firestore";
import { recipesCollection } from "@/lib/firebaseConfig";

export type Recipe = {
  id: string;
  title: string;
  description?: string;
  imageUrl: string;
  estKcal: number;
  source: "AI" | "Edited" | "Human";
  ownerId?: string;
  visibility?: "public" | "private";
  likes?: number;
  createdAt?: any;
};

export const useRecipes = () => {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(
      recipesCollection,
      where("visibility", "==", "public"),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const recipeList: Recipe[] = snapshot.docs.map(
          (doc: QueryDocumentSnapshot<DocumentData>) => ({
            ...(doc.data() as Recipe),
            id: doc.id,
          })
        );
        setRecipes(recipeList);
        setLoading(false);
      },
      (error) => {
        console.error("❌ Error fetching recipes:", error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  return { recipes, loading };
};
