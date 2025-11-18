# Quick Color Reference Card

## 🎨 Most Common Colors

### Primary Actions & Buttons
```typescript
Colors.secondary.main          // #FF6B35 - Orange (Start Cooking, Generate, Send)
Colors.primary.main            // #128AFA - Blue (Navigation, Info)
```

### Success & Errors
```typescript
Colors.accent.success          // #10B981 - Green (Success)
Colors.error.main              // #EF4444 - Red (Error, Delete)
Colors.warning.main            // #F59E0B - Amber (Warning)
```

### Text Colors
```typescript
Colors.neutral.black           // #0F172A - Headings
Colors.neutral.darkest         // #334155 - Body text
Colors.neutral.dark            // #64748B - Secondary text
Colors.neutral.white           // #FFFFFF - Text on dark backgrounds
```

### Backgrounds
```typescript
Colors.neutral.white           // #FFFFFF - Cards
Colors.neutral.lightest        // #F8FAFC - Page backgrounds
Colors.neutral.lighter         // #F1F5F9 - Inactive tabs
Colors.neutral.light           // #E2E8F0 - Borders
```

### Badges & Tags
```typescript
Colors.tertiary.main           // #FBBF24 - Yellow (Stars, Highlights)
Colors.extra.pink              // #F472B6 - Pink (Desserts)
Colors.extra.teal              // #14B8A6 - Teal (Beverages)
Colors.extra.purple            // #8B5CF6 - Purple (Edit, Premium)
```

---

## 🚀 Copy-Paste Examples

### Orange Action Button
```typescript
button: {
  backgroundColor: Colors.secondary.main,
  shadowColor: Colors.secondary.main,
}
```

### Success Message
```typescript
successBox: {
  backgroundColor: Colors.accent.successLightest,
  borderColor: Colors.accent.success,
}
successText: {
  color: Colors.accent.successDark,
}
```

### Error Message
```typescript
errorBox: {
  backgroundColor: Colors.error.lightest,
  borderColor: Colors.error.main,
}
errorText: {
  color: Colors.error.darker,
}
```

### Card Style
```typescript
card: {
  backgroundColor: Colors.neutral.white,
  borderColor: Colors.neutral.light,
  shadowColor: Colors.neutral.black,
}
```

### Difficulty Badges
```typescript
// Easy
easy: {
  backgroundColor: Colors.accent.successLightest,
  color: Colors.accent.successDarker,
}

// Medium
medium: {
  backgroundColor: Colors.warning.lightest,
  color: Colors.warning.darker,
}

// Hard
hard: {
  backgroundColor: Colors.error.lightest,
  color: Colors.error.darker,
}
```

---

## 🎯 Import Statement
```typescript
import { Colors } from '@/constants/colors';
```

---

## 📋 Color Decision Tree

**Need a color?**

1. **Is it an action button?** → `Colors.secondary.main` (Orange)
2. **Is it navigation/info?** → `Colors.primary.main` (Blue)
3. **Is it success/positive?** → `Colors.accent.success` (Green)
4. **Is it error/delete?** → `Colors.error.main` (Red)
5. **Is it warning/caution?** → `Colors.warning.main` (Amber)
6. **Is it a rating/star?** → `Colors.tertiary.main` (Yellow)
7. **Is it text?** → `Colors.neutral.black/darkest/dark`
8. **Is it a background?** → `Colors.neutral.white/lightest/lighter`
9. **Is it a border?** → `Colors.neutral.light`

