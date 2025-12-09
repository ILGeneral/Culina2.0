/**
 * Culina App Color Palette
 *
 * Primary: Blue - Brand identity, navigation, primary actions
 * Secondary: Orange - Food-centric, action CTAs, featured content
 * Tertiary: Yellow - Ratings, highlights, premium features
 * Accent: Green - Success states, fresh ingredients
 */

export const Colors = {
  // Primary - Blue
  primary: {
    main: '#128AFA',
    light: '#60A5FA',
    lighter: '#BFDBFE',
    lightest: '#EFF6FF',
    dark: '#0284C7',
    darker: '#1E40AF',
  },

  // Secondary - Orange
  secondary: {
    main: '#FF6B35',
    light: '#FF8C61',
    lighter: '#FFAD8D',
    lightest: '#FFEDD5',
    dark: '#F97316',
    darker: '#EA580C',
  },

  // Tertiary - Yellow
  tertiary: {
    main: '#FBBF24',
    light: '#FCD34D',
    lighter: '#FDE68A',
    lightest: '#FEF3C7',
    dark: '#F59E0B',
    darker: '#D97706',
  },

  // Accent - Green
  accent: {
    success: '#10B981',
    successLight: '#34D399',
    successLighter: '#6EE7B7',
    successLightest: '#D1FAE5',
    successDark: '#059669',
    successDarker: '#047857',
  },

  // Warning 
  error: {
    main: '#EF4444',
    light: '#F87171',
    lighter: '#FCA5A5',
    lightest: '#FEE2E2',
    dark: '#DC2626',
    darker: '#B91C1C',
  },

  warning: {
    main: '#F59E0B',
    light: '#FBBF24',
    lighter: '#FCD34D',
    lightest: '#FEF3C7',
    dark: '#D97706',
    darker: '#92400E',
  },

  // Shades
  neutral: {
    white: '#FFFFFF',
    lightest: '#F8FAFC',
    lighter: '#F1F5F9',
    light: '#E2E8F0',
    gray: '#CBD5E1',
    medium: '#94A3B8',
    dark: '#64748B',
    darker: '#475569',
    darkest: '#334155',
    almostBlack: '#1E293B',
    black: '#0F172A',
  },

  // Misc
  extra: {
    purple: '#8B5CF6',
    purpleLight: '#A78BFA',
    purpleLightest: '#EDE9FE',

    pink: '#F472B6',
    pinkLight: '#F9A8D4',
    pinkLightest: '#FCE7F3',

    teal: '#14B8A6',
    tealLight: '#2DD4BF',
    tealLightest: '#CCFBF1',

    coral: '#FF7A59',
    coralLight: '#FF9F85',
    coralLightest: '#FFE4E1',
  },

  // Food Category Colors
  food: {
    // Desserts & Sweets
    dessert: '#F472B6',
    dessertBg: '#FCE7F3',

    // Savory & Meals
    savory: '#FF6B35',
    savoryBg: '#FFEDD5',

    // Healthy & Fresh
    healthy: '#10B981',
    healthyBg: '#D1FAE5',

    // Beverages
    beverage: '#14B8A6',
    beverageBg: '#CCFBF1',

    // Baked Goods
    baked: '#D97706',
    bakedBg: '#FEF3C7',
  },

  // Opacity Variants (for overlays)
  overlay: {
    dark10: 'rgba(15, 23, 42, 0.1)',
    dark20: 'rgba(15, 23, 42, 0.2)',
    dark30: 'rgba(15, 23, 42, 0.3)',
    dark40: 'rgba(15, 23, 42, 0.4)',
    dark50: 'rgba(15, 23, 42, 0.5)',
    dark60: 'rgba(15, 23, 42, 0.6)',
    dark70: 'rgba(15, 23, 42, 0.7)',
    dark80: 'rgba(15, 23, 42, 0.8)',
    dark90: 'rgba(15, 23, 42, 0.9)',

    white10: 'rgba(255, 255, 255, 0.1)',
    white20: 'rgba(255, 255, 255, 0.2)',
    white30: 'rgba(255, 255, 255, 0.3)',
    white50: 'rgba(255, 255, 255, 0.5)',
    white70: 'rgba(255, 255, 255, 0.7)',
    white90: 'rgba(255, 255, 255, 0.9)',
  },
};

// Legacy color mappings (for backwards compatibility during migration)
export const LegacyColors = {
  blue: Colors.primary.main,
  orange: Colors.secondary.main,
  yellow: Colors.tertiary.main,
  green: Colors.accent.success,
  red: Colors.error.main,
  white: Colors.neutral.white,
  black: Colors.neutral.black,
};

export default Colors;
