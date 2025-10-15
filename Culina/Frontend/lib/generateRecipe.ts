import { httpsCallable } from "firebase/functions";
import { functions } from "@/lib/firebaseConfig";
import type { Recipe } from "@/types/recipe";

interface GenerateRecipeData {
  ingredients: string[];
  preferences?: string[];
}

interface GenerateRecipeResponse {
  recipe: Recipe;
}

export const generateRecipe = async (
  ingredients: string[],
  preferences: string[] = []
): Promise<Recipe> => {
  try {
    const callable = httpsCallable<GenerateRecipeData, GenerateRecipeResponse>(
      functions,
      "generateRecipe"
    );
    
    const response = await callable({ ingredients, preferences });
    
    console.log("Recipe generated:", response.data);
    
    // Backend returns { recipe: {...} }
    return response.data.recipe;
  } catch (err: any) {
    console.error("Recipe generation failed:", err);
    console.error("Error code:", err.code);
    console.error("Error message:", err.message);
    throw err;
  }
};