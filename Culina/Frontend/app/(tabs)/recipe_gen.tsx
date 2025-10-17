import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { auth, db } from "@/lib/firebaseConfig";
import { collection, doc, getDoc, setDoc, serverTimestamp, onSnapshot } from "firebase/firestore";
import { generateRecipe } from "@/lib/generateRecipe";
import type { Recipe } from "@/types/recipe";
import Background from "@/components/Background";
import Animated, { FadeInUp, FadeIn } from "react-native-reanimated";
import { Users, Flame, RefreshCw } from "lucide-react-native";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";

type UserPrefsDoc = {
  dietaryPreference?: string;
  religiousPreference?: string;
  caloriePlan?: string;
};

const STORAGE_KEY = "@culina/generated_recipes";

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

const GeneratedRecipeCard = ({ recipe, index, onSave, onPress, saving, inventoryCounts }: GeneratedRecipeCardProps) => {
  const ingredientsPreview = Array.isArray(recipe.ingredients)
    ? (recipe.ingredients as (string | { name: string; qty?: string })[]).slice(0, 3)
    : [];

  const formatIngredient = (ingredient: string | { name: string; qty?: string }) => {
    if (typeof ingredient === "string") return stripUnits(ingredient);
    if (ingredient.name) return ingredient.name;
    return stripUnits(String(ingredient));
  };

  const getInventoryKey = (ingredient: string | { name: string; qty?: string }) => {
    if (typeof ingredient === "string") return stripUnits(ingredient).toLowerCase();
    return ingredient.name?.toLowerCase() ?? "";
  };

  const getInventoryCount = (ingredient: string | { name: string; qty?: string }) => {
    const key = getInventoryKey(ingredient);
    if (!key) return null;
    if (inventoryCounts[key] !== undefined) return inventoryCounts[key];
    if (key.endsWith("s")) {
      const singular = key.slice(0, -1);
      if (inventoryCounts[singular] !== undefined) return inventoryCounts[singular];
    }
    return null;
  };

  const ingredientCount = Array.isArray(recipe.ingredients) ? recipe.ingredients.length : null;

  return (
    <Animated.View entering={FadeInUp.delay(index * 100).duration(400).springify()}>
      <TouchableOpacity activeOpacity={0.85} onPress={onPress}>
        <View style={styles.recipeCard}>
          <View style={styles.recipeContent}>
            <Text style={styles.recipeTitle} numberOfLines={2}>
              {recipe.title}
            </Text>

            {!!recipe.description && (
              <Text style={styles.recipeDescription} numberOfLines={2}>
                {recipe.description}
              </Text>
            )}

            {ingredientsPreview.length > 0 && (
              <View style={styles.previewSection}>
                <Text style={styles.previewLabel}>Key ingredients</Text>
                {ingredientsPreview.map((ingredient, idx) => {
                  const displayName = formatIngredient(ingredient);
                  const count = getInventoryCount(ingredient);
                  const countLabel =
                    count === null ? "Not in pantry" : count === 0 ? "Out of stock" : `${count} in pantry`;
                  return (
                    <View key={idx} style={styles.previewItemRow}>
                      <Text style={styles.previewItem}>• {displayName}</Text>
                      <Text style={[styles.previewCount, (count === null || count === 0) && styles.previewCountLow]}>
                        {countLabel}
                      </Text>
                    </View>
                  );
                })}
              </View>
            )}

            <Animated.View
              style={styles.recipeMetaContainer}
              entering={FadeIn.delay(index * 100 + 150).duration(400)}
            >
              {!!recipe.servings && (
                <View style={[styles.metaPill, styles.servingsPill]}>
                  <Users size={14} color="#0284c7" />
                  <Text style={styles.metaText}>Serves {recipe.servings}</Text>
                </View>
              )}
              {!!recipe.estimatedCalories && (
                <View style={[styles.metaPill, styles.caloriesPill]}>
                  <Flame size={14} color="#f97316" />
                  <Text style={styles.metaText}>{recipe.estimatedCalories} kcal</Text>
                </View>
              )}
              {ingredientCount && (
                <View style={[styles.metaPill, styles.ingredientsPill]}>
                  <Text style={styles.metaText}>
                    🥕 {ingredientCount} ingredient{ingredientCount === 1 ? "" : "s"}
                  </Text>
                </View>
              )}
              <View style={[styles.metaPill, styles.sourcePill]}>
                <Text style={styles.metaText}>{recipe.source || "AI Generated"}</Text>
              </View>
            </Animated.View>

            <TouchableOpacity
              style={[styles.primaryButton, saving && styles.primaryButtonDisabled]}
              onPress={onSave}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.primaryButtonText}>Save Recipe</Text>
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
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#128AFA" />
        <Text style={styles.gray}>Loading your pantry...</Text>
      </View>
    );
  }

  return (
    <Background>
      <SafeAreaView style={styles.container}>
        {!recipes.length ? (
          <View style={styles.center}>
            <TouchableOpacity style={styles.button} onPress={generateNewRecipes} disabled={generating}>
              <Text style={styles.buttonText}>{generating ? "Generating..." : "Generate Recipes!"}</Text>
            </TouchableOpacity>
            {preferences.length > 0 && (
              <Text style={styles.gray}>Preferences: {preferences.join(", ")}</Text>
            )}
          </View>
        ) : (
          <>
            <View style={styles.refreshRow}>
              <Text style={styles.refreshHint}>Need a fresh batch?</Text>
              <TouchableOpacity
                style={[styles.secondaryButton, generating && styles.secondaryButtonDisabled]}
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
            style={styles.scroll}
            contentContainerStyle={styles.list}
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

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  gray: { color: "#6b7280", marginTop: 10, textAlign: "center" },
  button: { backgroundColor: "#128AFA", paddingVertical: 14, paddingHorizontal: 30, borderRadius: 14 },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "bold" },
  scroll: { flex: 1 },
  list: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 40 },
  refreshRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    marginTop: 12,
    gap: 12,
  },
  refreshHint: {
    fontSize: 14,
    color: "#475569",
    fontWeight: "500",
  },
  recipeCard: {
    backgroundColor: "#fff",
    borderRadius: 20,
    marginBottom: 16,
    shadowColor: "#94a3b8",
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 5 },
    shadowRadius: 15,
    elevation: 5,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  recipeContent: { padding: 20 },
  recipeTitle: { fontSize: 22, fontWeight: "bold", color: "#1e293b", marginBottom: 8 },
  recipeDescription: { color: "#475569", fontSize: 15, lineHeight: 22, marginBottom: 16 },
  previewSection: { marginBottom: 16 },
  previewLabel: { fontSize: 14, fontWeight: "600", color: "#0f172a", marginBottom: 6 },
  previewItemRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 4,
  },
  previewItem: { color: "#334155", lineHeight: 20, flex: 1 },
  previewCount: {
    fontSize: 13,
    fontWeight: "600",
    color: "#0f172a",
  },
  previewCountLow: {
    color: "#b91c1c",
  },
  recipeMetaContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
    paddingTop: 16,
    marginBottom: 16,
  },
  metaPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
  },
  metaText: { fontSize: 14, fontWeight: "500", color: "#334155" },
  servingsPill: { backgroundColor: "#e0f2fe" },
  caloriesPill: { backgroundColor: "#fff7ed" },
  ingredientsPill: { backgroundColor: "#E2F0E5FF" },
  sourcePill: { backgroundColor: "#f1f5f9" },
  sectionContainer: { marginTop: 12 },
  sectionTitle: { fontSize: 16, fontWeight: "600", color: "#0f172a", marginBottom: 8 },
  listItem: { color: "#334155", marginBottom: 6, lineHeight: 20 },
  primaryButton: {
    backgroundColor: "#128AFA",
    paddingVertical: 14,
    borderRadius: 999,
    marginTop: 20,
    alignItems: "center",
  },
  primaryButtonDisabled: { opacity: 0.7 },
  primaryButtonText: { color: "#fff", fontSize: 16, fontWeight: "bold" },
  secondaryButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#0f172a",
    backgroundColor: "rgba(255, 255, 255, 0.92)",
  },
  secondaryButtonDisabled: {
    opacity: 0.5,
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#0f172a",
  },
});
