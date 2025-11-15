import React, { useCallback, useEffect, useMemo, useState, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
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
import { recipeDatabaseStyles as styles } from "@/styles/recipeDatabaseStyles";

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
  // Includes 3 tags: meal-type, cooking-style, and dietary-attribute
  const tagList = useMemo(() => recipe.tags?.slice(0, 3) ?? [], [recipe.tags]);

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

        let spoonacularRecipes: RawSpoonacularRecipe[] = [];
        let mealDbMeals: RawMeal[] = [];
        let spoonacularError: string | null = null;

        // Try to fetch from both APIs, but don't fail if one fails
        try {
          if (SPOONACULAR_API_KEY) {
            const params = new URLSearchParams({
              number: "12",
              apiKey: SPOONACULAR_API_KEY,
            });

            const spoonacularResponse = await fetch(`${SPOONACULAR_RANDOM_ENDPOINT}?${params.toString()}`);

            if (spoonacularResponse.ok) {
              const spoonacularPayload = await spoonacularResponse.json();
              spoonacularRecipes = Array.isArray(spoonacularPayload?.recipes)
                ? spoonacularPayload.recipes
                : [];
            } else if (spoonacularResponse.status === 402) {
              spoonacularError = "Spoonacular API quota exceeded. Showing recipes from TheMealDB.";
              console.warn("Spoonacular API quota exceeded (402)");
            } else {
              spoonacularError = `Spoonacular API error (${spoonacularResponse.status})`;
              console.warn(`Spoonacular API failed with status ${spoonacularResponse.status}`);
            }
          }
        } catch (err) {
          console.warn("Spoonacular fetch failed:", err);
          spoonacularError = "Spoonacular temporarily unavailable.";
        }

        // Always try to fetch from TheMealDB
        try {
          const mealDbResponse = await fetch(THEMEALDB_SEARCH_ENDPOINT);
          if (mealDbResponse.ok) {
            const mealDbPayload = await mealDbResponse.json();
            mealDbMeals = Array.isArray(mealDbPayload?.meals) ? mealDbPayload.meals : [];
          } else {
            console.warn(`TheMealDB API failed with status ${mealDbResponse.status}`);
          }
        } catch (err) {
          console.warn("TheMealDB fetch failed:", err);
        }

        const combined = [...spoonacularRecipes.map(mapRecipe), ...mealDbMeals.map(mapMeal)];

        if (!combined.length) {
          setRecipes([]);
          setError(
            spoonacularError
              ? `${spoonacularError} Unable to fetch recipes from TheMealDB as well.`
              : "No recipes available right now. Please try again later."
          );
          return;
        }

        // Show a warning if Spoonacular failed but we have TheMealDB recipes
        if (spoonacularError && mealDbMeals.length > 0) {
          console.info(spoonacularError);
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

  // Re-ranks recipes when inventory changes (without re-fetching)
  const lastInventoryRef = useRef(inventory);
  useEffect(() => {
    // Re-ranks only if inventory actually changed and we have cached recipes
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
