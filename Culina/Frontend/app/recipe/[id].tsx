import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Share,
  StyleSheet,
  Pressable,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { doc, getDoc } from "firebase/firestore";
import { db, auth } from "@/lib/firebaseConfig"; // Make sure this path is correct
import {
  ArrowLeft,
  Clock,
  Users,
  Flame,
  Share2,
  BookmarkPlus,
  ChevronDown,
  Leaf,
  Check,
  ChefHat,
  ClipboardPlus,
} from "lucide-react-native";
import AnimatedPageWrapper from "@/app/components/AnimatedPageWrapper"; // Make sure this path is correct
import type { Recipe } from "@/types/recipe"; // Make sure this path is correct
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  interpolate,
  useAnimatedScrollHandler,
  withSpring,
  FadeInUp,
} from "react-native-reanimated";

type RecipeDoc = Recipe & {
  id: string;
  imageUrl?: string;
  description?: string;
  ingredients?: (string | { name: string; qty?: string })[];
  instructions?: string[];
  estimatedCalories?: number;
  source?: "AI" | "Edited" | "Human";
  readyInMinutes?: number;
  tags?: string[];
  servings?: number;
};

const HERO_HEIGHT = 320;

export default function RecipeDetailsScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const [recipe, setRecipe] = useState<RecipeDoc | null>(null);
  const [loading, setLoading] = useState(true);
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

  const handleSavePress = () => {
    saveButtonScale.value = withSpring(0.8, {}, () => {
      saveButtonScale.value = withSpring(1);
    });
    setSaved((s) => !s);
  };

  useEffect(() => {
    const fetchRecipe = async () => {
      console.log("1. Starting fetchRecipe...");
      if (!id) {
        console.log("ERROR: No ID provided in the route.");
        setLoading(false);
        return;
      }
      try {
        const uid = auth.currentUser?.uid;
        if (!uid) {
          console.error("2. ERROR: User is not authenticated. Stopping fetch.");
          setLoading(false);
          return;
        }
        console.log(`2. Authenticated with UID: ${uid} for Recipe ID: ${id}`);

        const userRecipeRef = doc(db, "users", uid, "recipes", String(id));
        console.log("3. Trying to fetch from user's personal recipes...");
        const userRecipeSnap = await getDoc(userRecipeRef);
        console.log("4. Fetched from user's recipes. Exists:", userRecipeSnap.exists());

        if (userRecipeSnap.exists()) {
          const data = userRecipeSnap.data();
          console.log("5. SUCCESS: Found recipe in user's collection.", data);
          setRecipe({ id: userRecipeSnap.id, ...data } as RecipeDoc);
          setSaved(true);
          return; // Stop here if found
        }

        const topLevelRecipeRef = doc(db, "recipes", String(id));
        console.log("6. Fallback: Trying to fetch from top-level recipes...");
        const topLevelRecipeSnap = await getDoc(topLevelRecipeRef);
        console.log("7. Fetched from top-level recipes. Exists:", topLevelRecipeSnap.exists());

        if (topLevelRecipeSnap.exists()) {
          const data = topLevelRecipeSnap.data();
          console.log("8. SUCCESS: Found recipe in top-level collection.", data);
          setRecipe({ id: topLevelRecipeSnap.id, ...data } as RecipeDoc);
        } else {
          console.log("9. Recipe not found in any collection.");
        }
      } catch (err) {
        console.error("FETCH FAILED WITH ERROR:", err);
      } finally {
        console.log("10. FINALLY: Setting loading to false.");
        setLoading(false);
      }
    };

    fetchRecipe();
  }, [id]);

  const toggleIngredient = (index: number) => {
    setCheckedIngredients((prev) => (prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index]));
  };

  const onShare = async () => {
    if (!recipe) return;
    try {
      await Share.share({ message: `${recipe.title} recipe from Culina!` });
    } catch (error) {
      console.log("Share error:", error);
    }
  };

  const chips = useMemo(() => {
    if (!recipe) return [];
    return [
      recipe.estimatedCalories ? { icon: <Flame color="#128AFA" size={18} />, text: `${recipe.estimatedCalories} kcal` } : null,
      recipe.servings ? { icon: <Users color="#128AFA" size={18} />, text: `Serves ${recipe.servings}` } : null,
      recipe.readyInMinutes ? { icon: <Clock color="#128AFA" size={18} />, text: `${recipe.readyInMinutes} mins` } : null,
      recipe.source ? { icon: <Leaf color="#128AFA" size={18} />, text: recipe.source } : null,
    ].filter(Boolean) as { icon: React.ReactNode; text: string }[];
  }, [recipe]);

  if (loading) {
    return (
      <View style={styles.centerScreen}>
        <ActivityIndicator size="large" color="#128AFA" />
        <Text style={styles.loadingText}>Loading recipe...</Text>
      </View>
    );
  }

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
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.headerButton} onPress={onShare}>
            <Share2 color="#0F172A" size={20} />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleSavePress}>
            <Animated.View style={animatedSaveButtonStyle}>
              <View style={styles.headerButton}>
                <BookmarkPlus color={saved ? "#128AFA" : "#0F172A"} size={20} />
              </View>
            </Animated.View>
          </TouchableOpacity>
        </View>
      </View>

      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContainer}
        scrollEventThrottle={16}
        onScroll={scrollHandler}
      >
        <Animated.View style={[styles.hero, animatedHeroStyle]}>
          {recipe.imageUrl ? (
            <Image source={{ uri: recipe.imageUrl }} style={styles.heroImage} resizeMode="cover" />
          ) : (
            <LinearGradient colors={["#128AFA", "#6EC4FF"]} style={styles.heroImage} />
          )}
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
                      const ingName = typeof ing === "string" ? ing : ing.name;
                      const ingQty = typeof ing === "string" ? "" : ing.qty;
                      return (
                        <Pressable key={idx} style={styles.ingredientRow} onPress={() => toggleIngredient(idx)}>
                          <View style={[styles.checkbox, isChecked && styles.checkboxChecked]}>
                            {isChecked && <Check color="white" size={16} />}
                          </View>
                          <Text style={[styles.ingredientText, isChecked && styles.ingredientTextChecked]}>
                            {ingName}
                            {ingQty ? <Text style={styles.ingredientQty}> — {ingQty}</Text> : null}
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

      <View style={styles.ctaContainer}>
        <View style={styles.ctaInner}>
          <TouchableOpacity style={styles.primaryButton}>
            <ChefHat color="white" size={20} />
            <Text style={styles.primaryButtonText}>Cook Now</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryButton}>
            <ClipboardPlus color="#128AFA" size={24} />
          </TouchableOpacity>
        </View>
      </View>
    </AnimatedPageWrapper>
  );
}

const styles = StyleSheet.create({
  centerScreen: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#F8FAFC", paddingHorizontal: 24 },
  loadingText: { marginTop: 8, color: "#475569" },
  notFoundText: { color: "#475569", textAlign: "center", fontSize: 18 },
  goBackButton: { marginTop: 24, backgroundColor: "#128AFA", paddingHorizontal: 28, paddingVertical: 12, borderRadius: 9999 },
  goBackButtonText: { color: "white", fontWeight: "600" },
  header: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
    height: 90,
    backgroundColor: "rgba(255, 255, 255, 0.85)",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(226, 232, 240, 0.7)",
  },
  headerContent: {
    position: "absolute",
    top: 48,
    left: 16,
    right: 16,
    zIndex: 30,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerButton: {
    backgroundColor: "rgba(255, 255, 255, 0.8)",
    borderRadius: 9999,
    padding: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },
  headerTitle: { fontSize: 17, fontWeight: "600", color: "#0F172A", maxWidth: "60%", textAlign: "center" },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 8 },
  scrollContainer: { paddingBottom: 140 },
  hero: { height: HERO_HEIGHT, backgroundColor: "#E0F2FE" },
  heroImage: { width: "100%", height: "100%" },
  heroOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: "flex-end", padding: 24 },
  heroTitle: {
    fontSize: 30,
    lineHeight: 36,
    fontWeight: "bold",
    color: "white",
    textShadowColor: "rgba(0, 0, 0, 0.5)",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  contentArea: { paddingHorizontal: 20, marginTop: -16, zIndex: 10 },
  card: {
    backgroundColor: "white",
    borderRadius: 16,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
  },
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  chipText: {
    marginLeft: 8,
    color: '#334155',
    fontWeight: '500',
    fontSize: 14,
  },
  descriptionText: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    color: '#475569',
    fontSize: 16,
    lineHeight: 24,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1E293B',
  },
  ingredientList: {
    marginTop: 16,
    gap: 4,
  },
  ingredientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    gap: 12,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#CBD5E1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#128AFA',
    borderColor: '#128AFA',
  },
  ingredientText: {
    flex: 1,
    fontSize: 16,
    color: '#334155',
  },
  ingredientTextChecked: {
    textDecorationLine: 'line-through',
    color: '#94A3B8',
  },
  ingredientQty: {
    color: '#64748B',
  },
  instructionsContainer: {
    marginTop: 16,
    gap: 16,
  },
  instructionStep: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
  },
  stepNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#128AFA',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: "#3B82F6",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 4,
  },
  stepNumberText: {
    color: 'white',
    fontWeight: 'bold',
  },
  stepText: {
    flex: 1,
    fontSize: 16,
    lineHeight: 24,
    color: '#334155',
    paddingTop: 4,
  },
  ctaContainer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 24,
    paddingBottom: 24,
    paddingTop: 16,
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
  },
  ctaInner: { flexDirection: "row", alignItems: "center", gap: 12 },
  primaryButton: {
    flex: 1,
    backgroundColor: "#128AFA",
    paddingVertical: 12,
    borderRadius: 9999,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    shadowColor: "#3B82F6",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 4,
  },
  primaryButtonText: { textAlign: "center", color: "white", fontSize: 18, fontWeight: "bold" },
  secondaryButton: { padding: 12, backgroundColor: "#E0F2FE", borderRadius: 9999, justifyContent: "center", aspectRatio: 1 },
});