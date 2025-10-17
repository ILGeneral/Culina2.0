// lib/utils/shareRecipe.ts
import { collection, addDoc, serverTimestamp, query, where, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebaseConfig';

interface RecipeData {
  id: string;
  title: string;
  description?: string;
  ingredients: (string | { name: string; qty?: string })[];
  instructions?: string[];
  servings?: number;
  estimatedCalories?: number;
  prepTime?: string;
  cookTime?: string;
  difficulty?: 'Easy' | 'Medium' | 'Hard';
  cuisine?: string;
  tags?: string[];
  imageUrl?: string;
  createdAt?: any;
  source?: string;
}

/**
 * Share a recipe to the community
 */
export const shareRecipe = async (
  recipe: RecipeData,
  userId: string
): Promise<{ success: boolean; error?: string; sharedRecipeId?: string }> => {
  try {
    // Check if recipe is already shared
    const sharedRecipesRef = collection(db, 'sharedRecipes');
    const q = query(
      sharedRecipesRef,
      where('userId', '==', userId),
      where('userRecipeId', '==', recipe.id)
    );
    
    const existingShares = await getDocs(q);
    
    if (!existingShares.empty) {
      return {
        success: false,
        error: 'This recipe is already shared',
      };
    }

    // Create shared recipe document - only include defined fields
    const sharedRecipeData: any = {
      title: recipe.title,
      description: recipe.description || '',
      ingredients: recipe.ingredients,
      instructions: recipe.instructions || [],
      userId,
      userRecipeId: recipe.id,
      sharedAt: serverTimestamp(),
      createdAt: recipe.createdAt || serverTimestamp(),
    };

    if (recipe.source) {
      sharedRecipeData.source = recipe.source;
    }

    // Only add optional fields if they are defined
    if (recipe.servings !== undefined) {
      sharedRecipeData.servings = recipe.servings;
    }
    if (recipe.estimatedCalories !== undefined) {
      sharedRecipeData.estimatedCalories = recipe.estimatedCalories;
    }
    if (recipe.prepTime !== undefined) {
      sharedRecipeData.prepTime = recipe.prepTime;
    }
    if (recipe.cookTime !== undefined) {
      sharedRecipeData.cookTime = recipe.cookTime;
    }
    if (recipe.difficulty !== undefined) {
      sharedRecipeData.difficulty = recipe.difficulty;
    }
    if (recipe.cuisine !== undefined) {
      sharedRecipeData.cuisine = recipe.cuisine;
    }
    if (recipe.tags !== undefined) {
      const tags = Array.isArray(recipe.tags) ? [...recipe.tags] : [];
      if (recipe.source === 'Human' && !tags.includes('Human')) {
        tags.push('Human');
      }
      if (tags.length > 0) {
        sharedRecipeData.tags = tags;
      }
    } else if (recipe.source === 'Human') {
      sharedRecipeData.tags = ['Human'];
    }

    if (recipe.imageUrl !== undefined) {
      sharedRecipeData.imageUrl = recipe.imageUrl;
    }

    const docRef = await addDoc(sharedRecipesRef, sharedRecipeData);

    return {
      success: true,
      sharedRecipeId: docRef.id,
    };
  } catch (error) {
    console.error('Error sharing recipe:', error);
    return {
      success: false,
      error: 'Failed to share recipe. Please try again.',
    };
  }
};

/**
 * Unshare a recipe from the community
 */
export const unshareRecipe = async (
  userRecipeId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    const sharedRecipesRef = collection(db, 'sharedRecipes');
    const q = query(
      sharedRecipesRef,
      where('userId', '==', userId),
      where('userRecipeId', '==', userRecipeId)
    );
    
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) {
      return {
        success: false,
        error: 'Shared recipe not found',
      };
    }

    // Delete all matching shared recipes (should be just one)
    const deletePromises = snapshot.docs.map((docSnap) =>
      deleteDoc(doc(db, 'sharedRecipes', docSnap.id))
    );
    
    await Promise.all(deletePromises);

    return { success: true };
  } catch (error) {
    console.error('Error unsharing recipe:', error);
    return {
      success: false,
      error: 'Failed to unshare recipe. Please try again.',
    };
  }
};

/**
 * Check if a recipe is shared
 */
export const isRecipeShared = async (
  userRecipeId: string,
  userId: string
): Promise<boolean> => {
  try {
    const sharedRecipesRef = collection(db, 'sharedRecipes');
    const q = query(
      sharedRecipesRef,
      where('userId', '==', userId),
      where('userRecipeId', '==', userRecipeId)
    );
    
    const snapshot = await getDocs(q);
    return !snapshot.empty;
  } catch (error) {
    console.error('Error checking if recipe is shared:', error);
    return false;
  }
};