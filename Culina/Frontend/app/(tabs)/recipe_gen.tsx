import React, { useEffect, useState, useCallback } from "react";
import { 
  View, 
  Text, 
  ScrollView, 
  TouchableOpacity, 
  ActivityIndicator, 
  Alert,
  SafeAreaView 
} from "react-native";
import recipeGenStyles from "@/styles/recipe/recipeGenStyles";
import { auth, db } from "@/lib/firebaseConfig";
import { collection, doc, getDoc, setDoc, serverTimestamp, onSnapshot } from "firebase/firestore";
import { generateRecipe } from "@/lib/generateRecipe";
import type { Recipe } from "@/types/recipe";
import Background from "@/components/Background";
import Animated, { FadeInUp, FadeIn } from "react-native-reanimated";
import { Users, Flame, BookmarkPlus, RefreshCw } from "lucide-react-native";
import { normalizeRecipeSource } from "@/lib/utils/recipeSource";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";

type UserPrefsDoc = {
  dietaryPreference?: string;
  religiousPreference?: string;
  caloriePlan?: string;
};

const STORAGE_KEY = "@culina/generated_recipes";

type IngredientEntry = string | { name: string; qty?: string; unit?: string };

type GeneratedRecipeCardProps = {
  recipe: Recipe;
  index: number;
  onSave: () => void;
  onPress: () => void;
  saving: boolean;
  inventoryCounts: Record<string, number>;
};

const MEASUREMENT_WORDS = new Set([
  "cup",
  "cups",
  "tsp",
  "teaspoon",
  "teaspoons",
  "tbsp",
  "tablespoon",
  "tablespoons",
  "oz",
  "ounce",
  "ounces",
  "g",
  "gram",
  "grams",
  "kg",
  "kilogram",
  "kilograms",
  "ml",
  "milliliter",
  "milliliters",
  "l",
  "liter",
  "liters",
  "lb",
  "pound",
  "pounds",
  "pinch",
  "dash",
  "clove",
  "cloves",
  "slice",
  "slices",
  "piece",
  "pieces",
  "bunch",
  "bunches",
  "large",
  "small",
  "medium",
]);

const stripUnits = (text: string) => {
  if (!text) return text;
  const tokens = text.trim().split(/\s+/);
  const remaining = [...tokens];

  while (remaining.length) {
    const token = remaining[0].toLowerCase();
    if (/^[\d/.,-]+$/.test(token) || MEASUREMENT_WORDS.has(token) || token === "of") {
      remaining.shift();
      continue;
    }
    break;
  }

  return remaining.length ? remaining.join(" ") : text.trim();
};

const isNumericToken = (token: string) => /^\d+(?:[\/.]\d+)?$/.test(token);

const parseIngredientString = (entry: string): { name: string; qty?: string; unit?: string } => {
  const raw = entry.replace(/\s+/g, " ").trim();
  if (!raw) {
    return { name: "" };
  }

  const hyphenParts = raw.split(/[–—-]/);
  if (hyphenParts.length > 1) {
    const name = hyphenParts[0].trim();
    const trailing = hyphenParts.slice(1).join("-").trim();
    const tokens = trailing.split(/\s+/);
    const mutable = [...tokens];
    const qtyTokens: string[] = [];

    while (mutable.length && isNumericToken(mutable[0])) {
      qtyTokens.push(mutable.shift()!);
    }

    const unit = mutable.join(" ").trim();

    return {
      name: name || raw,
      ...(qtyTokens.length ? { qty: qtyTokens.join(" ") } : {}),
      ...(unit ? { unit } : {}),
    };
  }

  return { name: raw };
};

const normalizeIngredientEntryForDisplay = (ingredient: IngredientEntry): { name: string; qty?: string; unit?: string } => {
  if (typeof ingredient === "string") {
    return parseIngredientString(ingredient);
  }
  return ingredient;
};

const formatIngredientLabel = (ingredient: IngredientEntry) => {
  const normalized = normalizeIngredientEntryForDisplay(ingredient);
  const parts = [normalized.name?.trim()].filter(Boolean) as string[];
  const amount = normalized.qty?.trim();
  const unit = normalized.unit?.trim();
  if (amount || unit) {
    const qtyUnit = [amount, unit].filter(Boolean).join(" ");
    parts.push(qtyUnit);
  }
  return parts.join(" — ");
};

const getIngredientNameKey = (ingredient: IngredientEntry) => {
  const normalized = normalizeIngredientEntryForDisplay(ingredient);
  if (normalized.name?.trim()) {
    return normalized.name.trim().toLowerCase();
  }
  if (typeof ingredient === "string") {
    return stripUnits(ingredient).toLowerCase();
  }
  return "";
};

const GeneratedRecipeCard = ({ recipe, index, onSave, onPress, saving, inventoryCounts }: GeneratedRecipeCardProps) => {
  const ingredientsPreview = Array.isArray(recipe.ingredients)
    ? (recipe.ingredients as IngredientEntry[]).slice(0, 3)
    : [];

  const getInventoryCount = (ingredient: IngredientEntry) => {
    const key = getIngredientNameKey(ingredient);
    if (!key) return null;
    if (inventoryCounts[key] !== undefined) return inventoryCounts[key];
    if (key.endsWith("s")) {
      const singular = key.slice(0, -1);
      if (inventoryCounts[singular] !== undefined) return inventoryCounts[singular];
    }
    return null;
  };

  const ingredientCount = Array.isArray(recipe.ingredients) ? recipe.ingredients.length : null;
  const sourceLabel = normalizeRecipeSource(recipe.source);

  return (
    <Animated.View entering={FadeInUp.delay(index * 100).duration(400).springify()}>
      <TouchableOpacity activeOpacity={0.85} onPress={onPress}>
        <View style={recipeGenStyles.savedCard}>
          <View style={recipeGenStyles.savedContent}>
            <Text style={recipeGenStyles.recipeTitle} numberOfLines={2}>
              {recipe.title}
            </Text>

            {!!recipe.description && (
              <Text style={recipeGenStyles.recipeDescription} numberOfLines={2}>
                {recipe.description}
              </Text>
            )}

            {ingredientsPreview.length > 0 && (
              <View style={recipeGenStyles.previewSection}>
                <Text style={recipeGenStyles.previewLabel}>Key ingredients</Text>
                {ingredientsPreview.map((ingredient, idx) => {
                  const displayName = formatIngredientLabel(ingredient);
                  const count = getInventoryCount(ingredient);
                  const countLabel =
                    count === null ? "Not in pantry" : count === 0 ? "Out of stock" : `${count} in pantry`;
                  return (
                    <View key={idx} style={recipeGenStyles.previewRow}>
                      <Text style={recipeGenStyles.previewItem}>• {displayName}</Text>
                      <Text style={[recipeGenStyles.previewCount, (count === null || count === 0) && recipeGenStyles.previewCountLow]}>
                        {countLabel}
                      </Text>
                    </View>
                  );
                })}
              </View>
            )}

            <Animated.View
              style={recipeGenStyles.recipeMetaContainer}
              entering={FadeIn.delay(index * 100 + 150).duration(400)}
            >
              <View style={[recipeGenStyles.metaPill, recipeGenStyles.sourcePill]}>
                <Text style={recipeGenStyles.metaText}>{sourceLabel}</Text>
              </View>
              {!!recipe.servings && (
                <View style={[recipeGenStyles.metaPill, recipeGenStyles.servingsPill]}>
                  <Users size={14} color="#0284c7" />
                  <Text style={recipeGenStyles.metaText}>Serves {recipe.servings}</Text>
                </View>
              )}
              {!!recipe.estimatedCalories && (
                <View style={[recipeGenStyles.metaPill, recipeGenStyles.caloriesPill]}>
                  <Flame size={14} color="#f97316" />
                  <Text style={recipeGenStyles.metaText}>{recipe.estimatedCalories} kcal</Text>
                </View>
              )}
              {ingredientCount && (
                <View style={[recipeGenStyles.metaPill, recipeGenStyles.ingredientsPill]}>
                  <Text style={recipeGenStyles.metaText}>
                    🥕 {ingredientCount} ingredient{ingredientCount === 1 ? "" : "s"}
                  </Text>
                </View>
              )}
              <View style={[recipeGenStyles.metaPill, recipeGenStyles.sourcePill]}>
                <Text style={recipeGenStyles.metaText}>{recipe.source || "AI Generated"}</Text>
              </View>
            </Animated.View>

            <TouchableOpacity
              style={[recipeGenStyles.primaryButton, saving && recipeGenStyles.primaryButtonDisabled]}
              onPress={onSave}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={recipeGenStyles.primaryButtonText}>Save Recipe</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

export default function RecipeGeneratorScreen() {
  const [ingredients, setIngredients] = useState<string[]>([]);
  const [preferences, setPreferences] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [inventoryCounts, setInventoryCounts] = useState<Record<string, number>>({});
  const user = auth.currentUser;
  const router = useRouter();

  const persistRecipes = async (items: Recipe[]) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch (err) {
      console.warn("Failed to persist generated recipes:", err);
    }
  };

  const generateNewRecipes = useCallback(async () => {
    if (!ingredients.length) {
      Alert.alert("Missing ingredients", "Add pantry items before generating recipes.");
      return;
    }

    try {
      setGenerating(true);
      const { recipes: generated } = await generateRecipe(ingredients, preferences);
      setRecipes(generated);
      await persistRecipes(generated);
    } catch (err: any) {
      console.error("Generate recipes failed:", err);
      Alert.alert("Error", err?.message || "Could not generate recipes right now.");
    } finally {
      setGenerating(false);
    }
  }, [ingredients, preferences]);

  useEffect(() => {
    let unsubscribeInventory: (() => void) | undefined;

    const fetchUserData = async () => {
      if (!user) {
        setLoading(false);
        return;
      }
      try {
        const invRef = collection(db, "users", user.uid, "ingredients");
        unsubscribeInventory = onSnapshot(invRef, (snapshot) => {
          const counts: Record<string, number> = {};
          const names: string[] = [];

          snapshot.docs.forEach((docSnap) => {
            const data = docSnap.data() as { name?: string; quantity?: number };
            if (!data?.name) return;
            names.push(data.name);
            const baseKey = data.name.toLowerCase();
            const qty = typeof data.quantity === "number" ? data.quantity : 0;
            counts[baseKey] = qty;
            const strippedKey = stripUnits(data.name).toLowerCase();
            if (strippedKey && strippedKey !== baseKey) {
              counts[strippedKey] = qty;
            }
          });

          setIngredients(names);
          setInventoryCounts(counts);
        });

        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);
        const prefsDoc = (userSnap.exists() ? (userSnap.data() as UserPrefsDoc) : {}) as UserPrefsDoc;
        const prefs: string[] = [];
        if (prefsDoc.dietaryPreference) prefs.push(prefsDoc.dietaryPreference);
        if (prefsDoc.religiousPreference) prefs.push(prefsDoc.religiousPreference);
        if (prefsDoc.caloriePlan) prefs.push(prefsDoc.caloriePlan);
        if (prefs.length === 0) prefs.push("Maintain Calories");
        setPreferences(prefs);
      } catch (err) {
        console.error("Error loading user data:", err);
        Alert.alert("Error", "Could not load pantry or preferences.");
      } finally {
        setLoading(false);
      }
    };
    fetchUserData();

    return () => {
      unsubscribeInventory?.();
    };
  }, [user]);

  useEffect(() => {
    const loadStoredRecipes = async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          const stored = JSON.parse(raw) as Recipe[];
          if (Array.isArray(stored) && stored.length) {
            setRecipes(stored);
          }
        }
      } catch (err) {
        console.warn("Failed to load stored recipes:", err);
      }
    };

    loadStoredRecipes();
  }, []);

  const handleGenerate = async () => {
    if (ingredients.length === 0) {
      Alert.alert("No Ingredients", "Add items to your inventory first!");
      return;
    }
    try {
      setGenerating(true);
      const data = await generateRecipe(ingredients, preferences);
      if (!data?.recipes || data.recipes.length < 5) {
        throw new Error("AI returned fewer than five recipes");
      }
      setRecipes(data.recipes);
      persistRecipes(data.recipes);
    } catch (error) {
      console.error("Generation failed:", error);
      Alert.alert("Error", "Could not generate recipes.");
    } finally {
      setGenerating(false);
    }
  };

  const handleSave = async (recipe: Recipe) => {
    if (!user || !recipe) return;
    try {
      setSaving(true);
      const ref = doc(collection(db, "users", user.uid, "recipes"));
      await setDoc(ref, {
        ...recipe,
        createdAt: serverTimestamp(),
        source: "AI Generated",
      });
      Alert.alert("Saved", `Saved recipe: ${recipe.title}`);
    } catch (err) {
      console.error("Save failed:", err);
      Alert.alert("Error", "Could not save recipe.");
    } finally {
      setSaving(false);
    }
  };

  const handleViewDetails = (recipe: Recipe) => {
    try {
      const encoded = encodeURIComponent(JSON.stringify(recipe));
      router.push(`/recipe/generated?data=${encoded}`);
    } catch (err) {
      console.error("Navigation failed:", err);
      Alert.alert("Error", "Could not open recipe details.");
    }
  };

  useEffect(() => {
    if (!loading && !recipes.length && ingredients.length && !generating) {
      generateNewRecipes();
    }
  }, [loading, recipes.length, ingredients.length, generating, generateNewRecipes]);

  if (loading) {
    return (
      <View style={recipeGenStyles.center}>
        <ActivityIndicator size="large" color="#128AFA" />
        <Text style={recipeGenStyles.gray}>Loading your pantry...</Text>
      </View>
    );
  }

  return (
    <Background>
      <SafeAreaView style={recipeGenStyles.container}>
        {!recipes.length ? (
          <View style={recipeGenStyles.center}>
            <TouchableOpacity style={recipeGenStyles.button} onPress={generateNewRecipes} disabled={generating}>
              <Text style={recipeGenStyles.buttonText}>{generating ? "Generating..." : "Generate Recipes!"}</Text>
            </TouchableOpacity>
            {preferences.length > 0 && (
              <Text style={recipeGenStyles.gray}>Preferences: {preferences.join(", ")}</Text>
            )}
          </View>
        ) : (
          <>
            <View style={recipeGenStyles.refreshRow}>
              <Text style={recipeGenStyles.refreshHint}>Need a fresh batch?</Text>
              <TouchableOpacity
                style={[recipeGenStyles.secondaryButton, generating && recipeGenStyles.secondaryButtonDisabled]}
                onPress={generateNewRecipes}
                disabled={generating}
                activeOpacity={0.85}
              >
                {generating ? (
                  <ActivityIndicator color="#0f172a" size="small" />
                ) : (
                  <RefreshCw size={18} color="#0f172a" />
                )}
              </TouchableOpacity>
            </View>

            <ScrollView
              style={recipeGenStyles.scroll}
              contentContainerStyle={recipeGenStyles.list}
              showsVerticalScrollIndicator={false}
            >
            {recipes.map((recipe, idx) => (
              <GeneratedRecipeCard
                key={`${recipe.title}-${idx}`}
                recipe={recipe}
                index={idx}
                onSave={() => handleSave(recipe)}
                onPress={() => handleViewDetails(recipe)}
                saving={saving}
                inventoryCounts={inventoryCounts}
              />
            ))}
            </ScrollView>
          </>
        )}
      </SafeAreaView>
    </Background>
  );
}

