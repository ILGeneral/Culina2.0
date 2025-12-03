import { addDoc, serverTimestamp } from "firebase/firestore";
import { recipesCollection } from "@/lib/firebaseConfig";

export const addRecipe = async (data: {
  title: string;
  imageUrl: string;
  estKcal: number;
  source: "AI" | "Edited" | "Human";
  ownerId?: string;
  visibility?: "public" | "private";
}) => {
  try {
    const docRef = await addDoc(recipesCollection, {
      ...data,
      visibility: data.visibility || "public",
      createdAt: serverTimestamp(),
    });
    return docRef.id;
  } catch (error) {
    console.error("Error adding recipe:", error);
    throw error;
  }
};
