import { httpsCallable } from "firebase/functions";
import { functions } from "@/lib/firebaseConfig";
import type { Recipe } from "@/types/recipe";

export const generateRecipe = async (
  ingredients: string[],
  preferences: string[]
): Promise<Recipe> => {
  try {
    const callable = httpsCallable(functions, "generateRecipe");
    const response = await callable({ ingredients, preferences });

    // If backend returns { recipe: {...} }, unwrap it.
    const data = response.data as any;
    return data.recipe ? (data.recipe as Recipe) : (data as Recipe);
  } catch (err) {
    console.error("Error generating recipe:", err);
    throw err;
  }
};
