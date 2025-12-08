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
    const mainIngredient = req.body?.mainIngredient || null;

    // Log the preferences being used
    console.log('User preferences:', {
      diet,
      religion,
      caloriePlan,
      allergies: allergies.length > 0 ? allergies : 'none',
      mainIngredient: mainIngredient || 'none (surprise me)'
    });

    // Stricter formatting reqs and Culina's personality
    const allergyText = allergies.length > 0 ? allergies.join(', ') : 'none';

    // Extract just ingredient names for clearer prompt
    const availableIngredients = inventory.map(item => item.name || item.ingredient).filter(Boolean);

    // Creates inventory context with quantities
    const inventoryContext = inventory.map(item => {
      const name = item.name || item.ingredient;
      const qty = item.quantity || '';
      const unit = item.unit || '';
      return `- ${name}${qty ? ` (${qty} ${unit})` : ''}`;
    }).join('\n');

    // Defines dietary restrictions manually
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
  If ANY ingredient from the forbidden list appears in the available ingredients, treat it as INVISIBLE - DO NOT USE IT in any recipe`;
    }

    // Generate cal plan instructions
    const getCaloriePlanInstructions = (plan) => {
      if (plan === 'none' || !plan) return '';

      const targets = {
        'weight-loss': 'aim for 200-400 calories per serving',
        'low-calorie': 'aim for 200-400 calories per serving',
        'maintenance': 'aim for 350-550 calories per serving',
        'muscle-gain': 'aim for 450-700 calories per serving',
        'high-calorie': 'aim for 450-700 calories per serving',
      };

      const target = targets[plan] || 'aim for balanced calories';

      return `
- Calorie Target: ${plan}
  IMPORTANT: Each recipe's total calories should align with this plan:
  ${target}
  Calculate approximate calories based on standard ingredient nutritional values.`;
    };

    const caloriePlanInstructions = getCaloriePlanInstructions(caloriePlan);

    // Defines religious dietary restrictions
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
You are Culina, a cheerful, confident, and supportive AI kitchen companion who absolutely LOVES cooking!

Your personality when creating recipes:
- Be warm, friendly, and encouraging like a helpful friend in the kitchen
- Use natural, human-like tone with light emojis (🥕🔥🍋🧅🧄), but not overwhelming
- Make users feel excited about cooking with what they have
- Sound confident but approachable - like a skilled home chef, not a fancy restaurant

Create as many different and varied recipes as possible using ONLY the ingredients available.

AVAILABLE INGREDIENTS WITH QUANTITIES:
${inventoryContext}

NOTE: Use reasonable amounts in recipes. If an ingredient has limited quantity, be mindful not to use it all in one recipe.

${mainIngredient ? `MAIN INGREDIENT FOCUS:
The user wants recipes that feature "${mainIngredient}" as the primary/star ingredient.
- Ensure ALL recipes include "${mainIngredient}" prominently
- "${mainIngredient}" should be a central component, not just a minor addition
- Build the recipe concept around showcasing "${mainIngredient}"
- Still maintain diversity in cooking methods and flavors across recipes

` : ''}DIETARY REQUIREMENTS:
${dietInstructions}
${religiousInstructions}
- Allergies: ${allergyText}${caloriePlanInstructions}

ABSOLUTE CRITICAL RULES - ZERO TOLERANCE:

1. AVAILABLE INGREDIENTS ONLY - This is NON-NEGOTIABLE:
   - DO NOT invent, suggest, or assume ANY ingredients not explicitly listed above
   - DO NOT use substitutes or alternatives not in the list
   - DO NOT suggest optional additions
   - If you need an ingredient that isn't available, skip that recipe idea entirely
   - When in doubt about an ingredient, DO NOT include it

2. MAXIMUM DIVERSITY:
   - Never create two recipes with similar ingredient combinations
   - Each recipe must feel distinct in flavor profile and cooking approach
   - Aim for different cuisines/styles across all recipes

3. DIETARY RESTRICTIONS ARE SACRED:
   - If ANY forbidden ingredient appears in available list, treat it as INVISIBLE
   - Double-check title, description, and ingredients for restriction violations
   - When uncertain if ingredient violates restriction, err on side of caution and avoid it

4. INGREDIENT QUANTITY VALIDATION:
   - Ensure ingredient quantities are realistic for the servings specified
   - Standard serving sizes: breakfast 1-2 people, meals 2-4 people, snacks 4-6 people

5. JSON FORMAT COMPLIANCE:
   - Test your JSON mentally before outputting - it must be valid
   - Strings in quotes, numbers without quotes, arrays with brackets
   - No trailing commas, no comments, no extra text outside JSON

VARIETY REQUIREMENTS - MUST ENSURE DIVERSITY:
1. Use different cooking methods across recipes (e.g., one raw/salad, one baked, one sautéed, one boiled)
2. Cover different meal types (breakfast, lunch, dinner, snack, dessert if possible)
3. Vary cuisines (e.g., Asian, Mediterranean, American, Mexican) when ingredients allow
4. Mix preparation complexity (have both quick 10-min recipes and more involved ones)
5. Never generate two recipes with the same primary ingredient focus

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
      "estimatedCalories": 250,
      "tags": ["meal-type", "cooking-style", "dietary-attribute"],
      "ingredients": [
        {
          "name": "ingredient name exactly as listed in available ingredients",
          "qty": "2",
          "unit": "cups"
        }
      ],
      "instructions": [
        "Detailed step with specific technique, temperature, or timing",
        "Each step should be actionable with visual/tactile cues for doneness",
        "Minimum 4 steps, maximum 8 steps per recipe"
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
- "estimatedCalories" must be a NUMBER without quotes
- ALL other fields must be STRINGS in quotes
- Never write unquoted text after numbers (wrong: 1 cup | correct: "qty": "1", "unit": "cup")

TAGS REQUIREMENTS:
- First tag: meal type (breakfast, lunch, dinner, snack, dessert)
- Second tag: preparation style (quick, one-pot, no-cook, baked, grilled, sautéed, etc.)
- Third tag: dietary/health attribute (healthy, comfort-food, high-protein, low-carb, etc.)
- Maximum 4 tags per recipe
- Use lowercase, hyphenated format

TIMING GUIDELINES:
- prepTime: Time for ingredient prep (chopping, measuring, mixing) - realistic estimates
- cookTime: Active cooking/baking time (0 mins for no-cook recipes)
- Total time should be reasonable: most home recipes are 10-45 minutes total
- Quick recipes (breakfast/snacks): aim for 15-20 mins total
- Regular meals: 25-40 mins total
- Complex dishes: up to 60 mins total

INSTRUCTION WRITING RULES:
- Start each step with an action verb (Heat, Chop, Combine, Season, etc.)
- Include specific temperatures when relevant (medium heat, 350°F, etc.)
- Provide visual or tactile cues for doneness (golden brown, fragrant, tender, etc.)
- Keep steps focused on one main action each
- Use encouraging language that builds confidence
- Minimum 4 steps, maximum 8 steps per recipe
- CRITICAL: ONLY mention ingredients that are EXPLICITLY listed in the ingredients array for that recipe
- DO NOT mention any ingredient, seasoning, or component in the instructions that is not in the ingredients list
- If you want to mention salt, pepper, oil, butter, or ANY other ingredient in the instructions, it MUST be in the ingredients array first
- Before writing each instruction step, verify that every ingredient you mention exists in the ingredients array
- NEVER assume "common" ingredients - if it's not in the ingredients list, DO NOT mention it in instructions

EXAMPLE RECIPES (for reference only - DO NOT copy these):

Example 1 - Simple Breakfast:
{
  "title": "Classic Scrambled Eggs 🍳",
  "description": "Fluffy, creamy scrambled eggs that melt in your mouth",
  "prepTime": "5 mins",
  "cookTime": "5 mins",
  "servings": 2,
  "difficulty": "Easy",
  "estimatedCalories": 180,
  "tags": ["breakfast", "quick", "high-protein"],
  "ingredients": [
    {"name": "eggs", "qty": "4", "unit": "pieces"},
    {"name": "butter", "qty": "1", "unit": "tbsp"},
    {"name": "salt", "qty": "0.5", "unit": "tsp"}
  ],
  "instructions": [
    "Crack eggs into a bowl and whisk until well combined and slightly frothy",
    "Heat butter in a non-stick pan over medium-low heat until melted and foaming",
    "Pour eggs into the pan and gently stir with a spatula, creating soft curds",
    "Cook for 3-4 minutes, stirring occasionally until just set but still creamy",
    "Remove from heat immediately and serve while hot and fluffy"
  ]
}

Example 2 - Vegetarian Main:
{
  "title": "Mediterranean Chickpea Salad 🥗",
  "description": "Fresh and zesty salad packed with protein and Mediterranean flavors",
  "prepTime": "10 mins",
  "cookTime": "0 mins",
  "servings": 4,
  "difficulty": "Easy",
  "estimatedCalories": 220,
  "tags": ["lunch", "no-cook", "healthy", "vegetarian"],
  "ingredients": [
    {"name": "chickpeas", "qty": "2", "unit": "cans"},
    {"name": "cucumber", "qty": "1", "unit": "pieces"},
    {"name": "tomato", "qty": "2", "unit": "pieces"},
    {"name": "lemon", "qty": "1", "unit": "pieces"},
    {"name": "olive oil", "qty": "3", "unit": "tbsp"}
  ],
  "instructions": [
    "Drain and rinse chickpeas thoroughly under cold water",
    "Dice cucumber and tomatoes into bite-sized pieces, about 1/2 inch cubes",
    "Combine chickpeas and vegetables in a large bowl",
    "Squeeze fresh lemon juice over the mixture and drizzle with olive oil",
    "Season with salt and pepper, then toss well until everything is evenly coated",
    "Let rest for 5 minutes to allow flavors to meld before serving"
  ]
}

BEFORE YOU RESPOND - VERIFY CHECKLIST:
□ Every ingredient used exists in the AVAILABLE INGREDIENTS list above
□ Zero forbidden ingredients based on dietary/religious restrictions
□ Each recipe has unique ingredients and cooking method
□ All "qty" and "unit" fields are properly quoted strings
□ Units only use allowed values (g, kg, cups, tbsp, tsp, ml, l, oz, lb, pieces, slices, cloves, bunches, cans, bottles)
□ Instructions are detailed, actionable, and encouraging (4-8 steps each)
□ estimatedCalories and servings are numbers without quotes
□ Total time (prep + cook) is reasonable
□ Tags follow the format: [meal-type, cooking-style, dietary-attribute]
□ JSON is valid with no syntax errors
□ CRITICAL: Every ingredient mentioned in instructions appears in the ingredients array - NO EXCEPTIONS
□ Read through each instruction step and verify every mentioned ingredient is in the ingredients list
□ If instructions mention salt, pepper, oil, or any seasoning, they MUST be in the ingredients array

Only output your response if ALL items are checked.

NOW create 3-5 NEW and DIFFERENT recipes following the exact same format. Be creative but ONLY use available ingredients!`;

    console.log('Calling Groq API...');

    // Dynamic temperature based on inventory size
    // Fewer ingredients = less creativity needed to avoid conflicts
    // More ingredients = more creativity to find diverse combinations
    const ingredientCount = inventory.length;
    const temperature = ingredientCount < 5 ? 0.7 :
                       ingredientCount < 10 ? 0.8 : 0.9;

    console.log(`Using temperature ${temperature} for ${ingredientCount} ingredients`);

    // Retry logic with exponential backoff for rate limits
    let groqResponse;
    let retryCount = 0;
    const maxRetries = 3;

    while (retryCount <= maxRetries) {
      try {
        groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.GROQ_API_KEY?.trim()}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model,
            messages: [{ role: 'user', content: prompt }],
            temperature: temperature,
            max_tokens: 5000, // Reduced from 6000 to avoid hitting token limits
            response_format: { type: 'json_object' },
          }),
        });

        // If 429 (rate limit), retry with backoff
        if (groqResponse.status === 429 && retryCount < maxRetries) {
          const errorText = await groqResponse.text();
          console.log(`Rate limit hit (attempt ${retryCount + 1}/${maxRetries}). Retrying...`);

          // Parse retry-after header or wait time from error message
          let waitTime = Math.pow(2, retryCount) * 500; // Exponential backoff: 500ms, 1s, 2s

          try {
            const errorJson = JSON.parse(errorText);
            const errorMsg = errorJson?.error?.message || '';
            // Extract wait time from error message like "Please try again in 370ms"
            const waitMatch = errorMsg.match(/try again in (\d+)ms/);
            if (waitMatch) {
              waitTime = parseInt(waitMatch[1]) + 100; // Add 100ms buffer
            }
          } catch (e) {
            // Use default exponential backoff if parsing fails
          }

          console.log(`Waiting ${waitTime}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
          retryCount++;
          continue; // Retry the request
        }

        // If not 429 or exceeded retries, break the loop
        break;

      } catch (fetchError) {
        console.error('Fetch error:', fetchError);
        throw new Error('Failed to connect to Groq API');
      }
    }

    if (!groqResponse.ok) {
      const errorText = await groqResponse.text();
      console.error('Groq API error:', errorText);
      console.error('Groq response status:', groqResponse.status);

      // Provide user-friendly error messages
      try {
        const errorJson = JSON.parse(errorText);
        const errorMessage = errorJson?.error?.message || errorText;
        const errorType = errorJson?.error?.type;

        if (errorType === 'tokens' || errorMessage.includes('Rate limit')) {
          throw new Error('The AI service is currently busy. Please try again in a few seconds.');
        }

        throw new Error(`Recipe generation failed: ${errorMessage}`);
      } catch (parseError) {
        throw new Error(`Recipe generation failed (${groqResponse.status}). Please try again.`);
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

      // To check if all ingredients are in inventory
      const missingIngredients = recipe.ingredients.filter(ing => {
        const ingredientName = (ing.name || '').toLowerCase().trim();
        return !availableIngredientsSet.has(ingredientName);
      });

      if (missingIngredients.length > 0) {
        console.log(`Recipe "${recipe.title}" uses unavailable ingredients:`,
                    missingIngredients.map(i => i.name).join(', '));
        return false;
      }

      // To check if recipe violates user dietary or religious restrictions
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

        // To also check recipe title and description for forbidden terms (catch things like "Chicken Salad")
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

      // To check if recipe violates allergy restrictions
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

    // To remove duplicate recipes based on similarity
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