import { getAuth } from "firebase/auth";
import type { Ingredient } from "@/hooks/useInventory";

const API_BASE = "https://culina-backend.vercel.app/api";

export type IngredientSubstitute = {
  ingredient: string;
  reason: string;
  inInventory: boolean;
};

export type SuggestIngredientSubstitutesPayload = {
  recipeTitle: string;
  recipeDescription?: string;
  targetIngredient: string;
  inventory: Ingredient[];
  model?: string;
};

export type SuggestIngredientSubstitutesResponse = {
  targetIngredient: string;
  suggestions: IngredientSubstitute[];
  hasResults: boolean;
};

export const suggestIngredientSubstitutes = async (
  payload: SuggestIngredientSubstitutesPayload
): Promise<SuggestIngredientSubstitutesResponse> => {
  const { targetIngredient } = payload;

  if (!targetIngredient || typeof targetIngredient !== "string" || !targetIngredient.trim()) {
    throw new Error("Please select an ingredient to find substitutes for.");
  }

  const auth = getAuth();
  const user = auth.currentUser;
  if (!user) {
    throw new Error("Not authenticated - please log in");
  }

  const token = await user.getIdToken();
  const body = JSON.stringify(payload);

  const response = await fetch(`${API_BASE}/suggest-ingredient-substitutes`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body,
  });

  const text = await response.text();

  if (!response.ok) {
    let message = "Failed to request ingredient substitutes";
    try {
      const parsed = JSON.parse(text);
      if (parsed?.error && typeof parsed.error === "string") {
        message = parsed.error;
      }
    } catch {
      if (text) {
        message = text;
      }
    }
    throw new Error(message);
  }

  try {
    const parsed = JSON.parse(text) as SuggestIngredientSubstitutesResponse;
    if (typeof parsed?.targetIngredient !== "string" || !Array.isArray(parsed?.suggestions)) {
      throw new Error("Server returned invalid substitutes data");
    }
    return parsed;
  } catch (error) {
    throw new Error(
      error instanceof Error ? error.message : "Unable to parse substitutes response"
    );
  }
};
