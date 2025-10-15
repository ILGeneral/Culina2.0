export * from "./recipe";

export type InventoryItem = {
  id: string;
  name: string;
  quantity: number;
  unit?: string;
  imageUrl?: string;
  updatedAt?: any;
};

export type UserPreferences = {
  dietaryPreference?: string;
  religiousPreference?: string;
  caloriePlan?: string;
};
