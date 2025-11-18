// lib/utils/shareRecipe.ts
import { collection, addDoc, serverTimestamp, query, where, getDocs, deleteDoc, doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebaseConfig';
import { normalizeRecipeSource } from '@/lib/utils/recipeSource';

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

    // Fetch user data for username and profile picture
    const userDocRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userDocRef);
    const userData = userDoc.exists() ? userDoc.data() : {};

    // Generate a consistent avatar URL based on userId if no profile picture exists
    const defaultAvatar = `https://api.dicebear.com/7.x/avataaars/svg?seed=${userId}`;

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
      // Add author information
      authorUsername: userData?.username || 'Anonymous',
      authorProfilePicture: userData?.profilePicture || defaultAvatar,
    };

    const sourceLabel = normalizeRecipeSource(recipe.source);
    sharedRecipeData.source = sourceLabel;

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
      if (sourceLabel === 'Human' && !tags.includes('Human')) {
        tags.push('Human');
      }
      if (tags.length > 0) {
        sharedRecipeData.tags = tags;
      }
    } else if (sourceLabel === 'Human') {
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

/**
 * Update a shared recipe
 */
export const updateSharedRecipe = async (
  sharedRecipeId: string,
  updates: Partial<RecipeData>,
  userId: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    const sharedRecipeRef = doc(db, 'sharedRecipes', sharedRecipeId);

    // Verify the recipe exists and belongs to the user
    const sharedRecipeDoc = await getDoc(sharedRecipeRef);

    if (!sharedRecipeDoc.exists()) {
      return {
        success: false,
        error: 'Shared recipe not found',
      };
    }

    const recipeData = sharedRecipeDoc.data();
    if (recipeData.userId !== userId) {
      return {
        success: false,
        error: 'You can only edit your own shared recipes',
      };
    }

    // Prepare update data - only include defined fields
    const updateData: any = {
      updatedAt: serverTimestamp(),
    };

    if (updates.title !== undefined) updateData.title = updates.title;
    if (updates.description !== undefined) updateData.description = updates.description;
    if (updates.ingredients !== undefined) updateData.ingredients = updates.ingredients;
    if (updates.instructions !== undefined) updateData.instructions = updates.instructions;
    if (updates.servings !== undefined) updateData.servings = updates.servings;
    if (updates.estimatedCalories !== undefined) updateData.estimatedCalories = updates.estimatedCalories;
    if (updates.prepTime !== undefined) updateData.prepTime = updates.prepTime;
    if (updates.cookTime !== undefined) updateData.cookTime = updates.cookTime;
    if (updates.difficulty !== undefined) updateData.difficulty = updates.difficulty;
    if (updates.cuisine !== undefined) updateData.cuisine = updates.cuisine;
    if (updates.tags !== undefined) updateData.tags = updates.tags;
    if (updates.imageUrl !== undefined) updateData.imageUrl = updates.imageUrl;

    await updateDoc(sharedRecipeRef, updateData);

    return { success: true };
  } catch (error) {
    console.error('Error updating shared recipe:', error);
    return {
      success: false,
      error: 'Failed to update shared recipe. Please try again.',
    };
  }
};

/**
 * Get the shared recipe ID for a user's recipe
 */
export const getSharedRecipeId = async (
  userRecipeId: string,
  userId: string
): Promise<string | null> => {
  try {
    const sharedRecipesRef = collection(db, 'sharedRecipes');
    const q = query(
      sharedRecipesRef,
      where('userId', '==', userId),
      where('userRecipeId', '==', userRecipeId)
    );

    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      return null;
    }

    return snapshot.docs[0].id;
  } catch (error) {
    console.error('Error getting shared recipe ID:', error);
    return null;
  }
};