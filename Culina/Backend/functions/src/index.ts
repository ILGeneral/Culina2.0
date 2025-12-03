import * as admin from "firebase-admin";
import {onDocumentDeleted} from "firebase-functions/v2/firestore";

admin.initializeApp();
const db = admin.firestore();

/**
 * Cloud Function trigger: Cascade delete shared recipes when user deletes
 * original recipe.
 * This prevents orphaned shared recipes in the community feed.
 * Triggers on: users/{userId}/recipes/{recipeId} deletion
 */
export const onRecipeDeleted = onDocumentDeleted(
  "users/{userId}/recipes/{recipeId}",
  async (event) => {
    const userId = event.params.userId;
    const recipeId = event.params.recipeId;

    try {
      // Find all shared recipes that reference this deleted recipe
      const sharedRecipesQuery = await db
        .collection("sharedRecipes")
        .where("userId", "==", userId)
        .where("userRecipeId", "==", recipeId)
        .get();

      // If no shared recipes found, exit early
      if (sharedRecipesQuery.empty) {
        console.log(
          `No shared recipes found for userId: ${userId}, recipeId: ${recipeId}`
        );
        return null;
      }

      // Use batch delete for efficiency (max 500 per batch)
      const batch = db.batch();
      let deleteCount = 0;

      for (const doc of sharedRecipesQuery.docs) {
        // Delete the shared recipe document
        batch.delete(doc.ref);
        deleteCount++;

        // Note: Firestore automatically handles subcollection cleanup
        // based on your retention policies, or you can manually delete
        // comments and ratings subcollections if needed
      }

      // Commit the batch delete
      await batch.commit();

      console.log(
        `Successfully deleted ${deleteCount} shared recipe(s) ` +
        `for userId: ${userId}, recipeId: ${recipeId}`
      );

      return null;
    } catch (error) {
      console.error(
        `Error deleting shared recipes for userId: ${userId}, ` +
        `recipeId: ${recipeId}`,
        error
      );
      // Don't throw error - allow the original delete to succeed
      return null;
    }
  }
);

/**
 * Cloud Function trigger: Cascade delete subcollections when a shared recipe
 * is deleted.
 * This cleans up comments and ratings when a user unshares a recipe.
 * Triggers on: sharedRecipes/{recipeId} deletion
 */
export const onSharedRecipeDeleted = onDocumentDeleted(
  "sharedRecipes/{recipeId}",
  async (event) => {
    const recipeId = event.params.recipeId;

    try {
      const batch = db.batch();
      let deleteCount = 0;

      // Delete all comments for this shared recipe
      const commentsQuery = await db
        .collection("sharedRecipes")
        .doc(recipeId)
        .collection("comments")
        .get();

      for (const doc of commentsQuery.docs) {
        batch.delete(doc.ref);
        deleteCount++;
      }

      // Delete all ratings (subcollection) for this shared recipe
      const ratingsQuery = await db
        .collection("sharedRecipes")
        .doc(recipeId)
        .collection("ratings")
        .get();

      for (const doc of ratingsQuery.docs) {
        batch.delete(doc.ref);
        deleteCount++;
      }

      // Delete any top-level ratings that reference this recipe
      const topLevelRatingsQuery = await db
        .collection("ratings")
        .where("sharedRecipeId", "==", recipeId)
        .get();

      for (const doc of topLevelRatingsQuery.docs) {
        batch.delete(doc.ref);
        deleteCount++;
      }

      // Commit all deletes
      if (deleteCount > 0) {
        await batch.commit();
        console.log(
          `Successfully deleted ${deleteCount} subcollection ` +
          `document(s) for sharedRecipeId: ${recipeId}`
        );
      }

      return null;
    } catch (error) {
      console.error(
        `Error deleting subcollections for sharedRecipeId: ${recipeId}`,
        error
      );
      return null;
    }
  }
);
