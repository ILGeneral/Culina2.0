export type RecipeSourceLabel = "AI Generated" | "AI - Edited" | "Human";

export const normalizeRecipeSource = (raw?: string | null): RecipeSourceLabel => {
  if (!raw) {
    return "Human";
  }

  const normalized = raw.trim().toLowerCase();
  if (!normalized) {
    return "Human";
  }

  if (normalized.includes("edited")) {
    return "AI - Edited";
  }

  if (normalized.includes("ai")) {
    return "AI Generated";
  }

  return "Human";
};

export const isAISource = (raw?: string | null): boolean => {
  const normalized = normalizeRecipeSource(raw);
  return normalized === "AI Generated" || normalized === "AI - Edited";
};
