import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Image,
  ActivityIndicator,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeInUp, FadeIn } from "react-native-reanimated";
import Background from "@/components/Background";
import { SPOONACULAR_API_KEY } from "@/lib/secrets";
import { ArrowLeft, Clock, Users, ChefHat, MapPin, Tag } from "lucide-react-native";
import { useInventory } from "@/hooks/useInventory";
import { matchRecipeWithInventory } from "@/lib/ingredientMatcher";
import { suggestIngredientSubstitutes, type SuggestIngredientSubstitutesResponse } from "@/lib/suggestIngredientSubstitutes";

type RecipeProvider = "spoonacular" | "mealdb";

const SPOONACULAR_DETAILS_ENDPOINT = (id: string) =>
  `https://api.spoonacular.com/recipes/${id}/information?includeNutrition=false&apiKey=${SPOONACULAR_API_KEY}`;
const MEALDB_LOOKUP_ENDPOINT = (id: string) =>
  `https://www.themealdb.com/api/json/v1/1/lookup.php?i=${id}`;

type Step = {
  number: number;
  step: string;
};

type DetailedRecipe = {
  id: string;
  title: string;
  description?: string;
  imageUrl?: string;
  ingredients: string[];
  instructions: Step[];
  readyInMinutes?: number | null;
  servings?: number | null;
  sourceUrl?: string | null;
  category?: string;
  area?: string;
  tags?: string[];
  provider: RecipeProvider;
};

type SuggestionState = {
  status: "idle" | "loading" | "ready" | "error";
  data?: SuggestIngredientSubstitutesResponse;
  error?: string;
};

const parseSpoonacularInstructions = (data: any): Step[] => {
  const analyzed = Array.isArray(data?.analyzedInstructions) ? data.analyzedInstructions : [];
  if (analyzed.length > 0 && Array.isArray(analyzed[0]?.steps)) {
    return analyzed[0].steps
      .filter((s: any) => typeof s?.step === "string" && s.step.trim())
      .map((s: any) => ({ number: s.number ?? 0, step: s.step.trim() }));
  }

  if (typeof data?.instructions === "string" && data.instructions.trim()) {
    return data.instructions
      .split(/\r?\n+/)
      .map((line: string, idx: number) => line.trim())
      .filter(Boolean)
      .map((line: string, idx: number) => ({ number: idx + 1, step: line }));
  }

  return [];
};

const parseIngredients = (data: any): string[] => {
  if (!Array.isArray(data?.extendedIngredients)) return [];
  return data.extendedIngredients
    .map((ing: any) => (typeof ing?.original === "string" ? ing.original.trim() : ""))
    .filter(Boolean);
};

const parseMealIngredients = (meal: any): string[] => {
  const ingredients: string[] = [];
  for (let idx = 1; idx <= 20; idx += 1) {
    const ingredient = meal?.[`strIngredient${idx}`];
    const measure = meal?.[`strMeasure${idx}`];
    if (typeof ingredient === "string" && ingredient.trim()) {
      const name = ingredient.trim();
      const qty = typeof measure === "string" && measure.trim() ? measure.trim() : "";
      ingredients.push(qty ? `${name} — ${qty}` : name);
    }
  }
  return ingredients;
};

const parseMealInstructions = (instructions?: string | null): Step[] => {
  if (!instructions) return [];
  const normalized = instructions.replace(/\r\n?/g, "\n");
  const lines = normalized
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  const steps = lines.length
    ? lines
    : instructions
        .split(/(?<=[.!?])\s+/)
        .map((sentence) => sentence.trim())
        .filter(Boolean);

  return steps.map((text, idx) => ({ number: idx + 1, step: text }));
};

const parseMealTags = (tags?: string | null): string[] | undefined => {
  if (!tags) return undefined;
  const items = tags
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
  return items.length ? items : undefined;
};

const sanitizeSummary = (html?: string | null): string | undefined => {
  if (!html) return undefined;
  const withoutHtml = html.replace(/<[^>]+>/g, " ");
  const cleaned = withoutHtml.replace(/\s+/g, " ").trim();
  return cleaned || undefined;
};

const mergeInitialData = (initial: DetailedRecipe, fetched?: Partial<DetailedRecipe>): DetailedRecipe => {
  if (!fetched) return initial;
  return {
    ...initial,
    ...fetched,
    ingredients: fetched.ingredients?.length ? fetched.ingredients : initial.ingredients,
    instructions: fetched.instructions?.length ? fetched.instructions : initial.instructions,
    description: fetched.description ?? initial.description,
    imageUrl: fetched.imageUrl ?? initial.imageUrl,
    readyInMinutes: fetched.readyInMinutes ?? initial.readyInMinutes,
    servings: fetched.servings ?? initial.servings,
    sourceUrl: fetched.sourceUrl ?? initial.sourceUrl,
     category: fetched.category ?? initial.category,
     area: fetched.area ?? initial.area,
     tags: fetched.tags?.length ? fetched.tags : initial.tags,
     provider: fetched.provider ?? initial.provider,
  };
};

export default function RecipeDatabaseDetailsScreen() {
  const router = useRouter();
  const { id, initial, provider: providerParam } = useLocalSearchParams<{
    id?: string;
    initial?: string;
    provider?: RecipeProvider;
  }>();
  const provider: RecipeProvider = providerParam === "mealdb" ? "mealdb" : "spoonacular";
  const [recipe, setRecipe] = useState<DetailedRecipe | null>(null);
  const [loading, setLoading] = useState(false);
  const { inventory, loading: inventoryLoading } = useInventory();
  const [suggestions, setSuggestions] = useState<Record<string, SuggestionState>>({});

  useEffect(() => {
    if (!id) {
      Alert.alert("Missing recipe", "We couldn't identify this recipe.");
      return;
    }

    let initialData: DetailedRecipe | null = null;
    if (typeof initial === "string") {
      try {
        const parsed = JSON.parse(decodeURIComponent(initial)) as Partial<DetailedRecipe>;
        initialData = {
          id,
          title: parsed.title ?? "Recipe",
          description: parsed.description,
          imageUrl: parsed.imageUrl,
          ingredients: parsed.ingredients ?? [],
          instructions: [],
          readyInMinutes: parsed.readyInMinutes,
          servings: parsed.servings,
          sourceUrl: parsed.sourceUrl,
          category: parsed.category,
          area: parsed.area,
          tags: parsed.tags,
          provider,
        };
        setRecipe(initialData);
      } catch (err) {
        console.warn("Failed to parse initial Spoonacular data", err);
      }
    }

    const fetchDetails = async () => {
      setLoading(true);
      try {
        if (provider === "spoonacular") {
          if (!SPOONACULAR_API_KEY) {
            throw new Error("Missing Spoonacular API key");
          }

          const response = await fetch(SPOONACULAR_DETAILS_ENDPOINT(String(id)));
          if (!response.ok) {
            throw new Error(`Spoonacular info request failed (${response.status})`);
          }
          const payload = await response.json();
          const dishTypes = Array.isArray(payload?.dishTypes) ? payload.dishTypes.filter(Boolean) : [];
          const cuisines = Array.isArray(payload?.cuisines) ? payload.cuisines.filter(Boolean) : [];
          const tags = [...dishTypes.slice(1), ...cuisines.slice(1)].map((tag: string) =>
            tag.replace(/\s+/g, " ")
          );

          const detailed: DetailedRecipe = {
            id: String(payload?.id ?? id),
            title: payload?.title ?? initialData?.title ?? "Recipe",
            description: sanitizeSummary(payload?.summary) ?? initialData?.description,
            imageUrl: payload?.image ?? initialData?.imageUrl,
            ingredients: parseIngredients(payload),
            instructions: parseSpoonacularInstructions(payload),
            readyInMinutes: payload?.readyInMinutes ?? initialData?.readyInMinutes ?? null,
            servings: payload?.servings ?? initialData?.servings ?? null,
            sourceUrl: payload?.sourceUrl ?? initialData?.sourceUrl ?? null,
            category: dishTypes.length ? dishTypes[0] : initialData?.category,
            area: cuisines.length ? cuisines[0] : initialData?.area,
            tags: tags.length ? tags : initialData?.tags,
            provider: "spoonacular",
          };
          setRecipe((prev) => mergeInitialData(prev ?? initialData ?? detailed, detailed));
        } else {
          const response = await fetch(MEALDB_LOOKUP_ENDPOINT(String(id)));
          if (!response.ok) {
            throw new Error(`TheMealDB info request failed (${response.status})`);
          }
          const payload = await response.json();
          const meal = Array.isArray(payload?.meals) ? payload.meals?.[0] : null;
          if (!meal) {
            throw new Error("Meal not found");
          }

          const detailed: DetailedRecipe = {
            id: meal.idMeal ?? String(id),
            title: meal.strMeal ?? initialData?.title ?? "Recipe",
            description: sanitizeSummary(meal.strInstructions) ?? initialData?.description,
            imageUrl: meal.strMealThumb ?? initialData?.imageUrl,
            ingredients: parseMealIngredients(meal),
            instructions: parseMealInstructions(meal.strInstructions),
            readyInMinutes: initialData?.readyInMinutes ?? null,
            sourceUrl: meal.strSource || meal.strYoutube || initialData?.sourceUrl || null,
            category: meal.strCategory ?? initialData?.category,
            area: meal.strArea ?? initialData?.area,
            tags: parseMealTags(meal.strTags) ?? initialData?.tags,
            provider: "mealdb",
          };
          setRecipe((prev) => mergeInitialData(prev ?? initialData ?? detailed, detailed));
        }
      } catch (err) {
        console.error("Failed to fetch recipe detail", err);
        if (!initialData) {
          Alert.alert("Error", "Unable to load this recipe right now.");
        }
      } finally {
        setLoading(false);
      }
    };

    fetchDetails();
  }, [id, initial, provider]);

  const headerStats = useMemo(() => {
    if (!recipe) return [] as { icon: React.ReactNode; label: string }[];
    return [
      recipe.readyInMinutes ? { icon: <Clock size={16} color="#0f172a" />, label: `${recipe.readyInMinutes} min` } : null,
      recipe.servings ? { icon: <Users size={16} color="#0f172a" />, label: `Serves ${recipe.servings}` } : null,
      recipe.category ? { icon: <Tag size={16} color="#0f172a" />, label: recipe.category } : null,
      recipe.area ? { icon: <MapPin size={16} color="#0f172a" />, label: recipe.area } : null,
    ].filter(Boolean) as { icon: React.ReactNode; label: string }[];
  }, [recipe]);

  const tagList = useMemo(() => recipe?.tags ?? [], [recipe?.tags]);

  const matchResult = useMemo(() => {
    if (!recipe || !inventory.length) return null;
    return matchRecipeWithInventory(recipe.ingredients, inventory);
  }, [recipe, inventory]);

  const handleSuggestSubstitute = useCallback(
    async (targetIngredient: string) => {
      if (!recipe || !targetIngredient || !targetIngredient.trim()) {
        return;
      }

      const suggestionKey = targetIngredient;

      setSuggestions((prev) => ({
        ...prev,
        [suggestionKey]: { status: "loading" },
      }));

      try {
        const response = await suggestIngredientSubstitutes({
          recipeTitle: recipe.title,
          recipeDescription: recipe.description,
          targetIngredient,
          inventory,
        });

        if (!response.hasResults || response.suggestions.length === 0) {
          Alert.alert(
            "No Substitutes Found",
            `No suitable substitutes for "${targetIngredient}" were found. This could mean:\n\n• No matching ingredients in your inventory\n• The ingredient is essential for this recipe\n• Try adding more ingredients to your pantry`,
            [{ text: "OK" }]
          );

          setSuggestions((prev) => ({
            ...prev,
            [suggestionKey]: {
              status: "error",
              error: "No suitable substitutes found",
            },
          }));
          return;
        }

        setSuggestions((prev) => ({
          ...prev,
          [suggestionKey]: { status: "ready", data: response },
        }));
      } catch (err) {
        Alert.alert(
          "Error",
          err instanceof Error ? err.message : "Failed to fetch ingredient substitutes",
          [{ text: "OK" }]
        );

        setSuggestions((prev) => ({
          ...prev,
          [suggestionKey]: {
            status: "error",
            error: err instanceof Error ? err.message : "Failed to fetch ingredient substitutes",
          },
        }));
      }
    },
    [recipe, inventory]
  );

  if (!recipe) {
    return (
      <Background>
        <SafeAreaView style={styles.centered}>
          <Text style={styles.errorTitle}>Recipe not found</Text>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </SafeAreaView>
      </Background>
    );
  }

  return (
    <Background>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.iconButton} onPress={() => router.back()}>
            <ArrowLeft size={20} color="#0f172a" />
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {recipe.title}
          </Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          <View style={styles.heroWrapper}>
            {recipe.imageUrl ? (
              <Image source={{ uri: recipe.imageUrl }} style={styles.heroImage} />
            ) : (
              <LinearGradient colors={["#cffafe", "#bae6fd"]} style={styles.heroImage} />
            )}
            <LinearGradient
              colors={["rgba(15,23,42,0)", "rgba(15,23,42,0.65)"]}
              style={StyleSheet.absoluteFill}
            />
            <Text style={styles.heroTitle}>{recipe.title}</Text>
          </View>

          {headerStats.length > 0 && (
            <View style={styles.statsRow}>
              {headerStats.map((item, idx) => (
                <View key={idx} style={styles.statPill}>
                  {item.icon}
                  <Text style={styles.statLabel}>{item.label}</Text>
                </View>
              ))}
            </View>
          )}

          {!!recipe.description && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Overview</Text>
              <Text style={styles.sectionBody}>{recipe.description}</Text>
            </View>
          )}

          {recipe.ingredients.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Ingredients</Text>
                {matchResult && (
                  <View
                    style={[
                      styles.matchBadge,
                      matchResult.matchScore >= 80
                        ? styles.matchBadgeHigh
                        : matchResult.matchScore >= 50
                        ? styles.matchBadgeMedium
                        : styles.matchBadgeLow,
                    ]}
                  >
                    <Text style={styles.matchBadgeText}>{Math.round(matchResult.matchScore)}% Match</Text>
                  </View>
                )}
              </View>
              <View style={styles.card}>
                {recipe.ingredients.map((ingredient, index) => {
                  const isMissing = matchResult?.missingIngredients.includes(ingredient);
                  const isPartial = matchResult?.partialMatches.some((p) => p.ingredient === ingredient);
                  const isAvailable = !isMissing && !isPartial;
                  const suggestionKey = ingredient;
                  const suggestionState = suggestions[suggestionKey] ?? { status: "idle" };
                  const isLoading = suggestionState.status === "loading";
                  const hasSubstitutes = suggestionState.status === "ready" && suggestionState.data;

                  return (
                    <View key={index}>
                      <View style={styles.ingredientRow}>
                        <TouchableOpacity
                          style={[
                            styles.ingredientButton,
                            isLoading && styles.ingredientButtonLoading,
                            hasSubstitutes && styles.ingredientButtonActive,
                            isAvailable && styles.ingredientButtonAvailable,
                          ]}
                          onPress={() => handleSuggestSubstitute(ingredient)}
                          disabled={isLoading}
                          activeOpacity={0.7}
                        >
                          <Text
                            style={[
                              styles.listItem,
                              isMissing && styles.missingIngredient,
                              isPartial && styles.partialIngredient,
                              isAvailable && styles.availableIngredient,
                            ]}
                          >
                            {isLoading
                              ? "⏳"
                              : hasSubstitutes
                              ? "✓"
                              : isMissing
                              ? "✗"
                              : isPartial
                              ? "⚠"
                              : "•"}{" "}
                            {ingredient}
                          </Text>
                          {isLoading && (
                            <ActivityIndicator size="small" color="#128AFA" style={styles.miniLoader} />
                          )}
                        </TouchableOpacity>
                      </View>

                      {hasSubstitutes && suggestionState.data && (
                        <Animated.View entering={FadeIn.duration(300)} style={styles.substituteContainer}>
                          <Text style={styles.substituteHeader}>Substitute Options:</Text>
                          {suggestionState.data.suggestions.map((suggestion, i) => (
                            <View key={i} style={styles.substituteRow}>
                              <View style={styles.substituteContent}>
                                <Text style={styles.substituteName}>• {suggestion.ingredient}</Text>
                                <Text style={styles.substituteReason}>{suggestion.reason}</Text>
                              </View>
                            </View>
                          ))}
                        </Animated.View>
                      )}
                    </View>
                  );
                })}
              </View>
              <Text style={styles.ingredientHint}>
                Tap any ingredient to find substitutes from your inventory
              </Text>
            </View>
          )}

          {tagList.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Tags</Text>
              <View style={styles.tagRow}>
                {tagList.map((tag) => (
                  <View key={tag} style={styles.tagPill}>
                    <Text style={styles.tagText}>#{tag}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {recipe.instructions.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Instructions</Text>
              <View style={styles.card}>
                {recipe.instructions.map((step) => (
                  <Animated.View
                    key={step.number}
                    entering={FadeInUp.delay(step.number * 40).duration(300)}
                    style={styles.stepRow}
                  >
                    <View style={styles.stepBadge}>
                      <Text style={styles.stepBadgeText}>{step.number}</Text>
                    </View>
                    <Text style={styles.stepText}>{step.step}</Text>
                  </Animated.View>
                ))}
              </View>
            </View>
          )}

          {loading && (
            <View style={styles.loaderRow}>
              <ActivityIndicator size="small" color="#128AFA" />
              <Text style={styles.loaderLabel}>Fetching latest details…</Text>
            </View>
          )}

          {recipe.sourceUrl && (
            <Text style={styles.sourceHint}>
              Source: {recipe.sourceUrl.replace(/^https?:\/\//, "")}
            </Text>
          )}
        </ScrollView>

        <TouchableOpacity style={styles.ctaButton} activeOpacity={0.9}>
          <ChefHat size={20} color="#ffffff" />
          <Text style={styles.ctaText}>Start Cooking</Text>
        </TouchableOpacity>
      </SafeAreaView>
    </Background>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    gap: 16,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#0f172a",
    textAlign: "center",
  },
  backButton: {
    backgroundColor: "#128AFA",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  backButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#e0f2fe",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 18,
    fontWeight: "700",
    color: "#0f172a",
    marginHorizontal: 12,
  },
  scrollContent: {
    paddingBottom: 120,
  },
  heroWrapper: {
    height: 240,
    borderRadius: 24,
    marginHorizontal: 20,
    overflow: "hidden",
    marginBottom: 20,
    justifyContent: "flex-end",
  },
  heroImage: {
    width: "100%",
    height: "100%",
  },
  heroTitle: {
    fontSize: 26,
    fontWeight: "800",
    color: "#fff",
    padding: 20,
    textShadowColor: "rgba(15,23,42,0.4)",
    textShadowOffset: { width: 0, height: 3 },
    textShadowRadius: 6,
  },
  statsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  statPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: "#e0f2fe",
  },
  statLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0f172a",
  },
  section: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#0f172a",
    marginBottom: 12,
  },
  sectionBody: {
    fontSize: 16,
    lineHeight: 24,
    color: "#334155",
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 18,
    gap: 12,
    shadowColor: "#94a3b8",
    shadowOpacity: 0.12,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 12,
    elevation: 3,
  },
  listItem: {
    fontSize: 15,
    lineHeight: 22,
    color: "#1e293b",
  },
  stepRow: {
    flexDirection: "row",
    gap: 14,
    alignItems: "flex-start",
  },
  stepBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#128AFA",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  stepBadgeText: {
    color: "#fff",
    fontWeight: "700",
  },
  stepText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 22,
    color: "#1f2937",
  },
  tagRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  tagPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#e0f2fe",
  },
  tagText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#0f172a",
  },
  loaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  loaderLabel: {
    color: "#475569",
    fontSize: 14,
  },
  sourceHint: {
    textAlign: "center",
    fontSize: 13,
    color: "#64748b",
    marginBottom: 32,
  },
  ctaButton: {
    position: "absolute",
    left: 20,
    right: 20,
    bottom: 32,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 16,
    borderRadius: 18,
    backgroundColor: "#128AFA",
    shadowColor: "#2563eb",
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 12 },
    shadowRadius: 20,
    elevation: 6,
  },
  ctaText: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "700",
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  matchBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  matchBadgeHigh: {
    backgroundColor: "#d1fae5",
  },
  matchBadgeMedium: {
    backgroundColor: "#fed7aa",
  },
  matchBadgeLow: {
    backgroundColor: "#fecaca",
  },
  matchBadgeText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#0f172a",
  },
  ingredientRow: {
    marginBottom: 4,
  },
  ingredientButton: {
    paddingVertical: 6,
    paddingHorizontal: 8,
    marginVertical: 2,
    backgroundColor: "#f8fafc",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  ingredientButtonLoading: {
    backgroundColor: "#f1f5f9",
    borderColor: "#128AFA",
  },
  ingredientButtonActive: {
    backgroundColor: "#e0f2fe",
    borderColor: "#128AFA",
  },
  ingredientButtonAvailable: {
    backgroundColor: "#f8fafc",
    borderColor: "#e2e8f0",
  },
  missingIngredient: {
    color: "#dc2626",
    fontWeight: "600",
  },
  partialIngredient: {
    color: "#d97706",
    fontWeight: "600",
  },
  availableIngredient: {
    color: "#1e293b",
    fontWeight: "400",
  },
  miniLoader: {
    marginLeft: 8,
  },
  substituteContainer: {
    marginTop: 8,
    marginLeft: 16,
    marginBottom: 12,
    paddingLeft: 12,
    borderLeftWidth: 3,
    borderLeftColor: "#128AFA",
    backgroundColor: "#f0f9ff",
    borderRadius: 8,
    padding: 12,
  },
  substituteHeader: {
    fontSize: 13,
    fontWeight: "700",
    color: "#128AFA",
    marginBottom: 8,
  },
  substituteRow: {
    marginBottom: 8,
  },
  substituteContent: {
    gap: 4,
  },
  substituteName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0f172a",
  },
  substituteReason: {
    fontSize: 12,
    color: "#64748b",
    fontStyle: "italic",
    lineHeight: 18,
    paddingLeft: 12,
  },
  ingredientHint: {
    marginTop: 12,
    fontSize: 12,
    color: "#64748b",
    fontStyle: "italic",
    textAlign: "center",
  },
});
