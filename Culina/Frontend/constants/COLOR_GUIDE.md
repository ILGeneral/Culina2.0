# Culina App Color System Guide

This guide explains how to use the centralized color system in the Culina app.

## 📁 File Location
`/constants/colors.ts`

---

## 🎨 Color Palette Overview

### **Primary Colors (Blue)**
Brand identity, navigation, primary UI elements

```typescript
Colors.primary.main      // #128AFA - Main brand blue
Colors.primary.light     // #60A5FA - Light blue
Colors.primary.lighter   // #BFDBFE - Lighter blue
Colors.primary.lightest  // #EFF6FF - Very light blue
Colors.primary.dark      // #0284C7 - Dark blue
Colors.primary.darker    // #1E40AF - Darker blue
```

**Usage:**
- Navigation tabs (active state)
- Info badges
- Links and interactive text
- Metric card icons
- Filter chips (active)

---

### **Secondary Colors (Orange)** 🔶
Food-centric, action CTAs, primary action buttons

```typescript
Colors.secondary.main      // #FF6B35 - Main orange
Colors.secondary.light     // #FF8C61 - Light orange
Colors.secondary.lighter   // #FFAD8D - Lighter orange
Colors.secondary.lightest  // #FFEDD5 - Very light orange
Colors.secondary.dark      // #F97316 - Dark orange
Colors.secondary.darker    // #EA580C - Darker orange
```

**Usage:**
- "Start Cooking" button
- "Generate Recipe" button
- Send message button (chatbot)
- Scan ingredients button
- Add ingredient FAB
- Primary action buttons throughout app

---

### **Tertiary Colors (Yellow/Gold)** ⭐
Ratings, highlights, premium features

```typescript
Colors.tertiary.main      // #FBBF24 - Main yellow
Colors.tertiary.light     // #FCD34D - Light yellow
Colors.tertiary.lighter   // #FDE68A - Lighter yellow
Colors.tertiary.lightest  // #FEF3C7 - Very light yellow
Colors.tertiary.dark      // #F59E0B - Dark yellow
Colors.tertiary.darker    // #D97706 - Darker yellow
```

**Usage:**
- Star ratings
- "New" badges
- Trending indicators
- Warning states (medium difficulty)
- Achievement highlights

---

### **Accent Colors (Green)** 🌿
Success states, fresh ingredients, positive feedback

```typescript
Colors.accent.success         // #10B981 - Success green
Colors.accent.successLight    // #34D399 - Light green
Colors.accent.successLighter  // #6EE7B7 - Lighter green
Colors.accent.successLightest // #D1FAE5 - Very light green
Colors.accent.successDark     // #059669 - Dark green
Colors.accent.successDarker   // #047857 - Darker green
```

**Usage:**
- Success messages
- "Easy" difficulty badge
- Healthy recipe tags
- Ingredient availability (high match)
- Completion states
- Save/bookmark confirmation

---

### **Error Colors (Red)** ❌
Error states, delete actions, warnings

```typescript
Colors.error.main      // #EF4444 - Error red
Colors.error.light     // #F87171 - Light red
Colors.error.lighter   // #FCA5A5 - Lighter red
Colors.error.lightest  // #FEE2E2 - Very light red
Colors.error.dark      // #DC2626 - Dark red
Colors.error.darker    // #B91C1C - Darker red
```

**Usage:**
- Error messages
- Delete buttons
- "Hard" difficulty badge
- Low inventory warnings
- Validation errors
- Alert backgrounds

---

### **Warning Colors (Amber)** ⚠️
Warnings, medium states

```typescript
Colors.warning.main      // #F59E0B - Warning amber
Colors.warning.light     // #FBBF24 - Light amber
Colors.warning.lighter   // #FCD34D - Lighter amber
Colors.warning.lightest  // #FEF3C7 - Very light amber
Colors.warning.dark      // #D97706 - Dark amber
Colors.warning.darker    // #92400E - Darker amber
```

**Usage:**
- Warning messages
- "Medium" difficulty badge
- Medium match indicators
- Caution states

---

### **Neutral Colors (Gray Scale)** ⚪
Text, backgrounds, borders, structure

```typescript
Colors.neutral.white       // #FFFFFF - Pure white
Colors.neutral.lightest    // #F8FAFC - Very light gray
Colors.neutral.lighter     // #F1F5F9 - Light gray
Colors.neutral.light       // #E2E8F0 - Gray
Colors.neutral.gray        // #CBD5E1 - Medium light gray
Colors.neutral.medium      // #94A3B8 - Medium gray
Colors.neutral.dark        // #64748B - Dark gray
Colors.neutral.darker      // #475569 - Darker gray
Colors.neutral.darkest     // #334155 - Very dark gray
Colors.neutral.almostBlack // #1E293B - Almost black
Colors.neutral.black       // #0F172A - Near black
```

**Usage:**
- Backgrounds (lightest, lighter, light)
- Body text (darkest, black)
- Secondary text (dark, darker)
- Borders (light, gray)
- Disabled states (medium)
- Shadows (black with opacity)

---

### **Extra/Special Colors** 🎨

#### Purple
```typescript
Colors.extra.purple         // #8B5CF6 - Purple
Colors.extra.purpleLight    // #A78BFA - Light purple
Colors.extra.purpleLightest // #EDE9FE - Very light purple
```
**Usage:** Edit buttons, premium features, special actions

#### Pink
```typescript
Colors.extra.pink         // #F472B6 - Pink
Colors.extra.pinkLight    // #F9A8D4 - Light pink
Colors.extra.pinkLightest // #FCE7F3 - Very light pink
```
**Usage:** Dessert category, favorites, sweet recipe tags

#### Teal
```typescript
Colors.extra.teal         // #14B8A6 - Teal
Colors.extra.tealLight    // #2DD4BF - Light teal
Colors.extra.tealLightest // #CCFBF1 - Very light teal
```
**Usage:** Beverage category, refreshing tags, alternative accent

#### Coral
```typescript
Colors.extra.coral         // #FF7A59 - Coral
Colors.extra.coralLight    // #FF9F85 - Light coral
Colors.extra.coralLightest // #FFE4E1 - Very light coral
```
**Usage:** Featured recipes, user-generated content, warm accents

---

### **Food Category Colors** 🍽️

Quick reference for category-specific colors:

```typescript
Colors.food.dessert    // #F472B6 (pink)
Colors.food.dessertBg  // #FCE7F3 (light pink)

Colors.food.savory     // #FF6B35 (orange)
Colors.food.savoryBg   // #FFEDD5 (light orange)

Colors.food.healthy    // #10B981 (green)
Colors.food.healthyBg  // #D1FAE5 (light green)

Colors.food.beverage   // #14B8A6 (teal)
Colors.food.beverageBg // #CCFBF1 (light teal)

Colors.food.baked      // #D97706 (amber)
Colors.food.bakedBg    // #FEF3C7 (light yellow)
```

---

### **Overlay/Transparency Helpers** 👻

Pre-defined opacity variants for overlays:

```typescript
// Dark overlays
Colors.overlay.dark10  // rgba(15, 23, 42, 0.1)
Colors.overlay.dark20  // rgba(15, 23, 42, 0.2)
Colors.overlay.dark50  // rgba(15, 23, 42, 0.5)
Colors.overlay.dark80  // rgba(15, 23, 42, 0.8)

// White overlays
Colors.overlay.white10 // rgba(255, 255, 255, 0.1)
Colors.overlay.white50 // rgba(255, 255, 255, 0.5)
Colors.overlay.white90 // rgba(255, 255, 255, 0.9)
```

---

## 📖 How to Use

### Import the Colors
```typescript
import { Colors } from '@/constants/colors';
```

### In StyleSheets
```typescript
const styles = StyleSheet.create({
  button: {
    backgroundColor: Colors.secondary.main,     // Orange
    shadowColor: Colors.secondary.main,
  },
  text: {
    color: Colors.neutral.black,               // Dark text
  },
  background: {
    backgroundColor: Colors.neutral.lightest,  // Light gray
  },
});
```

### In Component Inline Styles
```tsx
<View style={{ backgroundColor: Colors.primary.main }}>
  <Text style={{ color: Colors.neutral.white }}>Hello</Text>
</View>
```

### Icon Colors
```tsx
<ChefHat color={Colors.secondary.main} size={24} />
<Check color={Colors.accent.success} size={20} />
```

---

## ✅ Migration Checklist

Files that have been migrated to use `Colors` constant:

- ✅ `styles/recipe/recipeDetailStyles.ts`
- ✅ `styles/recipe/recipeGenStyles.ts`
- ✅ `styles/chat/chatBotStyles.ts`
- ✅ `styles/inventoryStyle.ts`

Files still using hard-coded colors (can be migrated gradually):
- ⏳ `styles/homeStyles.ts`
- ⏳ `styles/savedStyles.ts`
- ⏳ `styles/postHistoryStyles.ts`
- ⏳ Auth flow styles
- ⏳ Other component-specific styles

---

## 🎯 Design Principles

### 1. **Semantic Naming**
Use color names that describe their purpose, not their appearance:
```typescript
// ❌ Don't do this
backgroundColor: '#FF6B35'

// ✅ Do this
backgroundColor: Colors.secondary.main
```

### 2. **Consistent Hierarchy**
```
Primary (Blue)   → Navigation, info, branding
Secondary (Orange) → Actions, CTAs, main interactions
Tertiary (Yellow) → Highlights, ratings
Accent (Green)   → Success, positive feedback
```

### 3. **Color Meaning**
- **Blue**: Trust, information, navigation
- **Orange**: Energy, appetite, action
- **Yellow**: Attention, achievement, value
- **Green**: Success, health, fresh
- **Red**: Error, urgency, delete
- **Gray**: Structure, text, neutral

### 4. **Accessibility**
- Always ensure sufficient contrast (4.5:1 minimum for text)
- Use semantic colors consistently (red = error, green = success)
- Don't rely solely on color to convey information

---

## 🔄 Updating the Palette

To change a color globally, update it once in `colors.ts`:

```typescript
// colors.ts
export const Colors = {
  secondary: {
    main: '#FF6B35',  // Change this to update everywhere!
    // ...
  }
}
```

This will automatically update:
- All action buttons
- Send button
- Scan button
- FAB
- Generate Recipe button
- Start Cooking button

---

## 🌙 Future: Dark Mode Support

The color system is ready for dark mode:

```typescript
// colors.ts (future enhancement)
export const DarkColors = {
  primary: {
    main: '#60A5FA',  // Lighter blue for dark backgrounds
  },
  // ... dark variants
}

// Usage in components
const isDark = useColorScheme() === 'dark';
const theme = isDark ? DarkColors : Colors;

backgroundColor: theme.primary.main
```

---

## 📞 Questions?

- **Why use this system?** Easier maintenance, consistency, theming support
- **Do I have to migrate everything?** No, it's optional but recommended
- **Can I still use hex codes?** Yes, but prefer the Colors constant
- **How do I add new colors?** Add them to `colors.ts` with semantic names

---

**Last Updated:** 2025-01-17
**Version:** 1.0.0
