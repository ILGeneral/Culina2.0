/**
 * Time Analysis Utility for Recipes
 * Automatically categorizes recipe time into Active (Prep) vs Passive (Cook) time
 */

export type TimeBreakdown = {
  totalMinutes: number;
  activeMinutes: number;  // Hands-on prep time
  passiveMinutes: number; // Unattended cooking time
  breakdown: {
    prep: number;
    activeCooking: number;
    passiveCooking: number;
  };
};

export type StepTimeInfo = {
  stepIndex: number;
  instruction: string;
  estimatedMinutes: number;
  isActive: boolean; // true = needs attention, false = passive
  category: 'prep' | 'active-cook' | 'passive-cook';
};

/**
 * Analyze recipe instructions to determine time breakdown
 */
export function analyzeRecipeTime(
  instructions: string[],
  recipePrepTime?: string,
  recipeCookTime?: string
): TimeBreakdown {
  const stepTimes = instructions.map((instruction, index) =>
    analyzeStepTime(instruction, index)
  );

  // Calculate totals
  const prepTime = stepTimes
    .filter(s => s.category === 'prep')
    .reduce((sum, s) => sum + s.estimatedMinutes, 0);

  const activeCookingTime = stepTimes
    .filter(s => s.category === 'active-cook')
    .reduce((sum, s) => sum + s.estimatedMinutes, 0);

  const passiveCookingTime = stepTimes
    .filter(s => s.category === 'passive-cook')
    .reduce((sum, s) => sum + s.estimatedMinutes, 0);

  const activeMinutes = prepTime + activeCookingTime;
  const passiveMinutes = passiveCookingTime;
  const totalMinutes = activeMinutes + passiveMinutes;

  return {
    totalMinutes,
    activeMinutes,
    passiveMinutes,
    breakdown: {
      prep: prepTime,
      activeCooking: activeCookingTime,
      passiveCooking: passiveCookingTime,
    },
  };
}

/**
 * Analyze a single step to determine time and category
 */
export function analyzeStepTime(instruction: string, stepIndex: number): StepTimeInfo {
  const lowerInstruction = instruction.toLowerCase();

  // Extract explicit time mentions
  const explicitTime = parseTimeFromInstruction(instruction);

  // Determine if step is active or passive
  const category = categorizeStep(lowerInstruction);
  const isActive = category !== 'passive-cook';

  // Estimate time if not explicitly stated
  const estimatedMinutes = explicitTime || estimateStepTime(lowerInstruction, category);

  return {
    stepIndex,
    instruction,
    estimatedMinutes,
    isActive,
    category,
  };
}

/**
 * Parse time duration from instruction text
 */
function parseTimeFromInstruction(instruction: string): number | null {
  // Match patterns like "10 minutes", "1 hour", "30 seconds", "2-3 minutes", "until golden brown (about 5 minutes)"
  const patterns = [
    /(\d+(?:-\d+)?)\s*(minute|min|hour|hr|second|sec)s?/i,
    /for\s+about\s+(\d+)\s*(minute|min|hour|hr)s?/i,
    /approximately\s+(\d+)\s*(minute|min|hour|hr)s?/i,
  ];

  for (const pattern of patterns) {
    const match = instruction.match(pattern);
    if (match) {
      // Handle ranges by taking the average
      const timeValue = match[1].includes('-')
        ? match[1].split('-').map(Number).reduce((a, b) => (a + b) / 2, 0)
        : parseFloat(match[1]);

      const unit = match[2].toLowerCase();

      if (unit.startsWith('hour') || unit === 'hr') {
        return Math.round(timeValue * 60);
      } else if (unit.startsWith('min')) {
        return Math.round(timeValue);
      } else if (unit.startsWith('sec')) {
        return Math.round(timeValue / 60);
      }
    }
  }

  return null;
}

/**
 * Categorize step as prep, active cooking, or passive cooking
 */
function categorizeStep(instruction: string): 'prep' | 'active-cook' | 'passive-cook' {
  // Passive cooking keywords (set it and forget it)
  const passiveKeywords = [
    'bake', 'baking', 'roast', 'roasting',
    'simmer', 'simmering',
    'rest', 'resting', 'sit', 'stand',
    'chill', 'chilling', 'refrigerate', 'freeze',
    'marinate', 'marinating',
    'rise', 'rising', 'proof', 'proofing',
    'cool', 'cooling',
    'slow cook', 'slow cooker',
    'pressure cook',
    'let cook', 'leave to cook',
    'until golden', 'until tender', 'until done',
    'set aside',
  ];

  for (const keyword of passiveKeywords) {
    if (instruction.includes(keyword)) {
      return 'passive-cook';
    }
  }

  // Active cooking keywords (requires attention)
  const activeCookKeywords = [
    'stir', 'stirring', 'stir frequently', 'stir constantly',
    'whisk', 'whisking',
    'flip', 'flipping', 'turn',
    'sauté', 'sautéing',
    'fry', 'frying',
    'scramble', 'scrambling',
    'toss', 'tossing',
    'grill', 'grilling',
    'sear', 'searing',
    'brown', 'browning',
    'reduce', 'reducing',
    'caramelize', 'caramelizing',
    'watch carefully', 'keep an eye',
  ];

  for (const keyword of activeCookKeywords) {
    if (instruction.includes(keyword)) {
      return 'active-cook';
    }
  }

  // Prep keywords (no heat involved)
  const prepKeywords = [
    'chop', 'chopped', 'chopping',
    'dice', 'diced', 'dicing',
    'slice', 'sliced', 'slicing',
    'mince', 'minced', 'mincing',
    'peel', 'peeled', 'peeling',
    'grate', 'grated', 'grating',
    'shred', 'shredded', 'shredding',
    'mix', 'mixing', 'combine',
    'measure', 'measured',
    'prepare', 'preparation',
    'wash', 'rinse', 'drain',
    'beat', 'beating',
    'fold', 'folding',
    'arrange', 'arranging',
    'season', 'seasoning',
    'gather', 'collect',
  ];

  for (const keyword of prepKeywords) {
    if (instruction.includes(keyword)) {
      return 'prep';
    }
  }

  // Default: assume prep if no cooking indicators
  return 'prep';
}

/**
 * Estimate step time based on content (when not explicitly stated)
 */
function estimateStepTime(instruction: string, category: 'prep' | 'active-cook' | 'passive-cook'): number {
  // Default estimates by category
  const defaults = {
    'prep': 3,           // 3 minutes for basic prep
    'active-cook': 5,    // 5 minutes for active cooking
    'passive-cook': 15,  // 15 minutes for passive cooking
  };

  // Check for complexity indicators
  let complexity = 1;

  // Multiple ingredients mentioned = more complex
  const ingredientCount = (instruction.match(/\band\b/gi) || []).length;
  if (ingredientCount > 2) complexity += 0.5;

  // Detailed instructions = more time
  if (instruction.length > 100) complexity += 0.3;

  // Keywords that indicate longer prep
  if (/carefully|finely|thoroughly|completely/i.test(instruction)) {
    complexity += 0.5;
  }

  // Keywords that indicate quick tasks
  if (/quickly|briefly|lightly/i.test(instruction)) {
    complexity -= 0.3;
  }

  return Math.max(1, Math.round(defaults[category] * complexity));
}

/**
 * Format time breakdown for display
 */
export function formatTimeBreakdown(breakdown: TimeBreakdown): {
  total: string;
  active: string;
  passive: string;
  activeLabel: string;
  passiveLabel: string;
} {
  const formatMinutes = (minutes: number): string => {
    if (minutes < 60) {
      return `${minutes} min`;
    }
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  return {
    total: formatMinutes(breakdown.totalMinutes),
    active: formatMinutes(breakdown.activeMinutes),
    passive: formatMinutes(breakdown.passiveMinutes),
    activeLabel: 'Active Time (hands-on)',
    passiveLabel: 'Passive Time (unattended)',
  };
}

/**
 * Get visual representation of time split (for progress bars)
 */
export function getTimeSplitPercentages(breakdown: TimeBreakdown): {
  prepPercent: number;
  activeCookPercent: number;
  passiveCookPercent: number;
} {
  const total = breakdown.totalMinutes || 1;

  return {
    prepPercent: (breakdown.breakdown.prep / total) * 100,
    activeCookPercent: (breakdown.breakdown.activeCooking / total) * 100,
    passiveCookPercent: (breakdown.breakdown.passiveCooking / total) * 100,
  };
}

/**
 * Determine if step needs timer reminder
 */
export function needsTimerReminder(stepInfo: StepTimeInfo): boolean {
  // Passive steps with explicit time should have timer
  return !stepInfo.isActive && stepInfo.estimatedMinutes >= 5;
}
