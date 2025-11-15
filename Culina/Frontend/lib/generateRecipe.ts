import { getAuth } from "firebase/auth";
import type { Recipe } from "@/types/recipe";

const API_BASE = 'https://culina-backend.vercel.app/api';

interface GenerateRecipePayload {
  model: string;
  ingredients: string[];
  preferences: string[];
}

type GenerateRecipesResponse = {
  recipes: Recipe[];
};

// API-allowed units - strict validation from generate-recipe.js prompt
const API_ALLOWED_UNITS = [
  "g", "kg", "cups", "tbsp", "tsp", "ml", "l", "oz", "lb",
  "pieces", "slices", "cloves", "bunches", "cans", "bottles"
];

// Extended units for parsing 
const KNOWN_UNITS = [
  "teaspoon",
  "teaspoons",
  "tsp",
  "tablespoon",
  "tablespoons",
  "tbsp",
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
  "kilogram",
  "kilograms",
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
  "piece",
  "pieces",
  "bunch",
  "bunches",
  "can",
  "cans",
  "bottle",
  "bottles",
  "stick",
  "sticks",
  "package",
  "packages",
  "pkg",
  "bag",
  "bags",
  "head",
  "heads",
];

const normalizeToken = (token: string) => token.replace(/[()",:]/g, "").toLowerCase();

const isNumericToken = (token: string) => /^\d+(?:\.\d+)?$/.test(token);
const isFractionToken = (token: string) => /^\d+\/\d+$/.test(token);

// Validates and normalizes unit to API-allowed format
const validateAndNormalizeUnit = (unit: string | undefined): string | undefined => {
  if (!unit) return undefined;

  const normalized = unit.toLowerCase().trim();

  // If already in allowed format, return as-is
  if (API_ALLOWED_UNITS.includes(normalized)) {
    return normalized;
  }

  // Map common variations to API-allowed units
  const unitMappings: Record<string, string> = {
    'teaspoon': 'tsp',
    'teaspoons': 'tsp',
    'tablespoon': 'tbsp',
    'tablespoons': 'tbsp',
    'cup': 'cups',
    'gram': 'g',
    'grams': 'g',
    'kilogram': 'kg',
    'kilograms': 'kg',
    'ounce': 'oz',
    'ounces': 'oz',
    'pound': 'lb',
    'pounds': 'lb',
    'lbs': 'lb',
    'milliliter': 'ml',
    'milliliters': 'ml',
    'liter': 'l',
    'liters': 'l',
    'slice': 'slices',
    'clove': 'cloves',
    'bunch': 'bunches',
    'can': 'cans',
    'bottle': 'bottles',
    'piece': 'pieces',
    'head': 'pieces', // API doesn't allow 'head', map to 'pieces'
    'heads': 'pieces',
    'stick': 'pieces',
    'sticks': 'pieces',
    'package': 'pieces',
    'packages': 'pieces',
    'pkg': 'pieces',
    'bag': 'pieces',
    'bags': 'pieces',
    'pinch': 'tsp', // Approximate conversion
    'dash': 'tsp',
  };

  return unitMappings[normalized] || 'pieces'; // Default to 'pieces' for unknown units
};

const normalizeIngredientEntry = (entry: unknown): { name: string; qty?: string; unit?: string } => {
  if (entry && typeof entry === "object" && "name" in entry) {
    const item = entry as {
      name?: string;
      qty?: string | number | null;
      quantity?: string | number | null;
      unit?: string | null;
      unitType?: string | null;
    };
    const name = (item.name ?? "").trim();
    const rawQty = item.qty ?? item.quantity;
    const qty = rawQty === null || rawQty === undefined ? undefined : String(rawQty).trim();
    const rawUnit = item.unit ?? item.unitType;
    const validatedUnit = validateAndNormalizeUnit(
      rawUnit === null || rawUnit === undefined ? undefined : String(rawUnit).trim()
    );
    return {
      name,
      ...(qty ? { qty } : {}),
      ...(validatedUnit ? { unit: validatedUnit } : {}),
    };
  }

  if (typeof entry !== "string") {
    return { name: String(entry ?? "").trim() };
  }

  const raw = entry.replace(/\s+/g, " ").trim();
  if (!raw) return { name: "" };

  const tokens = raw.split(/[–—-]/);
  if (tokens.length > 1) {
    const before = tokens[0]?.trim();
    const after = tokens.slice(1).join("-").trim();
    if (before && after) {
      const afterTokens = after.split(/\s+/);
      const qtyTokens: string[] = [];
      const mutable = [...afterTokens];

      if (mutable.length && (isNumericToken(mutable[0]) || isFractionToken(mutable[0]))) {
        qtyTokens.push(mutable.shift()!);
        if (
          mutable.length &&
          isFractionToken(mutable[0]) &&
          qtyTokens.length === 1 &&
          isNumericToken(qtyTokens[0])
        ) {
          qtyTokens.push(mutable.shift()!);
        }
      }

      let unitToken: string | undefined;
      if (mutable.length) {
        const candidate = normalizeToken(mutable[0]);
        if (KNOWN_UNITS.includes(candidate)) {
          unitToken = mutable.shift();
        } else if (mutable.length > 1) {
          const combined = `${candidate} ${normalizeToken(mutable[1])}`;
          if (KNOWN_UNITS.includes(combined)) {
            unitToken = `${mutable.shift()} ${mutable.shift()}`;
          }
        }
      }

      const name = before;
      const validatedUnit = validateAndNormalizeUnit(unitToken);

      return {
        name,
        ...(qtyTokens.length ? { qty: qtyTokens.join(" ") } : {}),
        ...(validatedUnit ? { unit: validatedUnit } : {}),
      };
    }
  }

  return { name: raw };
};

const normalizeRecipeData = (recipe: Recipe): Recipe => {
  const normalizedIngredients = Array.isArray(recipe.ingredients)
    ? recipe.ingredients
        .map((entry) => normalizeIngredientEntry(entry))
        .filter((item) => item.name.length > 0)
    : [];

  const normalizedInstructions = Array.isArray(recipe.instructions)
    ? recipe.instructions
        .map((step) => (typeof step === "string" ? step.trim() : String(step ?? "").trim()))
        .filter(Boolean)
    : recipe.instructions;

  return {
    ...recipe,
    ingredients: normalizedIngredients,
    ...(normalizedInstructions ? { instructions: normalizedInstructions } : {}),
  };
};

export const generateRecipe = async (
  ingredients: string[],
  preferences: string[] = []
): Promise<GenerateRecipesResponse> => {

  try {
    // Get Firebase Auth token
    const auth = getAuth();
    const user = auth.currentUser;
    
    if (!user) {
      throw new Error('Not authenticated - please log in');
    }
    
    console.log('Getting auth token...');
    const token = await user.getIdToken();
    console.log('Token obtained');
    
    console.log('Calling backend API...');
    console.log('Ingredients:', ingredients);
    console.log('Preferences:', preferences);
    
    // Call Vercel backend API with updated model
    const payload: GenerateRecipePayload = {
      model: 'llama-3.1-8b-instant',
      ingredients,
      preferences,
    };

    const response = await fetch(`${API_BASE}/generate-recipe`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(payload),
    });

    console.log(' Response status:', response.status);
    
    const responseText = await response.text();
    console.log(' Raw response:', responseText.substring(0, 200));

    if (!response.ok) {
      throw new Error(`Backend error (${response.status}): ${responseText}`);
    }

    let data: unknown;
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      console.error('Failed to parse response as JSON:', responseText);
      throw new Error('Backend returned invalid JSON');
    }

    const normalized = normalizeResponse(data);

    console.log(" Recipes generated:", normalized.recipes.length);

    return normalized;
  } catch (err: any) {
    console.error(" Recipe generation failed:", err);
    console.error("Error message:", err.message);
    throw err;
  }
};

const normalizeResponse = (data: unknown): GenerateRecipesResponse => {
  if (typeof data !== 'object' || data === null) {
    throw new Error('Backend returned unexpected payload');
  }

  // Check if backend returned a single recipe object
  const maybeSingleRecipe = (data as { recipe?: unknown }).recipe;
  if (maybeSingleRecipe && typeof maybeSingleRecipe === 'object') {
    console.log('Backend returned single recipe, wrapping in array');
    return { recipes: [maybeSingleRecipe as Recipe] };
  }

  // Check if backend returned recipes array
  const maybeRecipes = (data as { recipes?: unknown }).recipes;
  if (!Array.isArray(maybeRecipes)) {
    throw new Error('Backend did not return recipes array');
  }

  if (maybeRecipes.length === 0) {
    throw new Error('Backend returned empty recipes array');
  }
  console.log(`Received ${maybeRecipes.length} recipe(s)`);

  const normalizedRecipes = maybeRecipes
    .map((item) => normalizeRecipeData(item as Recipe))
    .filter((item) => Array.isArray(item.ingredients) && item.ingredients.length > 0);

  return { recipes: normalizedRecipes };
};