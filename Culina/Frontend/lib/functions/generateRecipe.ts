import { httpsCallable } from "firebase/functions";
import { functions } from "../firebaseConfig";
import type { Recipe } from "@/types/recipe";

interface GenerateRecipeResponse {
  recipe?: any;
  [key: string]: any;
}

export async function generateRecipe(
  ingredients: string[],
  preferences?: string[]
): Promise<GenerateRecipeResponse> {
  try {
    const callGenerateRecipe = httpsCallable<
      { ingredients: string[]; preferences?: string[] },
      GenerateRecipeResponse
    >(functions, "generateRecipe");
    const response = await callGenerateRecipe({ ingredients, preferences });
    console.log("Recipe generated!:", response.data);
    return response.data;
  } catch (error: any) {
    console.error("generateRecipe error:", error);
    throw error;
  }
}
