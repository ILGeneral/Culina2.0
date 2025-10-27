import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Pressable,
  Alert,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  ArrowLeft,
  Clock,
  Users,
  Flame,
  BookmarkPlus,
  ChevronDown,
  Leaf,
  Check,
} from "lucide-react-native";
import AnimatedPageWrapper from "@/app/components/AnimatedPageWrapper";
import type { Recipe } from "@/types/recipe";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  interpolate,
  useAnimatedScrollHandler,
  withSpring,
  FadeInUp,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { saveRecipeToCollection } from "@/lib/utils/saveRecipe";
import { auth } from "@/lib/firebaseConfig";

type IngredientEntry = string | { name: string; qty?: string; unit?: string };

const HERO_HEIGHT = 320;

const extractRecipe = (raw?: string | string[]): Recipe | null => {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value) return null;
  try {
    return JSON.parse(decodeURIComponent(value)) as Recipe;
  } catch (err) {
    console.error("Failed to parse recipe payload:", err);
    return null;
  }
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

const normalizeIngredientEntry = (ingredient: IngredientEntry): { name: string; qty?: string; unit?: string } => {
  if (typeof ingredient === "string") {
    return parseIngredientString(ingredient);
  }
  const name = ingredient.name?.trim() ?? "";
  const qty = ingredient.qty?.trim();
  const unit = ingredient.unit?.trim();
  return {
    name,
    ...(qty ? { qty } : {}),
    ...(unit ? { unit } : {}),
  };
};

const GeneratedRecipeDetailsScreen = () => {
  const router = useRouter();
  const params = useLocalSearchParams<{ data?: string | string[] }>();
  const [saved, setSaved] = useState(false);
  const [openIngredients, setOpenIngredients] = useState(true);
  const [openInstructions, setOpenInstructions] = useState(true);
  const [checkedIngredients, setCheckedIngredients] = useState<number[]>([]);

  const scrollY = useSharedValue(0);
  const saveButtonScale = useSharedValue(1);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });

  const animatedHeroStyle = useAnimatedStyle(() => {
    const scale = interpolate(scrollY.value, [-150, 0], [1.2, 1], "clamp");
    const translateY = interpolate(scrollY.value, [0, HERO_HEIGHT], [0, -HERO_HEIGHT / 3], "clamp");
    return { transform: [{ scale }, { translateY }] };
  });

  const animatedHeaderStyle = useAnimatedStyle(() => {
    const opacity = interpolate(scrollY.value, [0, HERO_HEIGHT * 0.7, HERO_HEIGHT], [0, 0, 1], "clamp");
    return { opacity };
  });

  const animatedCompactTitleStyle = useAnimatedStyle(() => {
    const opacity = interpolate(scrollY.value, [0, HERO_HEIGHT * 0.8, HERO_HEIGHT], [0, 0, 1], "clamp");
    return { opacity };
  });

  const animatedSaveButtonStyle = useAnimatedStyle(() => {
    return { transform: [{ scale: saveButtonScale.value }] };
  });

  const recipe = useMemo(() => extractRecipe(params.data), [params.data]);

  const handleSavePress = async () => {
    if (!recipe || !auth.currentUser) return;

    if (saved) {
      Alert.alert("Already Saved", "This recipe is already in your collection.");
      return;
    }

    try {
      saveButtonScale.value = withSpring(0.8, {}, () => {
        saveButtonScale.value = withSpring(1);
      });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      const result = await saveRecipeToCollection({
        title: recipe.title,
        description: recipe.description,
        ingredients: recipe.ingredients || [],
        instructions: recipe.instructions || [],
        servings: recipe.servings,
        estimatedCalories: recipe.estimatedCalories,
        source: recipe.source || "AI Generated",
      }, auth.currentUser.uid);

      if (result.success) {
        setSaved(true);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert("Saved!", "Recipe has been saved to your collection.");
      } else {
        Alert.alert("Already Saved", result.error || "This recipe is already in your collection.");
      }
    } catch (error) {
      console.error("Save error:", error);
      Alert.alert("Error", "Failed to save recipe. Please try again.");
    }
  };

  const toggleIngredient = (index: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCheckedIngredients((prev) => (prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index]));
  };

  const chips = useMemo(() => {
    if (!recipe) return [];
    return [
      recipe.estimatedCalories ? { icon: <Flame color="#128AFA" size={18} />, text: `${recipe.estimatedCalories} kcal` } : null,
      recipe.servings ? { icon: <Users color="#128AFA" size={18} />, text: `Serves ${recipe.servings}` } : null,
      recipe.source ? { icon: <Leaf color="#128AFA" size={18} />, text: recipe.source } : null,
    ].filter(Boolean) as { icon: React.ReactNode; text: string }[];
  }, [recipe]);

  if (!recipe) {
    return (
      <View style={styles.centerScreen}>
        <Text style={styles.notFoundText}>Recipe not found.</Text>
        <TouchableOpacity style={styles.goBackButton} onPress={() => router.back()}>
          <Text style={styles.goBackButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <AnimatedPageWrapper>
      <LinearGradient colors={["#FFFFFF", "#F1F5F9"]} style={StyleSheet.absoluteFill} />

      <Animated.View style={[styles.header, animatedHeaderStyle]} />

      <View style={styles.headerContent}>
        <TouchableOpacity style={styles.headerButton} onPress={() => router.back()}>
          <ArrowLeft color="#0F172A" size={22} />
        </TouchableOpacity>
        <Animated.Text numberOfLines={1} style={[styles.headerTitle, animatedCompactTitleStyle]}>
          {recipe.title}
        </Animated.Text>
        <TouchableOpacity onPress={handleSavePress}>
          <Animated.View style={animatedSaveButtonStyle}>
            <View style={styles.headerButton}>
              <BookmarkPlus color={saved ? "#10b981" : "#0F172A"} size={22} fill={saved ? "#10b981" : "none"} />
            </View>
          </Animated.View>
        </TouchableOpacity>
      </View>

      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContainer}
        scrollEventThrottle={16}
        onScroll={scrollHandler}
      >
        <Animated.View style={[styles.hero, animatedHeroStyle]}>
          <LinearGradient colors={["#128AFA", "#6EC4FF"]} style={styles.heroImage} />
          <LinearGradient colors={["transparent", "rgba(0,0,0,0.6)"]} style={styles.heroOverlay}>
            <Text style={styles.heroTitle}>{recipe.title}</Text>
          </LinearGradient>
        </Animated.View>

        <View style={styles.contentArea}>
          <Animated.View entering={FadeInUp.delay(100).duration(500).springify()}>
            <View style={styles.card}>
              <View style={styles.chipsContainer}>
                {chips.map((chip, idx) => (
                  <View key={idx} style={styles.chip}>
                    {chip.icon}
                    <Text style={styles.chipText}>{chip.text}</Text>
                  </View>
                ))}
              </View>
              {!!recipe.description && (
                <Text style={styles.descriptionText}>{recipe.description}</Text>
              )}
            </View>
          </Animated.View>

          {!!recipe.ingredients?.length && (
            <Animated.View entering={FadeInUp.delay(200).duration(500).springify()}>
              <View style={[styles.card, { marginTop: 20 }]}>
                <TouchableOpacity style={styles.cardHeader} onPress={() => setOpenIngredients((s) => !s)}>
                  <Text style={styles.cardTitle}>Ingredients</Text>
                  <ChevronDown color="#0F172A" style={{ transform: [{ rotate: openIngredients ? "180deg" : "0deg" }] }} />
                </TouchableOpacity>
                {openIngredients && (
                  <View style={styles.ingredientList}>
                    {recipe.ingredients.map((ing, idx) => {
                      const isChecked = checkedIngredients.includes(idx);
                      const normalized = normalizeIngredientEntry(ing);
                      const ingName = normalized.name;
                      const qty = normalized.qty;
                      const unit = normalized.unit;

                      // Helper to check if unit is in qty (handles plural/singular)
                      const unitInQty = (q: string, u: string): boolean => {
                        if (q.includes(u)) return true;
                        if (u.endsWith('s') && q.includes(u.slice(0, -1))) return true;
                        if (!u.endsWith('s') && q.includes(u + 's')) return true;
                        return false;
                      };

                      let suffix = '';
                      if (qty && unit) {
                        const qtyLower = qty.toLowerCase();
                        const unitLower = unit.toLowerCase();
                        suffix = unitInQty(qtyLower, unitLower) ? qty : `${qty} ${unit}`;
                      } else {
                        suffix = [qty, unit].filter(Boolean).join(" ");
                      }

                      return (
                        <Pressable key={idx} style={styles.ingredientRow} onPress={() => toggleIngredient(idx)}>
                          <View style={[styles.checkbox, isChecked && styles.checkboxChecked]}>
                            {isChecked && <Check color="white" size={16} />}
                          </View>
                          <Text style={[styles.ingredientText, isChecked && styles.ingredientTextChecked]}>
                            {ingName}
                            {suffix ? <Text style={styles.ingredientQty}> — {suffix}</Text> : null}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                )}
              </View>
            </Animated.View>
          )}

          {!!recipe.instructions?.length && (
            <Animated.View entering={FadeInUp.delay(300).duration(500).springify()}>
              <View style={[styles.card, { marginTop: 20, marginBottom: 20 }]}>
                <TouchableOpacity style={styles.cardHeader} onPress={() => setOpenInstructions((s) => !s)}>
                  <Text style={styles.cardTitle}>Instructions</Text>
                  <ChevronDown color="#0F172A" style={{ transform: [{ rotate: openInstructions ? "180deg" : "0deg" }] }} />
                </TouchableOpacity>
                {openInstructions && (
                  <View style={styles.instructionsContainer}>
                    {recipe.instructions.map((step, idx) => (
                      <View key={idx} style={styles.instructionStep}>
                        <View style={styles.stepNumber}>
                          <Text style={styles.stepNumberText}>{idx + 1}</Text>
                        </View>
                        <Text style={styles.stepText}>{step}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            </Animated.View>
          )}
        </View>
      </Animated.ScrollView>
    </AnimatedPageWrapper>
  );
};

export default GeneratedRecipeDetailsScreen;

const styles = StyleSheet.create({
  centerScreen: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F1F5F9",
    padding: 24,
  },
  notFoundText: {
    fontSize: 20,
    fontWeight: "600",
    color: "#0F172A",
    marginBottom: 16,
  },
  goBackButton: {
    backgroundColor: "#128AFA",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  goBackButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  header: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 100,
    backgroundColor: "#FFFFFF",
    zIndex: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  headerContent: {
    position: "absolute",
    top: 60,
    left: 0,
    right: 0,
    height: 50,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    zIndex: 11,
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  headerTitle: {
    flex: 1,
    marginHorizontal: 12,
    fontSize: 18,
    fontWeight: "700",
    color: "#0F172A",
    textAlign: "center",
  },
  scrollContainer: {
    paddingBottom: 40,
  },
  hero: {
    height: HERO_HEIGHT,
    width: "100%",
    overflow: "hidden",
  },
  heroImage: {
    width: "100%",
    height: "100%",
  },
  heroOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: "60%",
    justifyContent: "flex-end",
    padding: 20,
  },
  heroTitle: {
    fontSize: 32,
    fontWeight: "800",
    color: "#FFFFFF",
    textShadowColor: "rgba(0, 0, 0, 0.3)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  contentArea: {
    paddingHorizontal: 16,
    marginTop: -40,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  chipsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 16,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  chipText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#334155",
  },
  descriptionText: {
    fontSize: 15,
    lineHeight: 22,
    color: "#64748B",
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#0F172A",
  },
  ingredientList: {
    gap: 12,
  },
  ingredientRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: "#CBD5E1",
    justifyContent: "center",
    alignItems: "center",
  },
  checkboxChecked: {
    backgroundColor: "#128AFA",
    borderColor: "#128AFA",
  },
  ingredientText: {
    flex: 1,
    fontSize: 15,
    color: "#1E293B",
  },
  ingredientTextChecked: {
    textDecorationLine: "line-through",
    color: "#94A3B8",
  },
  ingredientQty: {
    color: "#64748B",
    fontWeight: "500",
  },
  instructionsContainer: {
    gap: 16,
  },
  instructionStep: {
    flexDirection: "row",
    gap: 12,
  },
  stepNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#128AFA",
    justifyContent: "center",
    alignItems: "center",
  },
  stepNumberText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  stepText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 22,
    color: "#334155",
  },
});
