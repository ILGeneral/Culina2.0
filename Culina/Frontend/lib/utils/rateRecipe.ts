import { db, auth } from '../firebaseConfig';
import {
  collection,
  addDoc,
  updateDoc,
  doc,
  query,
  where,
  getDocs,
  getDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { Rating } from '../../types/rating';

/**
 * Submit or update a rating for a shared recipe
 */
export async function submitRating(
  sharedRecipeId: string,
  rating: number,
  review?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const user = auth.currentUser;
    if (!user) {
      return { success: false, error: 'User not authenticated' };
    }

    // Check if user is trying to rate their own recipe
    const recipeDoc = await getDoc(doc(db, 'sharedRecipes', sharedRecipeId));
    if (!recipeDoc.exists()) {
      return { success: false, error: 'Recipe not found' };
    }

    const recipeData = recipeDoc.data();
    if (recipeData?.userId === user.uid) {
      return { success: false, error: 'You cannot rate your own recipe' };
    }

    // Get user profile data
    const userDoc = await getDoc(doc(db, 'users', user.uid));
    const userData = userDoc.data();
    const userName = userData?.username || 'Anonymous';
    const userProfilePicture = userData?.profilePicture;

    // Check if user already rated this recipe
    const ratingsRef = collection(db, 'ratings');
    const existingQuery = query(
      ratingsRef,
      where('sharedRecipeId', '==', sharedRecipeId),
      where('userId', '==', user.uid)
    );

    const existingRatings = await getDocs(existingQuery);

    if (!existingRatings.empty) {
      // Update existing rating
      const existingDoc = existingRatings.docs[0];
      await updateDoc(doc(db, 'ratings', existingDoc.id), {
        rating,
        review: review || null,
        userName,
        userProfilePicture: userProfilePicture || null,
        updatedAt: serverTimestamp(),
      });
    } else {
      // Create new rating
      await addDoc(ratingsRef, {
        sharedRecipeId,
        userId: user.uid,
        userName,
        userProfilePicture: userProfilePicture || null,
        rating,
        review: review || null,
        verified: false, // Add verified field (required by Firestore rules)
        helpfulCount: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    // Update recipe aggregate ratings
    await updateRecipeRatings(sharedRecipeId);

    return { success: true };
  } catch (error: any) {
    console.error('Error submitting rating:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Calculate and update aggregate rating data for a recipe
 */
async function updateRecipeRatings(sharedRecipeId: string) {
  try {
    const ratingsRef = collection(db, 'ratings');
    const ratingsQuery = query(
      ratingsRef,
      where('sharedRecipeId', '==', sharedRecipeId)
    );

    const ratingsSnapshot = await getDocs(ratingsQuery);

    let totalRating = 0;
    const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

    ratingsSnapshot.forEach((doc) => {
      const data = doc.data();
      totalRating += data.rating;
      distribution[data.rating as keyof typeof distribution]++;
    });

    const totalRatings = ratingsSnapshot.size;
    const averageRating = totalRatings > 0 ? totalRating / totalRatings : 0;

    // Update shared recipe document
    const recipeRef = doc(db, 'sharedRecipes', sharedRecipeId);
    await updateDoc(recipeRef, {
      'ratings.averageRating': averageRating,
      'ratings.totalRatings': totalRatings,
      'ratings.ratingDistribution': distribution,
      'ratings.lastRatedAt': serverTimestamp(),
    });
  } catch (error) {
    console.error('Error updating recipe ratings:', error);
    throw error;
  }
}

/**
 * Get the current user's rating for a recipe
 */
export async function getUserRating(
  sharedRecipeId: string,
  userId: string
): Promise<Rating | null> {
  try {
    const ratingsRef = collection(db, 'ratings');
    const q = query(
      ratingsRef,
      where('sharedRecipeId', '==', sharedRecipeId),
      where('userId', '==', userId)
    );

    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      return null;
    }

    const docSnap = snapshot.docs[0];
    return { id: docSnap.id, ...docSnap.data() } as Rating;
  } catch (error) {
    console.error('Error fetching user rating:', error);
    return null;
  }
}

/**
 * Get all ratings for a recipe
 */
export async function getAllRatings(
  sharedRecipeId: string
): Promise<Rating[]> {
  try {
    const ratingsRef = collection(db, 'ratings');
    const q = query(
      ratingsRef,
      where('sharedRecipeId', '==', sharedRecipeId)
    );

    const snapshot = await getDocs(q);

    // Filter out deleted ratings and map to Rating objects
    const ratings = snapshot.docs
      .map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }))
      .filter((rating: any) => !rating.deleted) as Rating[];

    // Sort by most recent first
    return ratings.sort((a, b) => {
      const aTime = a.createdAt?.seconds || 0;
      const bTime = b.createdAt?.seconds || 0;
      return bTime - aTime;
    });
  } catch (error) {
    console.error('Error fetching all ratings:', error);
    return [];
  }
}

/**
 * Delete a user's rating for a recipe
 */
export async function deleteRating(
  sharedRecipeId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const ratingsRef = collection(db, 'ratings');
    const q = query(
      ratingsRef,
      where('sharedRecipeId', '==', sharedRecipeId),
      where('userId', '==', userId)
    );

    const snapshot = await getDocs(q);

    if (!snapshot.empty) {
      const docToDelete = snapshot.docs[0];
      await updateDoc(doc(db, 'ratings', docToDelete.id), {
        // Soft delete - mark as deleted instead of removing
        deleted: true,
        updatedAt: serverTimestamp(),
      });

      // Update aggregate ratings
      await updateRecipeRatings(sharedRecipeId);
    }

    return { success: true };
  } catch (error: any) {
    console.error('Error deleting rating:', error);
    return { success: false, error: error.message };
  }
}
