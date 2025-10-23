export type MealDbIngredient = {
  name: string;
  type?: string | null;
  description?: string | null;
};

let allIngredients: MealDbIngredient[] | null = null;
let listPromise: Promise<MealDbIngredient[]> | null = null;

const normalizeName = (value: string | null | undefined) => (value ?? "").trim();

const loadIngredientList = async (): Promise<MealDbIngredient[]> => {
  if (allIngredients) {
    return allIngredients;
  }

  if (!listPromise) {
    listPromise = fetch("https://www.themealdb.com/api/json/v1/1/list.php?i=list")
      .then(async (response) => {
        if (!response.ok) {
          console.warn("MealDB ingredient list failed", response.status, response.statusText);
          return [] as MealDbIngredient[];
        }

        const data = await response.json();
        const items = Array.isArray(data?.meals) ? data.meals : [];

        const normalized = items
          .map((item: any) => {
            const name = normalizeName(item?.strIngredient)
              .replace(/\s+/g, " ")
              .trim();
            if (!name) return null;
            return {
              name,
              type: normalizeName(item?.strType) || null,
              description: normalizeName(item?.strDescription) || null,
            } as MealDbIngredient;
          })
          .filter(Boolean) as MealDbIngredient[];

        const uniqueByName = new Map<string, MealDbIngredient>();
        normalized.forEach((ingredient) => {
          const key = ingredient.name.toLowerCase();
          if (!uniqueByName.has(key)) {
            uniqueByName.set(key, ingredient);
          }
        });

        allIngredients = Array.from(uniqueByName.values());
        return allIngredients;
      })
      .catch((error) => {
        console.warn("MealDB ingredient list error", error);
        return [] as MealDbIngredient[];
      })
      .finally(() => {
        listPromise = null;
      });
  }

  return listPromise ?? Promise.resolve(allIngredients ?? []);
};

export const hasMealDbIngredientsLoaded = () => Array.isArray(allIngredients) && allIngredients.length > 0;

export const prefetchMealDbIngredients = async () => {
  try {
    await loadIngredientList();
  } catch (error) {
    console.warn("MealDB ingredient prefetch error", error);
  }
};

export const searchMealDbIngredients = async (
  query: string,
  limit = 8
): Promise<MealDbIngredient[]> => {
  const trimmed = query.trim();
  if (trimmed.length < 2) {
    return [];
  }

  const normalizedLimit = Math.max(limit, 4);

  const list = await loadIngredientList();
  if (!list.length) {
    return [];
  }

  const q = trimmed.toLowerCase();
  const scoreIngredient = (name: string) => {
    const lower = name.toLowerCase();
    let score = 0;

    if (lower === q) score += 400;
    if (lower.startsWith(q)) {
      score += 260 - Math.min(lower.length - q.length, 40);
    }

    const words = lower.split(/\s+/);
    words.forEach((word, idx) => {
      if (word.startsWith(q)) {
        score += 180 - idx * 10;
      }
    });

    const index = lower.indexOf(q);
    if (index !== -1) {
      score += 140 - Math.min(index, 60);
    }

    if (lower.charAt(0) === q.charAt(0)) {
      score += 50;
    }

    const uniqueChars = new Set(q);
    uniqueChars.forEach((char) => {
      if (lower.includes(char)) {
        score += 3;
      }
    });

    score -= Math.max(0, lower.length - q.length) * 0.5;
    return score;
  };

  const scoredList: { item: MealDbIngredient; score: number }[] = list.map((item: MealDbIngredient) => ({
    item,
    score: scoreIngredient(item.name),
  }));

  const ranked = scoredList
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, normalizedLimit)
    .map((entry) => entry.item);

  if (ranked.length >= 4 || ranked.length === normalizedLimit) {
    return ranked;
  }

  // Fallback to direct search in case of exact matches missed above
  try {
    const response = await fetch(
      `https://www.themealdb.com/api/json/v1/1/search.php?i=${encodeURIComponent(trimmed)}`
    );
    if (!response.ok) {
      return [];
    }
    const data = await response.json();
    const ingredients = Array.isArray(data?.ingredients) ? data.ingredients : [];
    const fallbackScores: { item: MealDbIngredient; score: number }[] = ingredients
      .map((item: any) => {
        const name = normalizeName(item?.strIngredient);
        if (!name) return null;
        return {
          name,
          type: normalizeName(item?.strType) || null,
          description: normalizeName(item?.strDescription) || null,
        } as MealDbIngredient;
      })
      .filter((entry: MealDbIngredient | null): entry is MealDbIngredient => entry !== null)
      .map((ingredient: MealDbIngredient) => ({
        item: ingredient,
        score: scoreIngredient(ingredient.name),
      }));

    const fallbackRanked = fallbackScores
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((entry) => entry.item);

    if (fallbackRanked.length >= normalizedLimit) {
      return fallbackRanked.slice(0, normalizedLimit);
    }

    const combinedSet = new Map<string, MealDbIngredient>();
    ranked.forEach((item: MealDbIngredient) => combinedSet.set(item.name.toLowerCase(), item));
    fallbackRanked.forEach((item: MealDbIngredient) => {
      const key = item.name.toLowerCase();
      if (!combinedSet.has(key) && combinedSet.size < normalizedLimit) {
        combinedSet.set(key, item);
      }
    });

    if (combinedSet.size < normalizedLimit) {
      list.forEach((item: MealDbIngredient) => {
        const key = item.name.toLowerCase();
        if (!combinedSet.has(key) && scoreIngredient(item.name) > 0 && combinedSet.size < normalizedLimit) {
          combinedSet.set(key, item);
        }
      });
    }

    return Array.from(combinedSet.values()).slice(0, normalizedLimit);
  } catch (error) {
    console.warn("MealDB ingredient fallback error", error);
    return [];
  }
};
