// lib/utils/saveRecipe.ts
import { collection, addDoc, serverTimestamp, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebaseConfig';

interface RecipeData {
  id: string;
  title: string;
  description?: string;
  ingredients: (string | { name: string; qty?: string; unit?: string })[];
  instructions?: string[];
  servings?: number;
  estimatedCalories?: number;
  prepTime?: string;
  cookTime?: string;
  difficulty?: 'Easy' | 'Medium' | 'Hard';
  cuisine?: string;
  tags?: string[];
  imageUrl?: string;
  source?: string;
  readyInMinutes?: number;
}

/**
 * Save a community recipe to user's personal collection
 */
export const saveRecipeToCollection = async (
  recipe: RecipeData,
  userId: string
): Promise<{ success: boolean; error?: string; savedRecipeId?: string }> => {
  try {
    // Check if recipe is already saved
    const userRecipesRef = collection(db, 'users', userId, 'recipes');
    const q = query(
      userRecipesRef,
      where('title', '==', recipe.title)
    );

    const existingSaved = await getDocs(q);

    if (!existingSaved.empty) {
      return {
        success: false,
        error: 'This recipe is already in your collection',
      };
    }

    // Create recipe document in user's collection
    const savedRecipeData: any = {
      title: recipe.title,
      description: recipe.description || '',
      ingredients: recipe.ingredients,
      instructions: recipe.instructions || [],
      createdAt: serverTimestamp(),
    };

    // Add optional fields if defined
    if (recipe.servings !== undefined) {
      savedRecipeData.servings = recipe.servings;
    }
    if (recipe.estimatedCalories !== undefined) {
      savedRecipeData.estimatedCalories = recipe.estimatedCalories;
    }
    if (recipe.prepTime !== undefined) {
      savedRecipeData.prepTime = recipe.prepTime;
    }
    if (recipe.cookTime !== undefined) {
      savedRecipeData.cookTime = recipe.cookTime;
    }
    if (recipe.difficulty !== undefined) {
      savedRecipeData.difficulty = recipe.difficulty;
    }
    if (recipe.cuisine !== undefined) {
      savedRecipeData.cuisine = recipe.cuisine;
    }
    if (recipe.tags !== undefined && Array.isArray(recipe.tags)) {
      savedRecipeData.tags = [...recipe.tags];
    }
    if (recipe.imageUrl !== undefined) {
      savedRecipeData.imageUrl = recipe.imageUrl;
    }
    if (recipe.source !== undefined) {
      savedRecipeData.source = recipe.source;
    }
    if (recipe.readyInMinutes !== undefined) {
      savedRecipeData.readyInMinutes = recipe.readyInMinutes;
    }

    const docRef = await addDoc(userRecipesRef, savedRecipeData);

    return {
      success: true,
      savedRecipeId: docRef.id,
    };
  } catch (error) {
    console.error('Error saving recipe:', error);
    return {
      success: false,
      error: 'Failed to save recipe. Please try again.',
    };
  }
};

/**
 * Check if a recipe is already saved in user's collection
 */
export const isRecipeSaved = async (
  recipeTitle: string,
  userId: string
): Promise<boolean> => {
  try {
    const userRecipesRef = collection(db, 'users', userId, 'recipes');
    const q = query(
      userRecipesRef,
      where('title', '==', recipeTitle)
    );

    const snapshot = await getDocs(q);
    return !snapshot.empty;
  } catch (error) {
    console.error('Error checking if recipe is saved:', error);
    return false;
  }
};
