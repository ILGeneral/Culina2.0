export type Recipe = {
  id?: string;
  title: string;
  description?: string;
  ingredients: string[] | { name: string; qty?: string }[];
  instructions: string[];
  servings?: number;
  estimatedCalories?: number;
  source?: string;
  imageUrl?: string;
  createdAt?: any; 
};
