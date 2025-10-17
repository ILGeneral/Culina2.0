import { getAuth } from "firebase/auth";
import type { Recipe } from "@/types/recipe";

const API_BASE = 'https://culina-backend.vercel.app/api';

interface GenerateRecipePayload {
  model: string;
  ingredients: string[];
  preferences: string[];
}

type GenerateRecipesResponse = {
  recipes: Recipe[];
};

export const generateRecipe = async (
  ingredients: string[],
  preferences: string[] = []
): Promise<GenerateRecipesResponse> => {

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
    const payload: GenerateRecipePayload = {
      model: 'llama-3.1-8b-instant',
      ingredients,
      preferences,
    };

    const response = await fetch(`${API_BASE}/generate-recipe`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    console.log(' Response status:', response.status);
    
    const responseText = await response.text();
    console.log(' Raw response:', responseText.substring(0, 200));

    if (!response.ok) {
      throw new Error(`Backend error (${response.status}): ${responseText}`);
    }

    let data: unknown;
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      console.error('Failed to parse response as JSON:', responseText);
      throw new Error('Backend returned invalid JSON');
    }

    const normalized = normalizeResponse(data);

    console.log(" Recipes generated:", normalized.recipes.length);

    return normalized;
  } catch (err: any) {
    console.error(" Recipe generation failed:", err);
    console.error("Error message:", err.message);
    throw err;
  }
};

const normalizeResponse = (data: unknown): GenerateRecipesResponse => {
  if (typeof data !== 'object' || data === null) {
    throw new Error('Backend returned unexpected payload');
  }

  // Check if backend returned a single recipe object
  const maybeSingleRecipe = (data as { recipe?: unknown }).recipe;
  if (maybeSingleRecipe && typeof maybeSingleRecipe === 'object') {
    console.log('⚠️  Backend returned single recipe, wrapping in array');
    return { recipes: [maybeSingleRecipe as Recipe] };
  }

  // Check if backend returned recipes array
  const maybeRecipes = (data as { recipes?: unknown }).recipes;
  if (!Array.isArray(maybeRecipes)) {
    throw new Error('Backend did not return recipes array');
  }

  if (maybeRecipes.length === 0) {
    throw new Error('Backend returned empty recipes array');
  }

  // Note: Removed the "< 5" check since backend currently returns 1 recipe
  // You can add it back once your backend supports multiple recipes
  console.log(`✅ Received ${maybeRecipes.length} recipe(s)`);

  return { recipes: maybeRecipes as Recipe[] };
};