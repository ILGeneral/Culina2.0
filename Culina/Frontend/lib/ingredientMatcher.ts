import type { Ingredient } from "@/hooks/useInventory";
import { compareQuantities, normalizeUnit } from "./unitConversion";

const INGREDIENT_STOP_WORDS = [
  "tsp",
  "teaspoon",
  "teaspoons",
  "tbsp",
  "tablespoon",
  "tablespoons",
  "cup",
  "cups",
  "ounce",
  "ounces",
  "oz",
  "pound",
  "pounds",
  "lb",
  "lbs",
  "gram",
  "grams",
  "g",
  "kg",
  "milliliter",
  "milliliters",
  "ml",
  "liter",
  "liters",
  "l",
  "pinch",
  "dash",
  "clove",
  "cloves",
  "slice",
  "slices",
  "diced",
  "minced",
  "chopped",
  "fresh",
  "large",
  "small",
  "medium",
  "extra",
  "virgin",
  "boneless",
  "skinless",
  "optional",
  "taste",
  "ground",
  "crushed",
  "peeled",
  "ripe",
  "finely",
  "roughly",
  "softened",
  "room",
  "temperature",
  "cooked",
  "uncooked",
  "packaged",
  "for",
  "serving",
  "and",
  "or",
  "with",
  "of",
  "to",
  "the",
  "a",
  "an",
];

export type ParsedIngredient = {
  original: string;
  name: string;
  quantity: number;
  unit: string;
};

/**
 * Extract quantity and unit from ingredient string
 * Examples:
 *   "2 cups flour" -> { quantity: 2, unit: "cups", name: "flour" }
 *   "1/2 tsp salt" -> { quantity: 0.5, unit: "tsp", name: "salt" }
 *   "3-4 tomatoes" -> { quantity: 3, unit: "", name: "tomatoes" }
 */
export function parseIngredient(ingredientString: string): ParsedIngredient {
  const original = ingredientString.trim();
  let text = original.toLowerCase();

  // Remove parenthetical content
  text = text.replace(/\([^)]*\)/g, " ");

  // Try to extract quantity (handles fractions, decimals, ranges)
  let quantity = 1; // Default to 1 if no quantity found
  let unit = "";
  let name = text;

  // Match patterns like "2", "1.5", "1/2", "2-3", "1 1/2"
  const qtyPattern = /^(\d+(?:\.\d+)?(?:\s*[-–—]\s*\d+(?:\.\d+)?)?(?:\s+\d+\/\d+)?|\d+\/\d+)/;
  const match = text.match(qtyPattern);

  if (match) {
    const qtyStr = match[1];
    // Handle ranges: take the first number
    if (qtyStr.includes('-') || qtyStr.includes('–') || qtyStr.includes('—')) {
      const firstNum = qtyStr.split(/[-–—]/)[0].trim();
      quantity = parseFloat(firstNum);
    }
    // Handle fractions like "1/2" or "1 1/2"
    else if (qtyStr.includes('/')) {
      const parts = qtyStr.split(/\s+/);
      let total = 0;
      for (const part of parts) {
        if (part.includes('/')) {
          const [num, denom] = part.split('/').map(parseFloat);
          total += num / denom;
        } else {
          total += parseFloat(part);
        }
      }
      quantity = total;
    } else {
      quantity = parseFloat(qtyStr);
    }

    // Remove the quantity from the text
    text = text.slice(match[0].length).trim();
  }

  // Try to extract unit (first word after quantity)
  const words = text.split(/\s+/);
  if (words.length > 0) {
    const firstWord = words[0];
    // Check if first word is a known unit
    const normalizedFirst = normalizeUnit(firstWord);
    if (
      normalizedFirst &&
      (normalizedFirst.match(/^(ml|l|g|kg|oz|lb|cup|tsp|tbsp|pint|quart|gallon)s?$/i) ||
        INGREDIENT_STOP_WORDS.includes(normalizedFirst))
    ) {
      unit = normalizedFirst;
      // Remove unit from text
      words.shift();
      text = words.join(" ");
    }
  }

  // Normalize the ingredient name (remove stop words, clean up)
  let cleanName = text;
  cleanName = cleanName.replace(/\([^)]*\)/g, " ");
  cleanName = cleanName.replace(/[-–—]/g, " ");

  INGREDIENT_STOP_WORDS.forEach((word) => {
    const pattern = new RegExp(`\\b${word}\\b`, "g");
    cleanName = cleanName.replace(pattern, " ");
  });

  cleanName = cleanName.replace(/\s+/g, " ").trim();

  return {
    original,
    name: cleanName || text, // Fallback to original text if cleaning removed everything
    quantity,
    unit,
  };
}

export type IngredientMatch = {
  status: 'full' | 'partial' | 'none';
  inventoryItem?: Ingredient;
  hasEnough: boolean;
  percentage: number; // How much of the needed quantity you have (0-100+)
  comparable: boolean; // Whether units can be compared
};

/**
 * Check if inventory contains the ingredient with sufficient quantity
 */
export function matchIngredientWithInventory(
  recipeIngredient: string,
  inventory: Ingredient[]
): IngredientMatch {
  const parsed = parseIngredient(recipeIngredient);

  // Find matching ingredient in inventory by name
  const match = inventory.find((item) => {
    const inventoryName = item.name.toLowerCase().trim();
    const recipeName = parsed.name.toLowerCase().trim();

    // Check if names match (exact or one contains the other)
    return (
      inventoryName === recipeName ||
      inventoryName.includes(recipeName) ||
      recipeName.includes(inventoryName)
    );
  });

  if (!match) {
    return {
      status: 'none',
      hasEnough: false,
      percentage: 0,
      comparable: false,
    };
  }

  // Compare quantities
  const comparison = compareQuantities(
    { quantity: match.quantity, unit: match.unit },
    { quantity: parsed.quantity, unit: parsed.unit }
  );

  if (!comparison.comparable) {
    // Units can't be compared, but ingredient exists
    return {
      status: 'partial',
      inventoryItem: match,
      hasEnough: false,
      percentage: 50, // Assume partial match when units don't match
      comparable: false,
    };
  }

  return {
    status: comparison.hasEnough ? 'full' : 'partial',
    inventoryItem: match,
    hasEnough: comparison.hasEnough,
    percentage: comparison.percentage,
    comparable: true,
  };
}

export type RecipeMatchResult = {
  fullMatches: string[]; // Ingredients you have enough of
  partialMatches: Array<{ ingredient: string; percentage: number; inventoryItem: Ingredient }>; // Ingredients you have but not enough
  missingIngredients: string[]; // Ingredients you don't have at all
  matchScore: number; // 0-100, weighted score
  totalIngredients: number;
};

/**
 * Match all recipe ingredients against inventory
 */
export function matchRecipeWithInventory(
  recipeIngredients: string[],
  inventory: Ingredient[]
): RecipeMatchResult {
  const fullMatches: string[] = [];
  const partialMatches: Array<{ ingredient: string; percentage: number; inventoryItem: Ingredient }> = [];
  const missingIngredients: string[] = [];

  recipeIngredients.forEach((ingredient) => {
    const match = matchIngredientWithInventory(ingredient, inventory);

    if (match.status === 'full') {
      fullMatches.push(ingredient);
    } else if (match.status === 'partial' && match.inventoryItem) {
      partialMatches.push({
        ingredient,
        percentage: match.percentage,
        inventoryItem: match.inventoryItem,
      });
    } else {
      missingIngredients.push(ingredient);
    }
  });

  // Calculate weighted match score
  // Full matches: 100% weight
  // Partial matches: weighted by percentage
  // Missing: 0% weight
  const totalIngredients = recipeIngredients.length;
  const fullMatchScore = (fullMatches.length / totalIngredients) * 100;
  const partialMatchScore =
    (partialMatches.reduce((sum, pm) => sum + pm.percentage, 0) / totalIngredients / 100) * 100;

  const matchScore = Math.round(fullMatchScore + partialMatchScore);

  return {
    fullMatches,
    partialMatches,
    missingIngredients,
    matchScore,
    totalIngredients,
  };
}
