/**
 * Unit conversion utilities for ingredient quantity comparison
 */

// Base units for different measurement types
export type MeasurementType = 'volume' | 'weight' | 'count' | 'unknown';

// Convert everything to base units (ml for volume, grams for weight)
const VOLUME_TO_ML: Record<string, number> = {
  // Metric
  ml: 1,
  milliliter: 1,
  milliliters: 1,
  l: 1000,
  liter: 1000,
  liters: 1000,

  // US
  tsp: 4.92892,
  teaspoon: 4.92892,
  teaspoons: 4.92892,
  tbsp: 14.7868,
  tablespoon: 14.7868,
  tablespoons: 14.7868,
  'fl oz': 29.5735,
  'fluid ounce': 29.5735,
  'fluid ounces': 29.5735,
  cup: 236.588,
  cups: 236.588,
  pint: 473.176,
  pints: 473.176,
  quart: 946.353,
  quarts: 946.353,
  gallon: 3785.41,
  gallons: 3785.41,

  // Common cooking terms
  dash: 0.616115,
  pinch: 0.308058,
  drop: 0.051343,
};

const WEIGHT_TO_GRAMS: Record<string, number> = {
  // Metric
  g: 1,
  gram: 1,
  grams: 1,
  kg: 1000,
  kilogram: 1000,
  kilograms: 1000,
  mg: 0.001,
  milligram: 0.001,
  milligrams: 0.001,

  // Imperial
  oz: 28.3495,
  ounce: 28.3495,
  ounces: 28.3495,
  lb: 453.592,
  lbs: 453.592,
  pound: 453.592,
  pounds: 453.592,
};

const COUNT_UNITS = new Set([
  'piece',
  'pieces',
  'item',
  'items',
  'whole',
  'unit',
  'units',
  'count',
  'each',
  'clove',
  'cloves',
  'slice',
  'slices',
  'leaf',
  'leaves',
  'sprig',
  'sprigs',
  'stalk',
  'stalks',
  'head',
  'heads',
  'can',
  'cans',
  'jar',
  'jars',
  'package',
  'packages',
  'bag',
  'bags',
  'box',
  'boxes',
]);

export function getMeasurementType(unit: string): MeasurementType {
  const normalized = unit.toLowerCase().trim();

  if (VOLUME_TO_ML[normalized] !== undefined) {
    return 'volume';
  }
  if (WEIGHT_TO_GRAMS[normalized] !== undefined) {
    return 'weight';
  }
  if (COUNT_UNITS.has(normalized) || normalized === '') {
    return 'count';
  }
  return 'unknown';
}

export function normalizeUnit(unit: string): string {
  return unit.toLowerCase().trim().replace(/\.$/, '');
}

export function convertToBaseUnit(quantity: number, unit: string): { value: number; type: MeasurementType } {
  const normalized = normalizeUnit(unit);

  if (VOLUME_TO_ML[normalized] !== undefined) {
    return { value: quantity * VOLUME_TO_ML[normalized], type: 'volume' };
  }

  if (WEIGHT_TO_GRAMS[normalized] !== undefined) {
    return { value: quantity * WEIGHT_TO_GRAMS[normalized], type: 'weight' };
  }

  // For count or unknown, just return the quantity as-is
  return { value: quantity, type: COUNT_UNITS.has(normalized) || normalized === '' ? 'count' : 'unknown' };
}

export function canCompareUnits(unit1: string, unit2: string): boolean {
  const type1 = getMeasurementType(unit1);
  const type2 = getMeasurementType(unit2);

  // Can compare if both are the same type and not unknown
  return type1 === type2 && type1 !== 'unknown';
}

export function compareQuantities(
  have: { quantity: number; unit: string },
  need: { quantity: number; unit: string }
): { hasEnough: boolean; percentage: number; comparable: boolean } {
  const comparable = canCompareUnits(have.unit, need.unit);

  if (!comparable) {
    // Can't compare different measurement types
    return { hasEnough: false, percentage: 0, comparable: false };
  }

  const haveBase = convertToBaseUnit(have.quantity, have.unit);
  const needBase = convertToBaseUnit(need.quantity, need.unit);

  if (haveBase.type !== needBase.type) {
    return { hasEnough: false, percentage: 0, comparable: false };
  }

  const percentage = Math.round((haveBase.value / needBase.value) * 100);
  const hasEnough = haveBase.value >= needBase.value;

  return { hasEnough, percentage, comparable: true };
}
