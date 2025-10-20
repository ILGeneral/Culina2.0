import React, { useEffect, useMemo, useState } from "react";
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
import Animated, { FadeInUp } from "react-native-reanimated";
import Background from "@/components/Background";
import { SPOONACULAR_API_KEY } from "@/lib/secrets";
import {
  ArrowLeft,
  Clock,
  Users,
  Flame,
  Heart,
  ChefHat,
} from "lucide-react-native";

const DETAILS_ENDPOINT = (id: string) =>
  `https://api.spoonacular.com/recipes/${id}/information?includeNutrition=false&apiKey=${SPOONACULAR_API_KEY}`;

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
  likes?: number | null;
  sourceUrl?: string | null;
};

const parseInstructions = (data: any): Step[] => {
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
    likes: fetched.likes ?? initial.likes,
    sourceUrl: fetched.sourceUrl ?? initial.sourceUrl,
  };
};

export default function RecipeDatabaseDetailsScreen() {
  const router = useRouter();
  const { id, initial } = useLocalSearchParams<{ id?: string; initial?: string }>();
  const [recipe, setRecipe] = useState<DetailedRecipe | null>(null);
  const [loading, setLoading] = useState(false);

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
          likes: parsed.likes,
          sourceUrl: parsed.sourceUrl,
        };
        setRecipe(initialData);
      } catch (err) {
        console.warn("Failed to parse initial Spoonacular data", err);
      }
    }

    const fetchDetails = async () => {
      if (!SPOONACULAR_API_KEY) {
        return;
      }
      setLoading(true);
      try {
        const response = await fetch(DETAILS_ENDPOINT(String(id)));
        if (!response.ok) {
          throw new Error(`Spoonacular info request failed (${response.status})`);
        }
        const payload = await response.json();
        const detailed: DetailedRecipe = {
          id: String(payload?.id ?? id),
          title: payload?.title ?? initialData?.title ?? "Recipe",
          description: sanitizeSummary(payload?.summary) ?? initialData?.description,
          imageUrl: payload?.image ?? initialData?.imageUrl,
          ingredients: parseIngredients(payload),
          instructions: parseInstructions(payload),
          readyInMinutes: payload?.readyInMinutes ?? initialData?.readyInMinutes ?? null,
          servings: payload?.servings ?? initialData?.servings ?? null,
          likes: payload?.aggregateLikes ?? initialData?.likes ?? null,
          sourceUrl: payload?.sourceUrl ?? initialData?.sourceUrl ?? null,
        };
        setRecipe((prev) => mergeInitialData(prev ?? initialData ?? detailed, detailed));
      } catch (err) {
        console.error("Failed to fetch Spoonacular detail", err);
        if (!initialData) {
          Alert.alert("Error", "Unable to load this recipe right now.");
        }
      } finally {
        setLoading(false);
      }
    };

    fetchDetails();
  }, [id, initial]);

  const headerStats = useMemo(() => {
    if (!recipe) return [] as { icon: React.ReactNode; label: string }[];
    return [
      recipe.readyInMinutes ? { icon: <Clock size={16} color="#0f172a" />, label: `${recipe.readyInMinutes} min` } : null,
      recipe.servings ? { icon: <Users size={16} color="#0f172a" />, label: `Serves ${recipe.servings}` } : null,
      recipe.likes ? { icon: <Heart size={16} color="#ef4444" />, label: `${recipe.likes} likes` } : null,
    ].filter(Boolean) as { icon: React.ReactNode; label: string }[];
  }, [recipe]);

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
              <Text style={styles.sectionTitle}>Ingredients</Text>
              <View style={styles.card}>
                {recipe.ingredients.map((ingredient, index) => (
                  <Text key={index} style={styles.listItem}>
                    • {ingredient}
                  </Text>
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
});
