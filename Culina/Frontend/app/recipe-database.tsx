import React, { useCallback, useEffect, useMemo, useState, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import Animated, { FadeInUp, FadeIn } from "react-native-reanimated";
import Background from "@/components/Background";
import { SPOONACULAR_API_KEY } from "@/lib/secrets";
import { useInventory } from "@/hooks/useInventory";
import { matchRecipeWithInventory, type RecipeMatchResult } from "@/lib/ingredientMatcher";
import {
  ArrowLeft,
  RefreshCw,
  ExternalLink,
  Tag,
  MapPin,
} from "lucide-react-native";
import { useRecipeDatabaseState } from "@/contexts/RecipeDatabaseContext";

type RecipeProvider = "spoonacular" | "mealdb";

const SPOONACULAR_RANDOM_ENDPOINT = "https://api.spoonacular.com/recipes/random";
const THEMEALDB_SEARCH_ENDPOINT = "https://www.themealdb.com/api/json/v1/1/search.php?s=";

type RawSpoonacularRecipe = {
  id: number;
  title: string;
  summary?: string | null;
  image?: string | null;
  readyInMinutes?: number | null;
  servings?: number | null;
  dishTypes?: string[] | null;
  cuisines?: string[] | null;
  sourceUrl?: string | null;
  spoonacularSourceUrl?: string | null;
  aggregateLikes?: number | null;
  extendedIngredients?: { original?: string | null }[] | null;
};

type RawMeal = {
  idMeal: string;
  strMeal: string;
  strInstructions?: string | null;
  strMealThumb?: string | null;
  strCategory?: string | null;
  strArea?: string | null;
  strTags?: string | null;
  strSource?: string | null;
  strYoutube?: string | null;
  [key: string]: any;
};

type DatabaseRecipe = {
  id: string;
  title: string;
  description?: string;
  imageUrl?: string;
  ingredients: string[];
  category?: string;
  area?: string;
  tags?: string[];
  sourceUrl?: string | null;
  readyInMinutes?: number | null;
  servings?: number | null;
  provider: RecipeProvider;
  matchResult?: RecipeMatchResult;
  matchScore?: number;
};


const attachMatchMetadata = (recipe: DatabaseRecipe, inventory: any[]) => {
  const matchResult = matchRecipeWithInventory(recipe.ingredients, inventory);

  return {
    ...recipe,
    matchResult,
    matchScore: matchResult.matchScore,
  };
};

const rankRecipesByInventory = (list: DatabaseRecipe[], inventory: any[]) => {
  return list
    .map((recipe) => attachMatchMetadata(recipe, inventory))
    .sort((a, b) => {
      // Sort by match score (higher is better)
      const scoreDiff = (b.matchScore ?? 0) - (a.matchScore ?? 0);
      if (scoreDiff !== 0) return scoreDiff;

      // If scores are equal, sort by title
      return a.title.localeCompare(b.title);
    });
};

const normalizeDescription = (text?: string | null) => {
  if (!text) return undefined;
  const withoutHtml = text.replace(/<[^>]+>/g, " ");
  const cleaned = withoutHtml.replace(/\s+/g, " ").trim();
  if (cleaned.length <= 200) {
    return cleaned;
  }
  return `${cleaned.slice(0, 200).trim()}…`;
};

const extractIngredients = (recipe: RawSpoonacularRecipe) => {
  if (!Array.isArray(recipe.extendedIngredients)) return [];
  return recipe.extendedIngredients
    .map((item) => (typeof item?.original === "string" ? item.original.trim() : ""))
    .filter((item) => !!item);
};

const mapRecipe = (recipe: RawSpoonacularRecipe): DatabaseRecipe => {
  const dishTypes = Array.isArray(recipe.dishTypes) ? recipe.dishTypes.filter(Boolean) : [];
  const cuisines = Array.isArray(recipe.cuisines) ? recipe.cuisines.filter(Boolean) : [];
  return {
    id: String(recipe.id),
    title: recipe.title,
    description: normalizeDescription(recipe.summary),
    imageUrl: recipe.image ?? undefined,
    ingredients: extractIngredients(recipe),
    category: dishTypes.length ? dishTypes[0] : undefined,
    area: cuisines.length ? cuisines[0] : undefined,
    tags: [...dishTypes.slice(1), ...cuisines.slice(1)].map((tag) => tag.replace(/\s+/g, " ")),
    sourceUrl: recipe.sourceUrl || recipe.spoonacularSourceUrl || null,
    readyInMinutes: recipe.readyInMinutes ?? null,
    servings: recipe.servings ?? null,
    provider: "spoonacular",
  };
};

const extractMealIngredients = (meal: RawMeal) => {
  const items: string[] = [];
  for (let idx = 1; idx <= 20; idx += 1) {
    const ingredient = meal[`strIngredient${idx}`];
    const measure = meal[`strMeasure${idx}`];
    if (ingredient && typeof ingredient === "string" && ingredient.trim()) {
      const name = ingredient.trim();
      const qty = typeof measure === "string" && measure.trim() ? measure.trim() : "";
      items.push(qty ? `${name} — ${qty}` : name);
    }
  }
  return items;
};

const mapMeal = (meal: RawMeal): DatabaseRecipe => ({
  id: meal.idMeal,
  title: meal.strMeal,
  description: normalizeDescription(meal.strInstructions),
  imageUrl: meal.strMealThumb ?? undefined,
  ingredients: extractMealIngredients(meal),
  category: meal.strCategory ?? undefined,
  area: meal.strArea ?? undefined,
  tags: meal.strTags
    ? meal.strTags
        .split(",")
        .map((tag: string) => tag.trim())
        .filter(Boolean)
    : undefined,
  sourceUrl: meal.strSource || meal.strYoutube || null,
  readyInMinutes: null,
  servings: null,
  provider: "mealdb",
});

type RecipeDatabaseCardProps = {
  recipe: DatabaseRecipe;
  index: number;
  onPress: () => void;
  missingIngredients: string[];
  partialMatches: Array<{ ingredient: string; percentage: number; inventoryItem: any }>;
};

const RecipeDatabaseCard = ({
  recipe,
  index,
  onPress,
  missingIngredients,
  partialMatches,
}: RecipeDatabaseCardProps) => {
  const tagList = useMemo(() => recipe.tags?.slice(0, 2) ?? [], [recipe.tags]);

  const ingredientsPreview = useMemo(() => recipe.ingredients.slice(0, 3), [recipe.ingredients]);

  const providerLabel = recipe.provider === "spoonacular" ? "Spoonacular" : "TheMealDB";

  return (
    <Animated.View entering={FadeInUp.delay(index * 80).duration(400).springify()} style={styles.card}>
      <TouchableOpacity activeOpacity={0.9} onPress={onPress}>
        {recipe.imageUrl && (
          <Image source={{ uri: recipe.imageUrl }} style={styles.cardImage} resizeMode="cover" />
        )}

        <View style={styles.cardContent}>
          <Text style={styles.cardTitle} numberOfLines={2}>
            {recipe.title}
          </Text>

          {!!recipe.description && (
            <Text style={styles.cardDescription} numberOfLines={3}>
              {recipe.description}
            </Text>
          )}

          {ingredientsPreview.length > 0 && (
            <View style={styles.ingredientsSection}>
              <Text style={styles.sectionLabel}>Key ingredients</Text>
              {ingredientsPreview.map((item, idx) => (
                <Text key={idx} style={styles.ingredientItem} numberOfLines={1}>
                  • {item}
                </Text>
              ))}
            </View>
          )}

          <Animated.View entering={FadeIn.delay(index * 80 + 120).duration(400)} style={styles.metaRow}>
            {recipe.matchResult && (
              <View
                style={[
                  styles.metaPill,
                  recipe.matchResult.matchScore >= 80
                    ? styles.matchHighPill
                    : recipe.matchResult.matchScore >= 50
                    ? styles.matchMediumPill
                    : styles.matchLowPill,
                ]}
              >
                <Text style={styles.metaText}>
                  {recipe.matchResult.matchScore}% Match
                </Text>
              </View>
            )}
            <View style={[styles.metaPill, styles.sourcePill]}>
              <Text style={styles.metaText}>{providerLabel}</Text>
            </View>
            {!!recipe.readyInMinutes && (
              <View style={[styles.metaPill, styles.categoryPill]}>
                <Text style={styles.metaText}>{recipe.readyInMinutes} min</Text>
              </View>
            )}
            {!!recipe.servings && (
              <View style={[styles.metaPill, styles.categoryPill]}>
                <Text style={styles.metaText}>Serves {recipe.servings}</Text>
              </View>
            )}
            {!!recipe.category && (
              <View style={[styles.metaPill, styles.categoryPill]}>
                <Tag size={14} color="#0f172a" />
                <Text style={styles.metaText}>{recipe.category}</Text>
              </View>
            )}
            {!!recipe.area && (
              <View style={[styles.metaPill, styles.areaPill]}>
                <MapPin size={14} color="#0f172a" />
                <Text style={styles.metaText}>{recipe.area}</Text>
              </View>
            )}
            {tagList.map((tag, idx) => (
              <View key={`${recipe.id}-tag-${idx}`} style={[styles.metaPill, styles.tagPill]}>
                <Text style={styles.metaText}>#{tag}</Text>
              </View>
            ))}
          </Animated.View>

          {partialMatches.length > 0 && (
            <View style={styles.partialSection}>
              <Text style={styles.sectionLabel}>Partial matches ({partialMatches.length})</Text>
              {partialMatches.slice(0, 3).map((item, idx) => (
                <View key={`${recipe.id}-partial-${idx}`} style={styles.partialMatchItem}>
                  <Text style={styles.partialMatchText} numberOfLines={1}>
                    • {item.ingredient}
                  </Text>
                  <Text style={styles.partialMatchPercentage}>
                    {item.percentage}% available
                  </Text>
                </View>
              ))}
              {partialMatches.length > 3 && (
                <Text style={styles.moreMissing} numberOfLines={1}>
                  +{partialMatches.length - 3} more
                </Text>
              )}
            </View>
          )}

          {missingIngredients.length > 0 && (
            <View style={styles.missingSection}>
              <View style={styles.missingSectionHeader}>
                <Text style={styles.sectionLabel}>Missing ingredients ({missingIngredients.length})</Text>
              </View>
              {missingIngredients.slice(0, 5).map((item, idx) => (
                <Text key={`${recipe.id}-missing-${idx}`} style={styles.missingItem} numberOfLines={1}>
                  • {item}
                </Text>
              ))}
              {missingIngredients.length > 5 && (
                <Text style={styles.moreMissing} numberOfLines={1}>
                  +{missingIngredients.length - 5} more
                </Text>
              )}
            </View>
          )}

          <TouchableOpacity style={styles.actionButton} activeOpacity={0.85} onPress={onPress}>
            <ExternalLink size={16} color="#0f172a" />
            <Text style={styles.actionButtonText}>View Details</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

export default function RecipeDatabaseScreen() {
  const router = useRouter();
  const { inventory, loading: inventoryLoading } = useInventory();
  const { state: persistedState, updateScrollPosition, updateRecipes } = useRecipeDatabaseState();
  const [recipes, setRecipes] = useState<DatabaseRecipe[]>(persistedState.recipes);
  const [loading, setLoading] = useState(persistedState.recipes.length === 0);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollViewRef = useRef<ScrollView>(null);
  const hasRestoredScroll = useRef(false);
  const hasLoadedRecipes = useRef(persistedState.recipes.length > 0);

  const preparedRecipes = useMemo(() => {
    return recipes.map((recipe) => {
      const matchResult = recipe.matchResult || matchRecipeWithInventory(recipe.ingredients, inventory);
      return {
        recipe: { ...recipe, matchResult },
        missingIngredients: matchResult.missingIngredients,
        partialMatches: matchResult.partialMatches,
        fullMatches: matchResult.fullMatches,
      };
    });
  }, [recipes, inventory]);

  const loadRecipes = useCallback(
    async (mode: "initial" | "refresh" = "initial") => {
      if (mode === "initial") {
        setLoading(true);
      } else {
        setRefreshing(true);
      }

      try {
        setError(null);

        if (!SPOONACULAR_API_KEY) {
          throw new Error("Missing Spoonacular API key");
        }

        const params = new URLSearchParams({
          number: "12",
          apiKey: SPOONACULAR_API_KEY,
        });

        const [spoonacularResponse, mealDbResponse] = await Promise.all([
          fetch(`${SPOONACULAR_RANDOM_ENDPOINT}?${params.toString()}`),
          fetch(THEMEALDB_SEARCH_ENDPOINT),
        ]);

        if (!spoonacularResponse.ok) {
          throw new Error(`Spoonacular request failed with status ${spoonacularResponse.status}`);
        }

        if (!mealDbResponse.ok) {
          throw new Error(`TheMealDB request failed with status ${mealDbResponse.status}`);
        }

        const [spoonacularPayload, mealDbPayload] = await Promise.all([
          spoonacularResponse.json(),
          mealDbResponse.json(),
        ]);

        const spoonacularRecipes: RawSpoonacularRecipe[] = Array.isArray(spoonacularPayload?.recipes)
          ? spoonacularPayload.recipes
          : [];
        const mealDbMeals: RawMeal[] = Array.isArray(mealDbPayload?.meals) ? mealDbPayload.meals : [];

        const combined = [...spoonacularRecipes.map(mapRecipe), ...mealDbMeals.map(mapMeal)];

        if (!combined.length) {
          setRecipes([]);
          setError("No recipes available right now. Please try again later.");
          return;
        }

        const ranked = inventory.length > 0 ? rankRecipesByInventory(combined, inventory) : combined;
        setRecipes(ranked);
        updateRecipes(ranked);
        hasLoadedRecipes.current = true;
      } catch (err) {
        console.error("Failed to load recipes", err);
        setError(err instanceof Error ? err.message : "Failed to load recipes. Please try again.");
      } finally {
        if (mode === "initial") {
          setLoading(false);
        } else {
          setRefreshing(false);
        }
      }
    },
    [inventory, updateRecipes]
  );

  useEffect(() => {
    // Only load recipes if we don't have cached recipes
    if (!hasLoadedRecipes.current) {
      loadRecipes("initial");
    }
  }, [loadRecipes]);

  // Re-rank recipes when inventory changes (without re-fetching)
  const lastInventoryRef = useRef(inventory);
  useEffect(() => {
    // Only re-rank if inventory actually changed and we have cached recipes
    if (hasLoadedRecipes.current && persistedState.recipes.length > 0 &&
        lastInventoryRef.current !== inventory && inventory.length > 0) {
      const reranked = rankRecipesByInventory(persistedState.recipes, inventory);
      setRecipes(reranked);
      updateRecipes(reranked);
      lastInventoryRef.current = inventory;
    }
  }, [inventory, persistedState.recipes, updateRecipes]);

  // Restore scroll position after recipes are loaded
  useEffect(() => {
    if (!loading && recipes.length > 0 && !hasRestoredScroll.current && persistedState.scrollPosition > 0) {
      setTimeout(() => {
        scrollViewRef.current?.scrollTo({
          y: persistedState.scrollPosition,
          animated: false,
        });
        hasRestoredScroll.current = true;
      }, 100);
    }
  }, [loading, recipes.length, persistedState.scrollPosition]);

  const handleScroll = useCallback((event: any) => {
    const yOffset = event.nativeEvent.contentOffset.y;
    updateScrollPosition(yOffset);
  }, [updateScrollPosition]);

  const handleRefresh = useCallback(() => {
    loadRecipes("refresh");
  }, [loadRecipes]);

  return (
    <Background>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
            activeOpacity={0.85}
          >
            <ArrowLeft size={20} color="#0f172a" />
          </TouchableOpacity>

          <Text style={styles.headerTitle}>Recipe Database</Text>

          <TouchableOpacity
            style={[styles.refreshButton, (loading || refreshing) && styles.refreshButtonDisabled]}
            onPress={handleRefresh}
            activeOpacity={0.85}
            disabled={loading || refreshing}
          >
            <RefreshCw size={18} color="#0f172a" />
          </TouchableOpacity>
        </View>

        {loading && !refreshing ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#128AFAFF" />
            <Text style={styles.loadingText}>Fetching recipes…</Text>
          </View>
        ) : (
          <ScrollView
            ref={scrollViewRef}
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            onScroll={handleScroll}
            scrollEventThrottle={400}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                tintColor="#128AFAFF"
              />
            }
          >
            {error ? (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{error}</Text>
                <TouchableOpacity style={styles.retryButton} onPress={() => loadRecipes()} activeOpacity={0.85}>
                  <Text style={styles.retryButtonText}>Try Again</Text>
                </TouchableOpacity>
              </View>
            ) : recipes.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyTitle}>No recipes available</Text>
                <Text style={styles.emptyMessage}>Pull to refresh or check back later for more meals.</Text>
              </View>
            ) : (
              <View style={styles.cardList}>
                {preparedRecipes.map(({ recipe, missingIngredients, partialMatches }, index) => {
                  return (
                    <RecipeDatabaseCard
                      key={recipe.id}
                      recipe={recipe}
                      index={index}
                      missingIngredients={missingIngredients}
                      partialMatches={partialMatches}
                      onPress={() => {
                        const initial = encodeURIComponent(JSON.stringify(recipe));
                        router.push({
                          pathname: "/recipe-database/[id]" as const,
                          params: { id: recipe.id, initial, provider: recipe.provider },
                        });
                      }}
                    />
                  );
                })}
              </View>
            )}
          </ScrollView>
        )}
      </SafeAreaView>
    </Background>
  );
}


const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#e0f2fe",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#0f172a",
  },
  refreshButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#e0f2fe",
  },
  refreshButtonDisabled: {
    opacity: 0.5,
  },
  subtitle: {
    paddingHorizontal: 20,
    fontSize: 15,
    color: "#475569",
    marginBottom: 12,
  },
  providerToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  providerButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
  },
  providerButtonActive: {
    backgroundColor: "#e0f2fe",
    borderColor: "#128AFA",
  },
  providerButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#475569",
  },
  providerButtonTextActive: {
    color: "#0f172a",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
  },
  loadingText: {
    marginTop: 12,
    color: "#6b7280",
    fontSize: 16,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 32,
  },
  errorContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
    paddingHorizontal: 32,
    backgroundColor: "#fee2e2",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#fecaca",
  },
  errorText: {
    color: "#b91c1c",
    fontSize: 16,
    textAlign: "center",
    marginBottom: 16,
  },
  retryButton: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "#128AFAFF",
  },
  retryButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 80,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#334155",
    marginBottom: 8,
  },
  emptyMessage: {
    fontSize: 15,
    color: "#94a3b8",
    textAlign: "center",
  },
  cardList: {
    gap: 20,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    shadowColor: "#94a3b8",
    shadowOpacity: 0.18,
    shadowOffset: { width: 0, height: 5 },
    shadowRadius: 15,
    elevation: 5,
    marginBottom: 0,
    overflow: "hidden",
  },
  cardImage: {
    width: "100%",
    height: 192,
  },
  cardContent: {
    padding: 20,
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#1e293b",
    marginBottom: 8,
  },
  cardDescription: {
    color: "#475569",
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 12,
  },
  ingredientsSection: {
    marginBottom: 16,
    gap: 4,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0f172a",
  },
  ingredientItem: {
    color: "#334155",
    fontSize: 14,
  },
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
    paddingTop: 14,
  },
  metaPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
  },
  metaText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#0f172a",
  },
  sourcePill: {
    backgroundColor: "#e0f2fe",
  },
  matchHighPill: {
    backgroundColor: "#d1fae5",
  },
  matchMediumPill: {
    backgroundColor: "#fed7aa",
  },
  matchLowPill: {
    backgroundColor: "#fecaca",
  },
  categoryPill: {
    backgroundColor: "#f1f5f9",
  },
  areaPill: {
    backgroundColor: "#fef3c7",
  },
  tagPill: {
    backgroundColor: "#f1f5f9",
  },
  actionButton: {
    marginTop: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: "rgba(18,138,250,0.12)",
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0f172a",
  },
  partialSection: {
    marginTop: 16,
    padding: 14,
    borderRadius: 12,
    backgroundColor: "#fef3c7",
    borderWidth: 1,
    borderColor: "#fcd34d",
    gap: 6,
  },
  partialMatchItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  partialMatchText: {
    flex: 1,
    fontSize: 13,
    color: "#78350f",
  },
  partialMatchPercentage: {
    fontSize: 11,
    fontWeight: "600",
    color: "#92400e",
    backgroundColor: "#fef9c3",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  missingSection: {
    marginTop: 16,
    padding: 14,
    borderRadius: 12,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    gap: 6,
  },
  missingSectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  canSuggestHint: {
    fontSize: 11,
    color: "#128AFA",
    fontWeight: "600",
  },
  missingItem: {
    fontSize: 13,
    color: "#1e293b",
  },
  moreMissing: {
    fontSize: 13,
    color: "#475569",
  },
  suggestButton: {
    marginTop: 8,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: "#128AFA",
    alignItems: "center",
    justifyContent: "center",
  },
  suggestButtonDisabled: {
    opacity: 0.6,
  },
  suggestButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#ffffff",
  },
  suggestionError: {
    marginTop: 6,
    fontSize: 13,
    color: "#dc2626",
  },
  suggestionErrorContainer: {
    marginTop: 8,
    padding: 10,
    borderRadius: 8,
    backgroundColor: "#fef2f2",
    borderWidth: 1,
    borderColor: "#fecaca",
    gap: 8,
  },
  retrySmallButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: "#128AFA",
    alignSelf: "flex-start",
  },
  retrySmallButtonText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "600",
  },
  alternativeList: {
    marginTop: 10,
    gap: 10,
  },
  alternativeHeader: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0f172a",
    marginBottom: 4,
  },
  alternativeCard: {
    padding: 12,
    borderRadius: 10,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    gap: 6,
  },
  alternativeTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#0f172a",
  },
  alternativeDescription: {
    fontSize: 13,
    color: "#475569",
  },
  altIngredients: {
    marginTop: 6,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
    gap: 3,
  },
  altIngredientsLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#475569",
  },
  altIngredientItem: {
    fontSize: 12,
    color: "#64748b",
  },
  altMoreIngredients: {
    fontSize: 11,
    color: "#94a3b8",
    fontStyle: "italic",
  },
  moreAlternatives: {
    fontSize: 12,
    color: "#64748b",
    textAlign: "center",
    fontStyle: "italic",
    marginTop: 4,
  },
  noAlternatives: {
    fontSize: 13,
    color: "#64748b",
    fontStyle: "italic",
    marginTop: 8,
  },
  substituteItem: {
    marginTop: 8,
    paddingLeft: 8,
    paddingTop: 8,
    paddingBottom: 8,
    backgroundColor: "#ffffff",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  substituteReason: {
    fontSize: 11,
    color: "#64748b",
    fontStyle: "italic",
    marginTop: 4,
    paddingLeft: 12,
    lineHeight: 16,
  },
  tappableIngredient: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    marginVertical: 4,
    backgroundColor: "#ffffff",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  tappableIngredientLoading: {
    backgroundColor: "#f1f5f9",
    borderColor: "#128AFA",
  },
  tappableIngredientActive: {
    backgroundColor: "#e0f2fe",
    borderColor: "#128AFA",
  },
  missingItemTappable: {
    fontSize: 13,
    color: "#1e293b",
    fontWeight: "500",
    flex: 1,
  },
  ingredientLoader: {
    marginLeft: 8,
  },
  substitutesList: {
    marginTop: 8,
    marginLeft: 16,
    paddingLeft: 12,
    borderLeftWidth: 2,
    borderLeftColor: "#128AFA",
    gap: 8,
  },
  substitutesHeader: {
    fontSize: 12,
    fontWeight: "600",
    color: "#128AFA",
    marginBottom: 4,
  },
  substituteHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
  },
  substituteIngredient: {
    fontSize: 13,
    fontWeight: "600",
    color: "#0f172a",
    flex: 1,
  },
  notInInventoryBadge: {
    backgroundColor: "#fef3c7",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#fcd34d",
  },
  notInInventoryText: {
    fontSize: 10,
    fontWeight: "600",
    color: "#92400e",
  },
});
