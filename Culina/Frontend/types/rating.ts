export interface Rating {
  id?: string;
  recipeId: string;
  sharedRecipeId: string;
  userId: string;
  userName: string;
  userProfilePicture?: string;
  rating: number; // 1-5
  review?: string;
  verified: boolean; // User cooked the recipe
  helpfulCount: number;
  createdAt: any;
  updatedAt: any;
}

export interface RecipeRatingSummary {
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
}
