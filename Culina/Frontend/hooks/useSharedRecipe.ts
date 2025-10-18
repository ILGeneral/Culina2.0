// hooks/useSharedRecipe.ts
import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, orderBy, limit } from 'firebase/firestore';
import { db, auth } from '@/lib/firebaseConfig';
import { normalizeRecipeSource } from '@/lib/utils/recipeSource';

// Export the SharedRecipe interface
export interface SharedRecipe {
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
  userId: string;
  userRecipeId: string;
  sharedAt: any;
  createdAt?: any;
  source?: string;
}

export const useSharedRecipes = () => {
  const [mySharedRecipes, setMySharedRecipes] = useState<SharedRecipe[]>([]);
  const [communityRecipes, setCommunityRecipes] = useState<SharedRecipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    
    if (!uid) {
      setLoading(false);
      setError('User not authenticated');
      return;
    }

    try {
      // Subscribe to user's shared recipes
      const myRecipesQuery = query(
        collection(db, 'sharedRecipes'),
        where('userId', '==', uid),
        orderBy('sharedAt', 'desc'),
        limit(20)
      );

      const unsubscribeMy = onSnapshot(
        myRecipesQuery,
        (snapshot) => {
          const recipes = snapshot.docs.map((doc) => {
            const data = doc.data() as SharedRecipe;
            return {
              ...data,
              id: doc.id,
              source: normalizeRecipeSource((data as any)?.source),
            };
          });
          setMySharedRecipes(recipes);
          setLoading(false);
        },
        (err) => {
          console.error('Error fetching my shared recipes:', err);
          setError('Failed to load your shared recipes');
          setLoading(false);
        }
      );

      // Subscribe to community recipes (excluding user's own)
      const communityQuery = query(
        collection(db, 'sharedRecipes'),
        orderBy('sharedAt', 'desc'),
        limit(50)
      );

      const unsubscribeCommunity = onSnapshot(
        communityQuery,
        (snapshot) => {
          const recipes = snapshot.docs
            .map((doc) => {
              const data = doc.data() as SharedRecipe;
              return {
                ...data,
                id: doc.id,
                source: normalizeRecipeSource((data as any)?.source),
              };
            })
            .filter((recipe: any) => recipe.userId !== uid) as SharedRecipe[];
          setCommunityRecipes(recipes);
        },
        (err) => {
          console.error('Error fetching community recipes:', err);
          setError('Failed to load community recipes');
        }
      );

      return () => {
        unsubscribeMy();
        unsubscribeCommunity();
      };
    } catch (err) {
      console.error('Error setting up recipe listeners:', err);
      setError('Failed to initialize recipes');
      setLoading(false);
    }
  }, []);

  return {
    mySharedRecipes,
    communityRecipes,
    loading,
    error,
  };
};