import admin from 'firebase-admin';
import { recipeGenLimiter } from '../lib/rate-limiter.js';

// Initialize Firebase Admin (only once)
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

const db = admin.firestore();

async function getUserContext(uid) {
  const userDoc = await db.collection('users').doc(uid).get();
  if (!userDoc.exists) {
    throw new Error('User not found');
  }

  const preferences = userDoc.get('preferences') || {};
  const invSnap = await db
    .collection('users')
    .doc(uid)
    .collection('ingredients')
    .get();

  const inventory = invSnap.docs.map((d) => ({
    id: d.id,
    ...d.data(),
  }));

  return { preferences, inventory };
}

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // STEP 1: Apply rate limiting
  try {
    await new Promise((resolve, reject) => {
      recipeGenLimiter(req, res, (result) => {
        if (result instanceof Error) {
          return reject(result);
        }
        resolve(result);
      });
    });
  } catch (rateLimitError) {
    return;
  }

  try {
    // STEP 2: Verify Firebase auth token
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized - No token provided' });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await admin.auth().verifyIdToken(token);
    const uid = decodedToken.uid;

    console.log('User authenticated:', uid);

    // Gather user data
    const { preferences, inventory } = await getUserContext(uid);
    const diet = preferences?.diet || 'none';
    const religion = preferences?.religion || preferences?.religiousPreference || 'none';
    const caloriePlan = preferences?.caloriePlan || 'none';
    const allergies = preferences?.allergies || [];

    const model = req.body?.model || 'llama-3.1-8b-instant';

    // Log the preferences being used
    console.log('User preferences:', {
      diet,
      religion,
      caloriePlan,
      allergies: allergies.length > 0 ? allergies : 'none'
    });

    // Improved prompt with stricter formatting requirements and Culina's personality
    const allergyText = allergies.length > 0 ? allergies.join(', ') : 'none';

    // Extract just ingredient names for clearer prompt
    const availableIngredients = inventory.map(item => item.name || item.ingredient).filter(Boolean);

    // Define dietary restrictions explicitly
    const getDietaryRestrictions = (dietType) => {
      const restrictions = {
        'vegetarian': {
          forbidden: ['meat', 'beef', 'pork', 'lamb', 'chicken', 'turkey', 'duck', 'goose', 'venison', 'sausage', 'bacon', 'ham', 'salami', 'fish', 'salmon', 'tuna', 'cod', 'shrimp', 'crab', 'lobster', 'shellfish', 'seafood', 'anchovies', 'prosciutto', 'pepperoni', 'chorizo', 'mutton', 'veal'],
          definition: 'NO MEAT, NO POULTRY, NO FISH, NO SEAFOOD of any kind'
        },
        'vegan': {
          forbidden: ['meat', 'beef', 'pork', 'lamb', 'chicken', 'turkey', 'duck', 'fish', 'salmon', 'tuna', 'shrimp', 'crab', 'lobster', 'shellfish', 'seafood', 'eggs', 'milk', 'cheese', 'butter', 'cream', 'yogurt', 'dairy', 'honey', 'gelatin', 'whey', 'casein', 'anchovies'],
          definition: 'NO ANIMAL PRODUCTS whatsoever - no meat, no poultry, no fish, no seafood, no eggs, no dairy, no honey'
        },
        'pescatarian': {
          forbidden: ['meat', 'beef', 'pork', 'lamb', 'chicken', 'turkey', 'duck', 'goose', 'venison', 'sausage', 'bacon', 'ham', 'salami', 'prosciutto', 'pepperoni', 'chorizo', 'mutton', 'veal', 'poultry'],
          definition: 'NO MEAT and NO POULTRY - fish and seafood are allowed, but absolutely NO beef, pork, chicken, lamb, or any land animal meat'
        },
        'keto': {
          forbidden: ['rice', 'bread', 'pasta', 'flour', 'potato', 'corn', 'oats', 'wheat', 'sugar', 'honey', 'quinoa', 'barley', 'noodles'],
          definition: 'NO HIGH-CARB foods - avoid grains, starches, sugars, most fruits'
        },
        'paleo': {
          forbidden: ['bread', 'pasta', 'rice', 'beans', 'lentils', 'dairy', 'cheese', 'milk', 'yogurt', 'peanuts', 'soy', 'tofu', 'processed'],
          definition: 'NO GRAINS, NO LEGUMES, NO DAIRY, NO PROCESSED FOODS'
        },
        'low-carb': {
          forbidden: ['rice', 'bread', 'pasta', 'flour', 'potato', 'corn', 'sugar', 'honey', 'quinoa', 'noodles'],
          definition: 'MINIMIZE CARBOHYDRATES - avoid grains, starches, sugars'
        },
        'gluten-free': {
          forbidden: ['wheat', 'bread', 'pasta', 'flour', 'barley', 'rye', 'couscous', 'soy sauce', 'seitan'],
          definition: 'NO GLUTEN - avoid wheat, barley, rye, and their derivatives'
        }
      };
      return restrictions[dietType] || null;
    };

    const dietRestriction = getDietaryRestrictions(diet);
    let dietInstructions = '- No specific dietary restrictions';

    if (dietRestriction) {
      const forbiddenList = dietRestriction.forbidden.join(', ');
      dietInstructions = `- CRITICAL DIETARY RESTRICTION: ${diet.toUpperCase()}
  ${dietRestriction.definition}
  ABSOLUTELY FORBIDDEN INGREDIENTS: ${forbiddenList}
  If ANY ingredient from the forbidden list appears in the available ingredients, DO NOT USE IT in any recipe`;
    }

    // Define religious dietary restrictions
    const getReligiousRestrictions = (religionType) => {
      const restrictions = {
        'halal': {
          forbidden: ['pork', 'bacon', 'ham', 'sausage', 'pepperoni', 'prosciutto', 'lard', 'alcohol', 'wine', 'beer', 'liquor', 'gelatin'],
          definition: 'NO PORK, NO ALCOHOL - all meat must be halal certified'
        },
        'kosher': {
          forbidden: ['pork', 'bacon', 'ham', 'shellfish', 'shrimp', 'crab', 'lobster', 'mixing meat and dairy'],
          definition: 'NO PORK, NO SHELLFISH, NO MIXING MEAT AND DAIRY'
        },
        'hindu': {
          forbidden: ['beef', 'cow', 'veal', 'steak'],
          definition: 'NO BEEF or cow-derived products'
        },
        'buddhist': {
          forbidden: ['meat', 'beef', 'pork', 'lamb', 'chicken', 'turkey', 'fish', 'seafood'],
          definition: 'VEGETARIAN - no meat, poultry, fish, or seafood'
        }
      };
      return restrictions[religionType] || null;
    };

    const religiousRestriction = getReligiousRestrictions(religion);
    let religiousInstructions = '- No religious dietary restrictions';

    if (religiousRestriction) {
      const forbiddenList = religiousRestriction.forbidden.join(', ');
      religiousInstructions = `- CRITICAL RELIGIOUS RESTRICTION: ${religion.toUpperCase()}
  ${religiousRestriction.definition}
  ABSOLUTELY FORBIDDEN INGREDIENTS: ${forbiddenList}`;
    }

    const prompt = `
You are Culina 🍳, a cheerful, confident, and supportive AI kitchen companion who absolutely LOVES cooking!

Your personality when creating recipes:
- Be warm, friendly, and encouraging like a helpful friend in the kitchen
- Use natural, human-like tone with light emojis (🥕🔥🍋🧅🧄), but not overwhelming
- Make users feel excited about cooking with what they have
- Sound confident but approachable - like a skilled home chef, not a fancy restaurant

Create as many different and varied recipes as possible using ONLY the ingredients available.

AVAILABLE INGREDIENTS:
${availableIngredients.join(', ')}

DIETARY REQUIREMENTS:
${dietInstructions}
${religiousInstructions}
- Allergies: ${allergyText}
- Calorie Plan: ${caloriePlan}

CRITICAL RULES - MUST FOLLOW:
1. Use ONLY ingredients from the available list - DO NOT add or suggest ANY ingredients not listed
2. Each recipe MUST use different combinations of available ingredients
3. Each recipe MUST have a unique cooking style, cuisine, or approach
4. STRICTLY respect all dietary restrictions and allergies
5. If dietary restriction forbids an ingredient, NEVER use it even if available

REQUIRED JSON FORMAT (return ONLY valid JSON, no other text):
{
  "recipes": [
    {
      "title": "Recipe name with emoji",
      "description": "One engaging sentence about the dish",
      "prepTime": "X mins",
      "cookTime": "X mins",
      "servings": 4,
      "difficulty": "Easy",
      "calories": 250,
      "tags": ["tag1", "tag2"],
      "ingredients": [
        {
          "name": "ingredient name exactly as listed in available ingredients",
          "qty": "2",
          "unit": "cups"
        }
      ],
      "instructions": [
        "Step 1...",
        "Step 2..."
      ]
    }
  ]
}

CRITICAL JSON FORMATTING RULES:
- "qty" field must ALWAYS be a STRING in quotes (correct: "2", "1", "0.5" | wrong: 2, 1 cup)
- "unit" field must ALWAYS be a STRING in quotes (correct: "cups", "tablespoons" | wrong: cups without quotes)
- "unit" field must ONLY use these allowed values: "g", "kg", "cups", "tbsp", "tsp", "ml", "l", "oz", "lb", "pieces", "slices", "cloves", "bunches", "cans", "bottles"
- DO NOT use any other units like "heads", "juice", "whole", "medium", "large", etc.
- "servings" must be a NUMBER without quotes
- "calories" must be a NUMBER without quotes
- ALL other fields must be STRINGS in quotes
- Never write unquoted text after numbers (wrong: 1 cup | correct: "qty": "1", "unit": "cup")

Generate 3-5 diverse recipes that showcase different cooking methods, flavors, and meal types (breakfast, lunch, dinner, snacks). Be creative but ONLY use available ingredients!`;

    console.log('Calling Groq API...');

    const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.GROQ_API_KEY?.trim()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.8, // Increased for more variety and creativity
        max_tokens: 6000, // Allow for more recipes
        response_format: { type: 'json_object' },
      }),
    });

    if (!groqResponse.ok) {
      const errorText = await groqResponse.text();
      console.error('Groq API error:', errorText);
      console.error('Groq response status:', groqResponse.status);
      
      // Try to parse the error to get more details
      try {
        const errorJson = JSON.parse(errorText);
        const errorMessage = errorJson?.error?.message || errorText;
        throw new Error(`Groq API error: ${errorMessage}`);
      } catch (parseError) {
        throw new Error(`Groq API error (${groqResponse.status}): ${errorText}`);
      }
    }

    const json = await groqResponse.json();
    const content = json?.choices?.[0]?.message?.content ?? '';

    console.log('Raw Groq response:', content.substring(0, 500));

    let parsedData;
    try {
      parsedData = JSON.parse(content);
    } catch (e) {
      console.error('JSON parse error:', e);
      console.error('Content that failed to parse:', content);
      throw new Error('Invalid JSON response from AI model');
    }

    // Validate the response structure
    if (!parsedData.recipes || !Array.isArray(parsedData.recipes)) {
      console.error('Invalid response structure:', parsedData);
      throw new Error('AI model did not return recipes array');
    }

    const recipes = parsedData.recipes;

    // Log what we got
    console.log(`AI returned ${recipes.length} recipes`);
    
    // Create a set of available ingredient names for quick lookup (case-insensitive)
    const availableIngredientsSet = new Set(
      inventory.map(item => (item.name || item.ingredient || '').toLowerCase().trim())
    );

    // Define allowed unit types
    const allowedUnits = new Set([
      'g', 'kg', 'cups', 'tbsp', 'tsp', 'ml', 'l', 'oz', 'lb',
      'pieces', 'slices', 'cloves', 'bunches', 'cans', 'bottles', ''
    ]);

    // Get forbidden ingredients for the user's diet and religion
    const forbiddenIngredients = dietRestriction ? dietRestriction.forbidden : [];
    const religiousForbidden = religiousRestriction ? religiousRestriction.forbidden : [];
    const allForbidden = [...forbiddenIngredients, ...religiousForbidden];

    // Validate and fix units in recipes
    const validRecipes = recipes.filter(recipe => {
      // Check basic structure
      const hasValidStructure = recipe.title &&
                                recipe.description &&
                                Array.isArray(recipe.ingredients) &&
                                Array.isArray(recipe.instructions) &&
                                recipe.ingredients.length > 0 &&
                                recipe.instructions.length > 0;

      if (!hasValidStructure) {
        console.log(`Recipe "${recipe.title}" failed structure validation`);
        return false;
      }

      // Fix/validate ingredient units
      recipe.ingredients = recipe.ingredients.map(ing => {
        const unit = (ing.unit || '').toLowerCase().trim();

        // If unit is not in allowed list, try to map it or remove it
        if (!allowedUnits.has(unit)) {
          console.log(`Recipe "${recipe.title}": Invalid unit "${unit}" for ingredient "${ing.name}". Attempting to fix...`);

          // Try to map common variations to allowed units
          const unitMappings = {
            'head': 'pieces',
            'heads': 'pieces',
            'whole': 'pieces',
            'medium': 'pieces',
            'large': 'pieces',
            'small': 'pieces',
            'tablespoons': 'tbsp',
            'tablespoon': 'tbsp',
            'teaspoons': 'tsp',
            'teaspoon': 'tsp',
            'cup': 'cups',
            'grams': 'g',
            'gram': 'g',
            'kilograms': 'kg',
            'kilogram': 'kg',
            'ounces': 'oz',
            'ounce': 'oz',
            'pounds': 'lb',
            'pound': 'lb',
            'milliliters': 'ml',
            'milliliter': 'ml',
            'liters': 'l',
            'liter': 'l',
            'slice': 'slices',
            'clove': 'cloves',
            'bunch': 'bunches',
            'can': 'cans',
            'bottle': 'bottles',
            'piece': 'pieces',
            'juice': 'ml',
            'zest': 'tsp',
            'pinch': 'tsp',
            'dash': 'tsp',
          };

          const mappedUnit = unitMappings[unit] || 'pieces';
          console.log(`Mapped "${unit}" to "${mappedUnit}"`);

          return {
            ...ing,
            unit: mappedUnit
          };
        }

        return ing;
      });

      // Check if all ingredients are in inventory
      const missingIngredients = recipe.ingredients.filter(ing => {
        const ingredientName = (ing.name || '').toLowerCase().trim();
        return !availableIngredientsSet.has(ingredientName);
      });

      if (missingIngredients.length > 0) {
        console.log(`Recipe "${recipe.title}" uses unavailable ingredients:`,
                    missingIngredients.map(i => i.name).join(', '));
        return false;
      }

      // Check if recipe violates dietary or religious restrictions
      if (allForbidden.length > 0) {
        const violatingIngredients = recipe.ingredients.filter(ing => {
          const ingredientName = (ing.name || '').toLowerCase().trim();
          // Check if ingredient name contains any forbidden term
          return allForbidden.some(forbidden =>
            ingredientName.includes(forbidden.toLowerCase())
          );
        });

        if (violatingIngredients.length > 0) {
          const restrictionType = diet !== 'none' ? diet : religion;
          console.log(`Recipe "${recipe.title}" violates ${restrictionType} restriction. Contains forbidden ingredients:`,
                      violatingIngredients.map(i => i.name).join(', '));
          return false;
        }

        // Also check recipe title and description for forbidden terms (catch things like "Chicken Salad")
        const recipeText = `${recipe.title} ${recipe.description}`.toLowerCase();
        const titleViolations = allForbidden.filter(forbidden =>
          recipeText.includes(forbidden.toLowerCase())
        );

        if (titleViolations.length > 0) {
          const restrictionType = diet !== 'none' ? diet : religion;
          console.log(`Recipe "${recipe.title}" title/description contains forbidden terms for ${restrictionType} restriction:`,
                      titleViolations.join(', '));
          return false;
        }
      }

      // Check if recipe violates allergy restrictions
      if (allergies.length > 0) {
        const allergyViolations = recipe.ingredients.filter(ing => {
          const ingredientName = (ing.name || '').toLowerCase().trim();
          return allergies.some(allergen =>
            ingredientName.includes(allergen.toLowerCase())
          );
        });

        if (allergyViolations.length > 0) {
          console.log(`Recipe "${recipe.title}" contains allergen:`,
                      allergyViolations.map(i => i.name).join(', '));
          return false;
        }
      }

      return true;
    });

    console.log(`${validRecipes.length} valid recipes after filtering`);

    // Remove duplicate recipes based on similarity
    const deduplicatedRecipes = [];
    const seenTitles = new Set();
    const seenIngredientSets = new Set();

    for (const recipe of validRecipes) {
      // Normalize title for comparison
      const normalizedTitle = recipe.title.toLowerCase().trim();

      // Create a signature from ingredients (sorted to catch reordered duplicates)
      const ingredientSignature = recipe.ingredients
        .map(ing => (ing.name || '').toLowerCase().trim())
        .sort()
        .join('|');

      // Check if this is a duplicate based on title or ingredients
      const isTitleDuplicate = seenTitles.has(normalizedTitle);
      const isIngredientDuplicate = seenIngredientSets.has(ingredientSignature);

      // Also check for very similar titles (e.g., "Tomato Pasta" vs "Pasta with Tomatoes")
      const isSimilarTitle = Array.from(seenTitles).some(existingTitle => {
        const titleWords = normalizedTitle.split(/\s+/);
        const existingWords = existingTitle.split(/\s+/);
        const commonWords = titleWords.filter(word => existingWords.includes(word) && word.length > 3);
        // If they share 70% or more of meaningful words, consider them similar
        return commonWords.length >= Math.min(titleWords.length, existingWords.length) * 0.7;
      });

      if (!isTitleDuplicate && !isIngredientDuplicate && !isSimilarTitle) {
        deduplicatedRecipes.push(recipe);
        seenTitles.add(normalizedTitle);
        seenIngredientSets.add(ingredientSignature);
      } else {
        console.log(`Recipe "${recipe.title}" filtered out as duplicate/similar`);
      }
    }

    console.log(`${deduplicatedRecipes.length} unique recipes after deduplication`);

    // Return error only if we have zero recipes
    if (deduplicatedRecipes.length === 0) {
      console.error('No valid recipes could be generated');
      throw new Error('Unable to generate recipes with the available ingredients and dietary restrictions. Try adding more ingredients to your pantry.');
    }

    console.log(`Successfully generated ${deduplicatedRecipes.length} unique recipes`);
    return res.status(200).json({ recipes: deduplicatedRecipes });

  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({
      error: error.message || 'Failed to generate recipes',
    });
  }
};