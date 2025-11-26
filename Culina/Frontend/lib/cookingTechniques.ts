/**
 * Cooking Techniques Guide
 * Provides detailed information about common cooking techniques
 */

export type TechniqueGuide = {
  id: string;
  title: string;
  description: string;
  icon: string;
  tips: string[];
  difficulty: 'Easy' | 'Medium' | 'Hard';
  keywords: string[]; // For detection in instruction text
  videoUrl?: string; // Optional YouTube or video link
};

export const COOKING_TECHNIQUES: Record<string, TechniqueGuide> = {
  dice: {
    id: 'dice',
    title: 'How to Dice',
    description: 'Cut ingredients into small, uniform cubes (typically 1/4 to 1/2 inch)',
    icon: '🔪',
    difficulty: 'Easy',
    keywords: ['dice', 'diced', 'dicing', 'cube', 'cubed'],
    tips: [
      'Keep your fingers curled in a claw grip',
      'Use a sharp knife for clean cuts',
      'Make consistent-sized pieces for even cooking',
      'Cut lengthwise first, then crosswise',
    ],
  },
  chop: {
    id: 'chop',
    title: 'How to Chop',
    description: 'Cut ingredients into irregular, rough pieces',
    icon: '🔪',
    difficulty: 'Easy',
    keywords: ['chop', 'chopped', 'chopping'],
    tips: [
      'Hold knife firmly with your dominant hand',
      'Use rocking motion with the blade',
      'No need for uniform size',
      'Quick and efficient for rustic dishes',
    ],
  },
  mince: {
    id: 'mince',
    title: 'How to Mince',
    description: 'Cut ingredients into very fine pieces, smaller than diced',
    icon: '🔪',
    difficulty: 'Medium',
    keywords: ['mince', 'minced', 'mincing', 'finely chop'],
    tips: [
      'Rock the knife back and forth repeatedly',
      'Keep the tip of the knife on the cutting board',
      'Gather ingredients periodically and continue cutting',
      'Perfect for garlic, ginger, and herbs',
    ],
  },
  julienne: {
    id: 'julienne',
    title: 'How to Julienne',
    description: 'Cut vegetables into thin, matchstick-like strips',
    icon: '🥕',
    difficulty: 'Medium',
    keywords: ['julienne', 'matchstick', 'strips'],
    tips: [
      'Cut ingredient into rectangular blocks first',
      'Slice into thin planks (1/8 inch)',
      'Stack planks and cut into thin strips',
      'Great for stir-fries and salads',
    ],
  },
  sauté: {
    id: 'sauté',
    title: 'How to Sauté',
    description: 'Cook quickly in a small amount of oil or butter over medium-high heat',
    icon: '🍳',
    difficulty: 'Easy',
    keywords: ['sauté', 'sautéed', 'sautéing', 'pan fry'],
    tips: [
      'Preheat the pan before adding oil',
      'Use medium-high to high heat',
      'Keep food moving in the pan',
      'Don\'t overcrowd - cook in batches if needed',
      'Pat ingredients dry for better browning',
    ],
  },
  simmer: {
    id: 'simmer',
    title: 'How to Simmer',
    description: 'Cook liquid at a temperature just below boiling (180-205°F)',
    icon: '🫕',
    difficulty: 'Easy',
    keywords: ['simmer', 'simmering', 'gently boil'],
    tips: [
      'Look for small bubbles rising to surface',
      'Lower heat if it starts to boil vigorously',
      'Perfect for soups, stews, and sauces',
      'Allows flavors to meld without evaporating too quickly',
    ],
  },
  boil: {
    id: 'boil',
    title: 'How to Boil',
    description: 'Cook in rapidly bubbling water at 212°F (100°C)',
    icon: '💧',
    difficulty: 'Easy',
    keywords: ['boil', 'boiling', 'boiled'],
    tips: [
      'Use high heat to reach boiling point',
      'Look for rapid, rolling bubbles',
      'Salt water after it boils for faster heating',
      'Cover pot to boil faster',
      'Reduce to simmer after boiling if needed',
    ],
  },
  roast: {
    id: 'roast',
    title: 'How to Roast',
    description: 'Cook with dry heat in an oven, typically at high temperature',
    icon: '🔥',
    difficulty: 'Easy',
    keywords: ['roast', 'roasted', 'roasting', 'bake'],
    tips: [
      'Preheat oven to recommended temperature',
      'Use a roasting pan or baking sheet',
      'Space ingredients apart for even browning',
      'Flip halfway through for even cooking',
      'Higher heat (400-450°F) for vegetables and meats',
    ],
  },
  grill: {
    id: 'grill',
    title: 'How to Grill',
    description: 'Cook over direct heat on a grill',
    icon: '🔥',
    difficulty: 'Medium',
    keywords: ['grill', 'grilled', 'grilling', 'bbq', 'barbecue'],
    tips: [
      'Preheat grill for 10-15 minutes',
      'Oil the grates to prevent sticking',
      'Create heat zones (hot and cool)',
      'Don\'t flip too often - let it develop char',
      'Use a meat thermometer for doneness',
    ],
  },
  blanch: {
    id: 'blanch',
    title: 'How to Blanch',
    description: 'Briefly boil ingredients then plunge into ice water',
    icon: '💧',
    difficulty: 'Easy',
    keywords: ['blanch', 'blanched', 'blanching', 'parboil'],
    tips: [
      'Bring a large pot of salted water to boil',
      'Prepare ice bath in a large bowl',
      'Boil vegetables for 1-3 minutes only',
      'Immediately transfer to ice bath',
      'Drain and pat dry before using',
    ],
  },
  braise: {
    id: 'braise',
    title: 'How to Braise',
    description: 'Sear then cook slowly in liquid in a covered pot',
    icon: '🍲',
    difficulty: 'Medium',
    keywords: ['braise', 'braised', 'braising'],
    tips: [
      'Sear meat on all sides first',
      'Use flavorful liquid (stock, wine, etc.)',
      'Keep pot covered while cooking',
      'Cook low and slow (300-325°F)',
      'Perfect for tough cuts of meat',
    ],
  },
  sear: {
    id: 'sear',
    title: 'How to Sear',
    description: 'Brown the surface of food quickly over very high heat',
    icon: '🔥',
    difficulty: 'Medium',
    keywords: ['sear', 'seared', 'searing', 'brown'],
    tips: [
      'Pat food completely dry before searing',
      'Use high heat and wait for pan to smoke slightly',
      'Don\'t move food once placed in pan',
      'Sear until golden brown crust forms',
      'Let meat rest after searing',
    ],
  },
  steam: {
    id: 'steam',
    title: 'How to Steam',
    description: 'Cook with hot steam from boiling water',
    icon: '♨️',
    difficulty: 'Easy',
    keywords: ['steam', 'steamed', 'steaming'],
    tips: [
      'Use a steamer basket or bamboo steamer',
      'Don\'t let water touch the food',
      'Keep lid on to trap steam',
      'Check water level periodically',
      'Retains nutrients and natural flavors',
    ],
  },
  whisk: {
    id: 'whisk',
    title: 'How to Whisk',
    description: 'Beat or stir with a whisk to incorporate air',
    icon: '🥄',
    difficulty: 'Easy',
    keywords: ['whisk', 'whisked', 'whisking', 'beat', 'whip'],
    tips: [
      'Use circular or figure-8 motion',
      'Lift whisk to incorporate air',
      'Tilt bowl slightly for easier whisking',
      'Continue until desired consistency',
      'Perfect for eggs, cream, and sauces',
    ],
  },
  fold: {
    id: 'fold',
    title: 'How to Fold',
    description: 'Gently combine ingredients without deflating',
    icon: '🥄',
    difficulty: 'Medium',
    keywords: ['fold', 'folded', 'folding', 'fold in'],
    tips: [
      'Use a rubber spatula or large spoon',
      'Cut down through center, scrape along bottom',
      'Bring spatula up along side and fold over',
      'Rotate bowl and repeat gently',
      'Stop when just combined - don\'t overmix',
    ],
  },
  deglaze: {
    id: 'deglaze',
    title: 'How to Deglaze',
    description: 'Add liquid to dissolve browned bits from pan bottom',
    icon: '🍷',
    difficulty: 'Easy',
    keywords: ['deglaze', 'deglazed', 'deglazing'],
    tips: [
      'Remove meat from pan after searing',
      'Add wine, stock, or water while pan is hot',
      'Scrape bottom with wooden spoon',
      'Simmer to reduce and concentrate flavors',
      'Creates the base for amazing pan sauces',
    ],
  },
  emulsify: {
    id: 'emulsify',
    title: 'How to Emulsify',
    description: 'Combine two liquids that normally don\'t mix (oil and water)',
    icon: '🥗',
    difficulty: 'Hard',
    keywords: ['emulsify', 'emulsified', 'emulsifying', 'combine'],
    tips: [
      'Add oil very slowly while whisking constantly',
      'Start with egg yolk or mustard as emulsifier',
      'Keep all ingredients at room temperature',
      'If it breaks, start over with fresh yolk',
      'Perfect for mayonnaise and vinaigrettes',
    ],
  },
};

/**
 * Detect cooking techniques in instruction text
 */
export const detectTechniques = (instruction: string): TechniqueGuide[] => {
  const lowerInstruction = instruction.toLowerCase();
  const detected: TechniqueGuide[] = [];

  Object.values(COOKING_TECHNIQUES).forEach((technique) => {
    const found = technique.keywords.some((keyword) =>
      lowerInstruction.includes(keyword.toLowerCase())
    );

    if (found) {
      detected.push(technique);
    }
  });

  return detected;
};

/**
 * Get technique by ID
 */
export const getTechniqueById = (id: string): TechniqueGuide | undefined => {
  return COOKING_TECHNIQUES[id];
};
