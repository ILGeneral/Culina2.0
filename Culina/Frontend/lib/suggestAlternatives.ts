import { getAuth } from "firebase/auth";
import type { Ingredient } from "@/hooks/useInventory";

const API_BASE = "https://culina-backend.vercel.app/api";

export type AlternativeRecipe = {
  title: string;
  description?: string;
  ingredients: string[];
  instructions: string[];
};

export type SuggestAlternativesPayload = {
  recipeTitle: string;
  recipeDescription?: string;
  recipeIngredients: string[];
  missingIngredients: string[];
  inventory: Ingredient[];
  model?: string;
};

export type SuggestAlternativesResponse = {
  alternatives: AlternativeRecipe[];
};

export const suggestAlternatives = async (
  payload: SuggestAlternativesPayload
): Promise<SuggestAlternativesResponse> => {
  const { inventory } = payload;
  if (!Array.isArray(inventory) || inventory.length === 0) {
    throw new Error("Add pantry items before requesting alternatives.");
  }

  const auth = getAuth();
  const user = auth.currentUser;
  if (!user) {
    throw new Error("Not authenticated - please log in");
  }

  const token = await user.getIdToken();
  const body = JSON.stringify(payload);

  const response = await fetch(`${API_BASE}/suggest-alternatives`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body,
  });

  const text = await response.text();

  if (!response.ok) {
    let message = "Failed to request alternatives";
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
    const parsed = JSON.parse(text) as SuggestAlternativesResponse;
    if (!Array.isArray(parsed?.alternatives)) {
      throw new Error("Server returned invalid alternatives data");
    }
    return parsed;
  } catch (error) {
    throw new Error(
      error instanceof Error ? error.message : "Unable to parse alternatives response"
    );
  }
};
