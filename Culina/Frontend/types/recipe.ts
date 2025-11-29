export interface Recipe {
  title: string;
  description?: string;
  ingredients: (string | { name: string; qty?: string; unit?: string })[];
  instructions: string[]; // always generates 4-8 steps
  servings: number; //  provides servings
  estimatedCalories: number; // Required - AI always calculates calories
  prepTime: string; // e.g., "10 mins"
  cookTime: string; // e.g., "15 mins"
  difficulty: 'Easy' | 'Medium' | 'Hard';
  cuisine?: string;
  tags: string[]; // AI generates 3-4 tags: [meal-type, cooking-style, dietary-attribute]
  equipment?: string[]; // Array of equipment names from EQUIPMENT_DB
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