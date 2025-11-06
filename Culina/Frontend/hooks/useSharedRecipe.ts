// hooks/useSharedRecipe.ts
import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, orderBy, limit } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
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
  ratings?: {
    averageRating: number;
    totalRatings: number;
    ratingDistribution: {
      1: number;
      2: number;
      3: number;
      4: number;
      5: number;
    };
    lastRatedAt: any;
  };
}

export const useSharedRecipes = () => {
  const [mySharedRecipes, setMySharedRecipes] = useState<SharedRecipe[]>([]);
  const [communityRecipes, setCommunityRecipes] = useState<SharedRecipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let unsubscribeMy: (() => void) | null = null;
    let unsubscribeCommunity: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      // Tear down any existing listeners when auth state changes
      if (unsubscribeMy) {
        unsubscribeMy();
        unsubscribeMy = null;
      }
      if (unsubscribeCommunity) {
        unsubscribeCommunity();
        unsubscribeCommunity = null;
      }

      if (!user) {
        setMySharedRecipes([]);
        setCommunityRecipes([]);
        setError(null);
        setLoading(false);
        return;
      }

      setLoading(true);

      try {
        const uid = user.uid;

        const myRecipesQuery = query(
          collection(db, 'sharedRecipes'),
          where('userId', '==', uid),
          orderBy('sharedAt', 'desc'),
          limit(20)
        );

        unsubscribeMy = onSnapshot(
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

        const communityQuery = query(
          collection(db, 'sharedRecipes'),
          orderBy('sharedAt', 'desc'),
          limit(50)
        );

        unsubscribeCommunity = onSnapshot(
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
            setLoading(false);
          },
          (err) => {
            console.error('Error fetching community recipes:', err);
            setError('Failed to load community recipes');
            setLoading(false);
          }
        );
      } catch (err) {
        console.error('Error setting up recipe listeners:', err);
        setError('Failed to initialize recipes');
        setLoading(false);
      }
    });

    return () => {
      if (unsubscribeMy) unsubscribeMy();
      if (unsubscribeCommunity) unsubscribeCommunity();
      unsubscribeAuth();
    };
  }, []);

  return {
    mySharedRecipes,
    communityRecipes,
    loading,
    error,
  };
};