import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  Image,
  Alert,
  Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import Animated, { FadeInUp, FadeIn } from "react-native-reanimated";
import Background from "@/components/Background";
import {
  ArrowLeft,
  RefreshCw,
  ExternalLink,
  Tag,
  MapPin,
} from "lucide-react-native";

const THEMEALDB_SEARCH_ENDPOINT = "https://www.themealdb.com/api/json/v1/1/search.php?s=";

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
  youtubeUrl?: string | null;
};

const normalizeDescription = (text?: string | null) => {
  if (!text) return undefined;
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (cleaned.length <= 200) {
    return cleaned;
  }
  return `${cleaned.slice(0, 200).trim()}…`;
};

const extractIngredients = (meal: RawMeal) => {
  const items: string[] = [];
  for (let idx = 1; idx <= 20; idx += 1) {
    const ingredient = meal[`strIngredient${idx}`];
    const measure = meal[`strMeasure${idx}`];
    if (ingredient && typeof ingredient === "string" && ingredient.trim()) {
      const ingredientLabel = ingredient.trim();
      const measureLabel = typeof measure === "string" && measure.trim() ? measure.trim() : null;
      items.push(measureLabel ? `${ingredientLabel} — ${measureLabel}` : ingredientLabel);
    }
  }
  return items;
};

const mapMealToRecipe = (meal: RawMeal): DatabaseRecipe => ({
  id: meal.idMeal,
  title: meal.strMeal,
  description: normalizeDescription(meal.strInstructions),
  imageUrl: meal.strMealThumb ?? undefined,
  ingredients: extractIngredients(meal),
  category: meal.strCategory ?? undefined,
  area: meal.strArea ?? undefined,
  tags: meal.strTags ? meal.strTags.split(",").map((tag: string) => tag.trim()).filter(Boolean) : undefined,
  sourceUrl: meal.strSource ?? null,
  youtubeUrl: meal.strYoutube ?? null,
});

type RecipeDatabaseCardProps = {
  recipe: DatabaseRecipe;
  index: number;
};

const RecipeDatabaseCard = ({ recipe, index }: RecipeDatabaseCardProps) => {
  const tagList = useMemo(() => recipe.tags?.slice(0, 2) ?? [], [recipe.tags]);

  const handleOpenSource = useCallback(async () => {
    const candidateUrl = recipe.sourceUrl || recipe.youtubeUrl;
    if (!candidateUrl) return;

    try {
      const supported = await Linking.canOpenURL(candidateUrl);
      if (supported) {
        await Linking.openURL(candidateUrl);
      } else {
        throw new Error("Unsupported URL");
      }
    } catch (err) {
      console.warn("Failed to open recipe link", err);
      Alert.alert("Unable to open link", "Please try again later.");
    }
  }, [recipe.sourceUrl, recipe.youtubeUrl]);

  const ingredientsPreview = useMemo(() => recipe.ingredients.slice(0, 3), [recipe.ingredients]);

  return (
    <Animated.View
      entering={FadeInUp.delay(index * 80).duration(400).springify()}
      style={styles.card}
    >
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
          <View style={[styles.metaPill, styles.sourcePill]}>
            <Text style={styles.metaText}>TheMealDB</Text>
          </View>
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

        {(recipe.sourceUrl || recipe.youtubeUrl) && (
          <TouchableOpacity
            style={styles.actionButton}
            activeOpacity={0.85}
            onPress={handleOpenSource}
          >
            <ExternalLink size={16} color="#0f172a" />
            <Text style={styles.actionButtonText}>View Full Recipe</Text>
          </TouchableOpacity>
        )}
      </View>
    </Animated.View>
  );
};

export default function RecipeDatabaseScreen() {
  const router = useRouter();
  const [recipes, setRecipes] = useState<DatabaseRecipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadRecipes = useCallback(async (mode: "initial" | "refresh" = "initial") => {
    if (mode === "initial") {
      setLoading(true);
    } else {
      setRefreshing(true);
    }

    try {
      setError(null);
      const response = await fetch(THEMEALDB_SEARCH_ENDPOINT);
      if (!response.ok) {
        throw new Error(`TheMealDB request failed with status ${response.status}`);
      }

      const payload = await response.json();
      const meals: RawMeal[] = Array.isArray(payload?.meals) ? payload.meals : [];

      if (!meals.length) {
        setRecipes([]);
        setError("No recipes available right now. Please try again later.");
        return;
      }

      const normalized = meals.map(mapMealToRecipe);
      setRecipes(normalized);
    } catch (err) {
      console.error("Failed to load recipes from TheMealDB", err);
      setError("Failed to load recipes. Please try again.");
    } finally {
      if (mode === "initial") {
        setLoading(false);
      } else {
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    loadRecipes();
  }, [loadRecipes]);

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

        <Text style={styles.subtitle}>Browse curated meals sourced from TheMealDB.</Text>

        {loading && !refreshing ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#128AFAFF" />
            <Text style={styles.loadingText}>Fetching recipes…</Text>
          </View>
        ) : (
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
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
                {recipes.map((recipe, index) => (
                  <RecipeDatabaseCard key={recipe.id} recipe={recipe} index={index} />
                ))}
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
    fontSize: 15,
    fontWeight: "600",
    color: "#0f172a",
  },
});
