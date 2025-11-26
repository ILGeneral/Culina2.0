import type { Ingredient } from "@/hooks/useInventory";

export type ExpirationStatus = {
  status: 'expired' | 'critical' | 'warning' | 'fresh' | 'unknown';
  color: string;
  backgroundColor: string;
  text: string;
  icon: string;
  daysRemaining: number | null;
};

/**
 * Calculate expiration status for an ingredient
 */
export const getExpirationStatus = (ingredient: Ingredient): ExpirationStatus => {
  if (!ingredient.expirationDate) {
    return {
      status: 'unknown',
      color: '#6B7280',
      backgroundColor: '#F3F4F6',
      text: 'No expiration',
      icon: '',
      daysRemaining: null,
    };
  }

  // Convert Firestore Timestamp to Date if needed
  let expirationDate: Date;
  if (ingredient.expirationDate.toDate) {
    expirationDate = ingredient.expirationDate.toDate();
  } else if (ingredient.expirationDate instanceof Date) {
    expirationDate = ingredient.expirationDate;
  } else {
    expirationDate = new Date(ingredient.expirationDate);
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0); // Reset to start of day
  expirationDate.setHours(0, 0, 0, 0);

  const daysRemaining = Math.ceil(
    (expirationDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (daysRemaining < 0) {
    return {
      status: 'expired',
      color: '#DC2626',
      backgroundColor: '#FEE2E2',
      text: 'Expired',
      icon: '',
      daysRemaining,
    };
  } else if (daysRemaining === 0) {
    return {
      status: 'critical',
      color: '#D97706',
      backgroundColor: '#FEF3C7',
      text: 'Expires today',
      icon: '',
      daysRemaining,
    };
  } else if (daysRemaining <= 3) {
    return {
      status: 'critical',
      color: '#D97706',
      backgroundColor: '#FEF3C7',
      text: `${daysRemaining}d left`,
      icon: '',
      daysRemaining,
    };
  } else if (daysRemaining <= 7) {
    return {
      status: 'warning',
      color: '#CA8A04',
      backgroundColor: '#FEF9C3',
      text: `${daysRemaining}d left`,
      icon: '',
      daysRemaining,
    };
  } else {
    return {
      status: 'fresh',
      color: '#059669',
      backgroundColor: '#D1FAE5',
      text: `${daysRemaining}d left`,
      icon: '',
      daysRemaining,
    };
  }
};

/**
 * Sort ingredients by expiration date (soonest first)
 */
export const sortByExpiration = (ingredients: Ingredient[]): Ingredient[] => {
  return [...ingredients].sort((a, b) => {
    // Items without expiration date go to the end
    if (!a.expirationDate && !b.expirationDate) return 0;
    if (!a.expirationDate) return 1;
    if (!b.expirationDate) return -1;

    // Convert to timestamps for comparison
    const getTimestamp = (date: any): number => {
      if (date.toDate) return date.toDate().getTime();
      if (date instanceof Date) return date.getTime();
      return new Date(date).getTime();
    };

    return getTimestamp(a.expirationDate) - getTimestamp(b.expirationDate);
  });
};

/**
 * Filter ingredients that are expiring soon (within N days)
 */
export const filterExpiringSoon = (
  ingredients: Ingredient[],
  withinDays: number = 7
): Ingredient[] => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return ingredients.filter((ingredient) => {
    if (!ingredient.expirationDate) return false;

    const status = getExpirationStatus(ingredient);
    return (
      status.daysRemaining !== null &&
      status.daysRemaining >= 0 &&
      status.daysRemaining <= withinDays
    );
  });
};

/**
 * Get count of expiring ingredients
 */
export const getExpiringCount = (ingredients: Ingredient[], withinDays: number = 3): number => {
  return filterExpiringSoon(ingredients, withinDays).length;
};

/**
 * Prioritize ingredients for recipe generation
 * Returns ingredients sorted by expiration priority
 */
export const prioritizeIngredientsByExpiration = (ingredients: Ingredient[]) => {
  const sorted = sortByExpiration(ingredients);

  const expiringNext3Days = sorted.filter((item) => {
    const status = getExpirationStatus(item);
    return (
      status.daysRemaining !== null &&
      status.daysRemaining >= 0 &&
      status.daysRemaining <= 3
    );
  });

  const expiringNext7Days = sorted.filter((item) => {
    const status = getExpirationStatus(item);
    return (
      status.daysRemaining !== null &&
      status.daysRemaining > 3 &&
      status.daysRemaining <= 7
    );
  });

  return {
    critical: expiringNext3Days,
    warning: expiringNext7Days,
    allSorted: sorted,
  };
};

/**
 * Format expiration date for display
 */
export const formatExpirationDate = (date: any): string => {
  if (!date) return 'Not set';

  let expirationDate: Date;
  if (date.toDate) {
    expirationDate = date.toDate();
  } else if (date instanceof Date) {
    expirationDate = date;
  } else {
    expirationDate = new Date(date);
  }

  return expirationDate.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};
