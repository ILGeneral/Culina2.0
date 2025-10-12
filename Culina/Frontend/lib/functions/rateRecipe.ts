import { httpsCallable } from "firebase/functions";
import { functions } from "../firebaseConfig";

export async function rateRecipe(recipeId: string, rating: number) {
  try {
    const callRateRecipe = httpsCallable(functions, "rateRecipe");
    const response = await callRateRecipe({ recipeId, rating });
    console.log("Rating submitted!:", response.data);
    return response.data;
  } catch (error: any) {
    console.error("rateRecipe error:", error);
    throw error;
  }
}
