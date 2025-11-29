/**
 * Equipment Detection and Management for Cooking Mode
 * Automatically detects required kitchen equipment from recipe instructions
 */

export type Equipment = {
  name: string;
  icon: string;
  category: 'cookware' | 'utensil' | 'appliance' | 'tool';
  isEssential: boolean;
};

export type EquipmentDatabase = {
  [key: string]: Equipment;
};

// Comprehensive equipment database with icons
export const EQUIPMENT_DB: EquipmentDatabase = {
  // Cookware
  'pot': { name: 'Pot', icon: '🍲', category: 'cookware', isEssential: true },
  'pan': { name: 'Pan', icon: '🍳', category: 'cookware', isEssential: true },
  'skillet': { name: 'Skillet', icon: '🍳', category: 'cookware', isEssential: true },
  'saucepan': { name: 'Saucepan', icon: '🍲', category: 'cookware', isEssential: true },
  'baking sheet': { name: 'Baking Sheet', icon: '🍪', category: 'cookware', isEssential: true },
  'baking dish': { name: 'Baking Dish', icon: '🥘', category: 'cookware', isEssential: true },
  'baking pan': { name: 'Baking Pan', icon: '🥘', category: 'cookware', isEssential: true },
  'casserole': { name: 'Casserole Dish', icon: '🥘', category: 'cookware', isEssential: true },
  'dutch oven': { name: 'Dutch Oven', icon: '🍲', category: 'cookware', isEssential: false },
  'wok': { name: 'Wok', icon: '🥘', category: 'cookware', isEssential: false },
  'roasting pan': { name: 'Roasting Pan', icon: '🍗', category: 'cookware', isEssential: false },
  'cake pan': { name: 'Cake Pan', icon: '🎂', category: 'cookware', isEssential: true },
  'muffin tin': { name: 'Muffin Tin', icon: '🧁', category: 'cookware', isEssential: false },
  'loaf pan': { name: 'Loaf Pan', icon: '🍞', category: 'cookware', isEssential: false },
  'springform pan': { name: 'Springform Pan', icon: '🎂', category: 'cookware', isEssential: false },

  // Utensils
  'knife': { name: 'Knife', icon: '🔪', category: 'utensil', isEssential: true },
  'cutting board': { name: 'Cutting Board', icon: '🔲', category: 'utensil', isEssential: true },
  'spatula': { name: 'Spatula', icon: '🥄', category: 'utensil', isEssential: true },
  'spoon': { name: 'Spoon', icon: '🥄', category: 'utensil', isEssential: true },
  'wooden spoon': { name: 'Wooden Spoon', icon: '🥄', category: 'utensil', isEssential: true },
  'whisk': { name: 'Whisk', icon: '🥄', category: 'utensil', isEssential: false },
  'ladle': { name: 'Ladle', icon: '🥄', category: 'utensil', isEssential: false },
  'tongs': { name: 'Tongs', icon: '🥢', category: 'utensil', isEssential: false },
  'peeler': { name: 'Peeler', icon: '🔪', category: 'utensil', isEssential: false },
  'grater': { name: 'Grater', icon: '🧀', category: 'utensil', isEssential: false },
  'masher': { name: 'Masher', icon: '🥔', category: 'utensil', isEssential: false },
  'strainer': { name: 'Strainer', icon: '🥘', category: 'utensil', isEssential: false },
  'colander': { name: 'Colander', icon: '🥘', category: 'utensil', isEssential: false },
  'sieve': { name: 'Sieve', icon: '🥘', category: 'utensil', isEssential: false },

  // Mixing Tools
  'mixing bowl': { name: 'Mixing Bowl', icon: '🥣', category: 'utensil', isEssential: true },
  'bowl': { name: 'Bowl', icon: '🥣', category: 'utensil', isEssential: true },
  'measuring cup': { name: 'Measuring Cup', icon: '🥤', category: 'utensil', isEssential: true },
  'measuring spoon': { name: 'Measuring Spoons', icon: '🥄', category: 'utensil', isEssential: true },

  // Appliances
  'oven': { name: 'Oven', icon: '🔥', category: 'appliance', isEssential: true },
  'stove': { name: 'Stove', icon: '🔥', category: 'appliance', isEssential: true },
  'microwave': { name: 'Microwave', icon: '📻', category: 'appliance', isEssential: false },
  'blender': { name: 'Blender', icon: '🥤', category: 'appliance', isEssential: false },
  'food processor': { name: 'Food Processor', icon: '⚙️', category: 'appliance', isEssential: false },
  'mixer': { name: 'Mixer', icon: '🔄', category: 'appliance', isEssential: false },
  'stand mixer': { name: 'Stand Mixer', icon: '🔄', category: 'appliance', isEssential: false },
  'hand mixer': { name: 'Hand Mixer', icon: '🔄', category: 'appliance', isEssential: false },
  'toaster': { name: 'Toaster', icon: '🍞', category: 'appliance', isEssential: false },
  'grill': { name: 'Grill', icon: '🔥', category: 'appliance', isEssential: false },
  'air fryer': { name: 'Air Fryer', icon: '🍟', category: 'appliance', isEssential: false },
  'slow cooker': { name: 'Slow Cooker', icon: '🍲', category: 'appliance', isEssential: false },
  'instant pot': { name: 'Instant Pot', icon: '🍲', category: 'appliance', isEssential: false },
  'pressure cooker': { name: 'Pressure Cooker', icon: '🍲', category: 'appliance', isEssential: false },

  // Tools
  'thermometer': { name: 'Thermometer', icon: '🌡️', category: 'tool', isEssential: false },
  'timer': { name: 'Timer', icon: '⏱️', category: 'tool', isEssential: false },
  'rolling pin': { name: 'Rolling Pin', icon: '📏', category: 'tool', isEssential: false },
  'pastry brush': { name: 'Pastry Brush', icon: '🖌️', category: 'tool', isEssential: false },
  'can opener': { name: 'Can Opener', icon: '🔓', category: 'tool', isEssential: false },
  'zester': { name: 'Zester', icon: '🍋', category: 'tool', isEssential: false },
  'mortar and pestle': { name: 'Mortar & Pestle', icon: '⚗️', category: 'tool', isEssential: false },
  'piping bag': { name: 'Piping Bag', icon: '💉', category: 'tool', isEssential: false },
  'meat mallet': { name: 'Meat Mallet', icon: '🔨', category: 'tool', isEssential: false },
  'kitchen scale': { name: 'Kitchen Scale', icon: '⚖️', category: 'tool', isEssential: false },
};

/**
 * Detect required equipment from recipe instructions and ingredients
 */
export function detectEquipment(
  instructions: string[],
  ingredients?: Array<string | { name: string }>
): Equipment[] {
  const detectedEquipment = new Set<string>();

  // Combine all text to search
  const allText = [
    ...instructions,
    ...(ingredients || []).map(ing => typeof ing === 'string' ? ing : ing.name)
  ].join(' ').toLowerCase();

  // Search for equipment keywords
  for (const [keyword, equipment] of Object.entries(EQUIPMENT_DB)) {
    // Use word boundaries to avoid false positives
    const regex = new RegExp(`\\b${keyword}\\b`, 'i');
    if (regex.test(allText)) {
      detectedEquipment.add(keyword);
    }
  }

  // Special detection rules for implied equipment

  // If "bake" or "baking" is mentioned, need oven and baking sheet
  if (/\b(bake|baking|baked)\b/i.test(allText)) {
    detectedEquipment.add('oven');
    if (!detectedEquipment.has('baking dish') && !detectedEquipment.has('cake pan')) {
      detectedEquipment.add('baking sheet');
    }
  }

  // If "fry" or "sauté" is mentioned, need pan/skillet
  if (/\b(fry|frying|fried|sauté|sautéed|sauteing)\b/i.test(allText)) {
    if (!detectedEquipment.has('pan') && !detectedEquipment.has('wok')) {
      detectedEquipment.add('skillet');
    }
  }

  // If "boil" or "simmer" is mentioned, need pot
  if (/\b(boil|boiling|boiled|simmer|simmering)\b/i.test(allText)) {
    if (!detectedEquipment.has('pot')) {
      detectedEquipment.add('saucepan');
    }
  }

  // If "chop" or "dice" is mentioned, need knife and cutting board
  if (/\b(chop|chopped|chopping|dice|diced|dicing|slice|sliced|slicing|mince|minced)\b/i.test(allText)) {
    detectedEquipment.add('knife');
    detectedEquipment.add('cutting board');
  }

  // If "mix" or "stir" is mentioned, need mixing bowl and spoon
  if (/\b(mix|mixing|mixed|stir|stirring|stirred|combine|combining)\b/i.test(allText)) {
    detectedEquipment.add('mixing bowl');
    detectedEquipment.add('wooden spoon');
  }

  // If "measure" is mentioned, need measuring cups/spoons
  if (/\b(measure|measured|measuring)\b/i.test(allText) || /\b\d+\s*(cup|tbsp|tsp|tablespoon|teaspoon)\b/i.test(allText)) {
    detectedEquipment.add('measuring cup');
    detectedEquipment.add('measuring spoon');
  }

  // Convert Set to Array of Equipment objects
  return Array.from(detectedEquipment)
    .map(keyword => EQUIPMENT_DB[keyword])
    .filter(Boolean)
    .sort((a, b) => {
      // Sort by: essential first, then by category
      if (a.isEssential !== b.isEssential) {
        return a.isEssential ? -1 : 1;
      }
      return a.category.localeCompare(b.category);
    });
}

/**
 * Get equipment by category
 */
export function groupEquipmentByCategory(equipment: Equipment[]): Record<string, Equipment[]> {
  const grouped: Record<string, Equipment[]> = {
    cookware: [],
    utensil: [],
    appliance: [],
    tool: [],
  };

  equipment.forEach(item => {
    grouped[item.category].push(item);
  });

  return grouped;
}

/**
 * Format equipment list for display
 */
export function formatEquipmentList(equipment: Equipment[]): string {
  if (equipment.length === 0) return 'No specific equipment required';

  const essential = equipment.filter(e => e.isEssential);
  const optional = equipment.filter(e => !e.isEssential);

  let result = '';

  if (essential.length > 0) {
    result += 'Essential:\n' + essential.map(e => `${e.icon} ${e.name}`).join('\n');
  }

  if (optional.length > 0) {
    if (result) result += '\n\n';
    result += 'Optional:\n' + optional.map(e => `${e.icon} ${e.name}`).join('\n');
  }

  return result;
}
