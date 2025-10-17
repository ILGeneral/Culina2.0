export interface Recipe {
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
  updatedAt?: any;
  isShared?: boolean;
  userId?: string;
  userRecipeId?: string;
  sharedAt?: any;
  source?: string; // Added for recipe generator
}

export interface SharedRecipe extends Recipe {
  id: string;
  userId: string;
  userRecipeId: string;
  sharedAt: any;
}

export interface SavedRecipe extends Recipe {
  id: string;
  isShared?: boolean;
}