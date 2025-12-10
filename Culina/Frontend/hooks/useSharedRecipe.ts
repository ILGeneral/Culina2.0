// hooks/useSharedRecipe.ts
import { useState, useEffect, useCallback } from 'react';
import { collection, query, where, onSnapshot, orderBy, limit, getDocs, startAfter, QueryDocumentSnapshot, DocumentData } from 'firebase/firestore';
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
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);

  const loadMoreCommunityRecipes = useCallback(async () => {
    if (!hasMore || loadingMore || !lastDoc || !auth.currentUser) return;

    setLoadingMore(true);
    try {
      const uid = auth.currentUser.uid;
      const communityQuery = query(
        collection(db, 'sharedRecipes'),
        orderBy('sharedAt', 'desc'),
        startAfter(lastDoc),
        limit(20)
      );

      const snapshot = await getDocs(communityQuery);

      if (snapshot.empty) {
        setHasMore(false);
      } else {
        const newRecipes = snapshot.docs
          .map((doc) => {
            const data = doc.data() as SharedRecipe;
            return {
              ...data,
              id: doc.id,
              source: normalizeRecipeSource((data as any)?.source),
            };
          })
          .filter((recipe: any) => recipe.userId !== uid) as SharedRecipe[];

        setCommunityRecipes((prev) => [...prev, ...newRecipes]);
        setLastDoc(snapshot.docs[snapshot.docs.length - 1]);

        if (snapshot.docs.length < 20) {
          setHasMore(false);
        }
      }
    } catch (err) {
      console.error('Error loading more recipes:', err);
      setError('Failed to load more recipes');
    } finally {
      setLoadingMore(false);
    }
  }, [hasMore, loadingMore, lastDoc]);

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
            try {
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
            } catch (err) {
              console.error('Error processing my shared recipes:', err);
              setError('Failed to process your shared recipes');
              setLoading(false);
            }
          },
          (err: any) => {
            // Silently handle permission errors (user not authenticated)
            if (err?.code === 'permission-denied') {
              setLoading(false);
              return;
            }
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
            try {
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

              // Set the last document for pagination
              if (snapshot.docs.length > 0) {
                setLastDoc(snapshot.docs[snapshot.docs.length - 1]);
              }

              // Check if there might be more recipes
              setHasMore(snapshot.docs.length >= 50);
              setLoading(false);
            } catch (err) {
              console.error('Error processing community recipes:', err);
              setError('Failed to process community recipes');
              setLoading(false);
            }
          },
          (err: any) => {
            // Silently handle permission errors (user not authenticated)
            if (err?.code === 'permission-denied') {
              setLoading(false);
              return;
            }
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
    loadingMore,
    hasMore,
    loadMoreCommunityRecipes,
  };
};