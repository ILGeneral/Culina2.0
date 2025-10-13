# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Culina is a React Native mobile app built with Expo that helps users generate AI-powered recipes based on their inventory, dietary preferences, and calorie goals. The app uses Firebase for backend services and Groq API for AI recipe generation.

**Architecture:**
- **Frontend**: React Native (Expo SDK 54) with TypeScript, file-based routing via `expo-router`, and NativeWind for styling
- **Backend**: Firebase Cloud Functions (TypeScript) deployed to Firebase project `culinatwoo`
- **Database**: Firestore with collections for `users`, `recipes`, `reports`, and user subcollections for `inventory` and `ratings`
- **Authentication**: Firebase Auth with AsyncStorage persistence for React Native
- **AI Integration**: Groq API (via Cloud Functions) for recipe generation using `llama3-70b-8192` model
- **App ID**: iOS `com.ilgeneral.culina`, Android `com.ilgeneral.culina`

## Development Commands

### Frontend (React Native + Expo)
```bash
cd Frontend
npm start                 # Start Expo dev server
npm run android          # Run on Android device/emulator
npm run ios              # Run on iOS device/simulator
npm run web              # Run in web browser
```

### Backend (Firebase Functions)
```bash
cd Backend/functions
npm run lint             # Lint TypeScript code with ESLint
npm run build            # Compile TypeScript to lib/
npm run build:watch      # Compile TypeScript in watch mode
npm run serve            # Build and start Firebase emulators (functions only)
npm run deploy           # Deploy functions to Firebase
npm run logs             # View Firebase function logs
```

**Important**: Backend requires Node.js v20 (specified in `Backend/functions/package.json`).

## Project Structure

### Frontend App Routing (`Frontend/app/`)
The app uses Expo Router with file-based routing:

- **`index.tsx`**: Root redirect - sends authenticated users to `/(tabs)/home`, unauthenticated to `/(auth)/login`
- **`(auth)/`**: Auth flow screens (login, register, onboarding)
- **`(tabs)/`**: Main app tabs (home, inventory, saved recipes, profile)
  - `_layout.tsx` defines the bottom tab navigator with 4 tabs
  - Each tab is a subdirectory with its own `index.tsx`
- **`recipe/`**: Recipe detail and generator screens
  - `[id].tsx`: Dynamic recipe detail view
  - `generator.tsx`: AI recipe generation interface
- **`report/`**: Bug/feedback reporting screen

### Backend Functions (`Backend/functions/src/index.ts`)
All Cloud Functions are defined in a single file:

1. **`generateRecipe`** (callable):
   - Accepts optional `model` parameter for Groq API
   - Fetches user preferences and inventory from Firestore
   - Calls Groq API with prompt including dietary restrictions, calorie goals, and available ingredients
   - Parses JSON response and creates recipe document in `recipes` collection
   - Returns `recipeId` and `recipe` object

2. **`confirmRecipeUse`** (callable):
   - Takes `recipeId` parameter
   - Validates recipe ownership and ingredient availability
   - Uses Firestore transaction to deduct ingredients from user's inventory
   - Matches ingredients by name (case-insensitive) and validates quantity/unit

3. **`rateRecipe`** (callable):
   - Takes `recipeId` and `score` (1-5)
   - Prevents users from rating their own recipes
   - Updates/creates rating in `recipes/{id}/ratings/{uid}` subcollection
   - Recalculates and updates recipe's aggregate rating stats

4. **`submitReport`** (callable):
   - Accepts `type`, `description`, `appVersion`, `device`
   - Creates document in `reports` collection with `emailSent: false` flag

5. **`helloTest`** (HTTP): Health check endpoint returning "✅ Culina backend is alive!"

**Note**: Groq API key must be configured via `firebase functions:config:set groq.key="YOUR_KEY"`

### Firebase Configuration
- **Frontend**: `Frontend/lib/firebaseConfig.ts` exports `auth`, `db`, `storage`, `functions`, and collection references (`recipesCollection`, `usersCollection`, `ingredientsCollection`)
- **Backend**: Project ID `culinatwoo` configured in `Backend/.firebaserc`
- **Auth**: Uses React Native persistence with AsyncStorage
  - **Important**: The project uses Firebase JS SDK (v12.3.0) with React Native-specific persistence
  - Auth imports must come from both `firebase/auth` (for `getAuth`, `Auth` type) and `firebase/auth/react-native` (for `initializeAuth`, `getReactNativePersistence`)
  - Correct import pattern:
    ```typescript
    import { getAuth, type Auth } from "firebase/auth";
    import { initializeAuth, getReactNativePersistence } from "firebase/auth/react-native";
    ```

### Firestore Data Model
- **`users/{uid}`**: User profile with `preferences` object (diet, religion, caloriePlan)
- **`users/{uid}/inventory`**: User's ingredient inventory (name, quantity, unit, type, caloriesPerUnit, updatedAt)
- **`recipes`**: All recipes (AI-generated and user-created) with fields: `ownerId`, `title`, `shortDesc`, `servings`, `estKcal`, `ingredients[]`, `steps[]`, `source`, `visibility`, `editedByUser`, `tags[]`, `createdAt`, `updatedAt`, `ratings{count, avg}`
- **`recipes/{id}/ratings/{uid}`**: Individual user ratings (score, createdAt)
- **`reports`**: Bug reports and feedback (reporterId, type, description, appVersion, device, emailSent, createdAt)

## Key Technical Patterns

### TypeScript Path Aliases
Frontend uses `@/*` alias mapping to project root (configured in `Frontend/tsconfig.json`). Import from components/lib with:
```typescript
import { auth } from "@/lib/firebaseConfig";
import { useInventory } from "@/hooks/useInventory";
```

### Styling
Uses NativeWind (Tailwind CSS for React Native). Components can use both `className` prop and StyleSheet:
```tsx
<View className="flex-1 bg-white px-5">
  <Text style={styles.title}>Hello</Text>
</View>
```

### Navigation
Expo Router handles navigation. Use typed navigation:
```typescript
import { useRouter } from "expo-router";
const router = useRouter();
router.push("/(tabs)/home");
router.replace("/(auth)/login");
```

**Note**: Routes with parentheses like `(auth)` and `(tabs)` are layout groups and don't appear in the URL path.

### Calling Cloud Functions
Import and call from frontend:
```typescript
import { functions } from "@/lib/firebaseConfig";
import { httpsCallable } from "firebase/functions";

const generateRecipe = httpsCallable(functions, "generateRecipe");
const result = await generateRecipe({ model: "llama3-70b-8192" });
```

Or use the helper function in `Frontend/lib/generateRecipe.ts`:
```typescript
import { generateRecipe } from "@/lib/generateRecipe";
const recipe = await generateRecipe(ingredients, preferences);
```

### Custom Hooks
Key reusable hooks in `Frontend/hooks/`:

- **`useInventory()`**: Real-time Firestore listener for user's inventory with CRUD operations
  - Returns: `{ inventory, loading, addIngredient, updateIngredient, deleteIngredient }`
  - Automatically subscribes/unsubscribes based on auth state
  - Inventory ordered by name (ascending)

## Common Issues

### Backend Deployment
Before deploying, ensure:
1. TypeScript builds without errors: `npm run build`
2. ESLint passes: `npm run lint`
3. Groq API key is set: `firebase functions:config:get groq.key`

Firebase automatically runs lint + build before deployment (configured in `Backend/firebase.json` predeploy hooks).

### Frontend Build Errors
- Clear Metro cache: `npx expo start -c`
- Reset node_modules: `rm -rf node_modules package-lock.json && npm install`
- Check TypeScript errors don't prevent hot reload
- If Babel issues occur, verify `babel.config.js` has `expo-router/babel` and `react-native-reanimated/plugin` plugins

### Authentication Issues
If auth state isn't persisting, verify AsyncStorage is properly initialized. The auth instance uses `getReactNativePersistence(AsyncStorage)` configured in `firebaseConfig.ts:28-34`.

### Expo New Architecture
The app has `newArchEnabled: true` in `app.json`, enabling React Native's New Architecture (Fabric + TurboModules). If encountering compatibility issues with native modules, this can be disabled.

## Firebase Project Info
- **Project ID**: `culinatwoo`
- **Region**: Default (likely us-central1 for functions)
- **Auth Domain**: `culinatwoo.firebaseapp.com`
