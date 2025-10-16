import { getAuth } from "firebase/auth";
import type { Recipe } from "@/types/recipe";

const API_BASE = 'https://culina-backend.vercel.app/api';

interface GenerateRecipeData {
  ingredients: string[];
  preferences?: string[];
}

export const generateRecipe = async (
  ingredients: string[],
  preferences: string[] = []
): Promise<Recipe> => {
  try {
    // Get Firebase Auth token
    const auth = getAuth();
    const user = auth.currentUser;
    
    if (!user) {
      throw new Error('Not authenticated - please log in');
    }
    
    console.log('Getting auth token...');
    const token = await user.getIdToken();
    console.log('Token obtained');
    
    console.log('Calling backend API...');
    console.log('Ingredients:', ingredients);
    console.log('Preferences:', preferences);
    
    // Call Vercel backend API with updated model
    const response = await fetch(`${API_BASE}/generate-recipe`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant'  // ✅ Updated model
      }),
    });

    console.log('📥 Response status:', response.status);
    
    const responseText = await response.text();
    console.log('📄 Raw response:', responseText.substring(0, 200));

    if (!response.ok) {
      throw new Error(`Backend error (${response.status}): ${responseText}`);
    }

    let data;
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      console.error('Failed to parse response as JSON:', responseText);
      throw new Error('Backend returned invalid JSON');
    }
    
    console.log("✅ Recipe generated:", data.recipe);
    
    return data.recipe;
  } catch (err: any) {
    console.error("❌ Recipe generation failed:", err);
    console.error("Error message:", err.message);
    throw err;
  }
};