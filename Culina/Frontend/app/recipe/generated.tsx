import React, { useMemo, useState, useEffect } from "react";
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
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
import { saveRecipeToCollection, isRecipeSaved } from "@/lib/utils/saveRecipe";
import { auth } from "@/lib/firebaseConfig";
import { generatedStyles as styles, HERO_HEIGHT } from "@/styles/recipe/generatedStyles";
import { EQUIPMENT_DB, detectEquipment } from "@/lib/equipmentDetector";

type IngredientEntry = string | { name: string; qty?: string; unit?: string };

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

  const scrollY = useSharedValue(0);
  const saveButtonScale = useSharedValue(1);

  const getTagCategory = (tag: string): 'mealType' | 'cookingStyle' | 'dietary' | 'default' => {
    const tagLower = tag.toLowerCase();

    // Meal type tags (breakfast, lunch, dinner, snack, dessert)
    if (['breakfast', 'lunch', 'dinner', 'snack', 'dessert', 'brunch', 'appetizer'].includes(tagLower)) {
      return 'mealType';
    }

    // Cooking style tags (baked, fried, grilled, steamed, etc.)
    if (['baked', 'fried', 'grilled', 'steamed', 'roasted', 'boiled', 'sautéed', 'raw', 'no-cook'].includes(tagLower)) {
      return 'cookingStyle';
    }

    // Dietary tags (vegan, vegetarian, gluten-free, etc.)
    if (['vegan', 'vegetarian', 'gluten-free', 'dairy-free', 'keto', 'paleo', 'low-carb', 'high-protein'].includes(tagLower)) {
      return 'dietary';
    }

    return 'default';
  };

  const getDifficultyStyles = (difficulty: string) => {
    const lower = difficulty.toLowerCase();
    if (lower === 'easy') return { badge: styles.difficultyEasy, text: styles.difficultyTextEasy };
    if (lower === 'medium') return { badge: styles.difficultyMedium, text: styles.difficultyTextMedium };
    if (lower === 'hard') return { badge: styles.difficultyHard, text: styles.difficultyTextHard };
    return { badge: styles.difficultyMedium, text: styles.difficultyTextMedium };
  };

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

  // Detect equipment from instructions and ingredients if not already present
  const detectedEquipmentKeys = useMemo(() => {
    if (!recipe || recipe.equipment?.length) return recipe?.equipment || [];

    const equipment = detectEquipment(
      recipe.instructions || [],
      recipe.ingredients
    );

    // Return just the keys (e.g., 'pot', 'pan') for consistency with recipe.equipment format
    return equipment.map(eq => {
      // Find the key in EQUIPMENT_DB that matches this equipment
      const key = Object.entries(EQUIPMENT_DB).find(([_, value]) => value === eq)?.[0];
      return key;
    }).filter(Boolean) as string[];
  }, [recipe]);

  // Check if recipe is already saved on mount
  useEffect(() => {
    const checkIfSaved = async () => {
      if (!recipe || !auth.currentUser) return;

      const savedRecipeId = await isRecipeSaved(recipe.title, auth.currentUser.uid);
      if (savedRecipeId) {
        setSaved(true);
      }
    };

    checkIfSaved();
  }, [recipe]);

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
              {/* Source Badge */}
              {recipe.source && (
                <View style={styles.sourceBadge}>
                  <Leaf color="#10b981" size={14} />
                  <Text style={styles.sourceText}>
                    {recipe.source}
                  </Text>
                </View>
              )}

              {/* Difficulty Badge */}
              {recipe.difficulty && (
                <View style={[styles.difficultyBadge, getDifficultyStyles(recipe.difficulty).badge]}>
                  <Text style={[styles.difficultyText, getDifficultyStyles(recipe.difficulty).text]}>
                    {recipe.difficulty}
                  </Text>
                </View>
              )}

              {/* Metrics Grid */}
              <View style={styles.metricsGrid}>
                {recipe.prepTime && (
                  <View style={styles.metricCard}>
                    <View style={styles.metricIconContainer}>
                      <Clock color="#128AFA" size={24} />
                    </View>
                    <Text style={styles.metricValue}>{recipe.prepTime}</Text>
                    <Text style={styles.metricLabel}>Prep Time</Text>
                  </View>
                )}
                {recipe.cookTime && (
                  <View style={styles.metricCard}>
                    <View style={styles.metricIconContainer}>
                      <Flame color="#128AFA" size={24} />
                    </View>
                    <Text style={styles.metricValue}>{recipe.cookTime}</Text>
                    <Text style={styles.metricLabel}>Cook Time</Text>
                  </View>
                )}
                {recipe.servings && (
                  <View style={styles.metricCard}>
                    <View style={styles.metricIconContainer}>
                      <Users color="#128AFA" size={24} />
                    </View>
                    <Text style={styles.metricValue}>{recipe.servings}</Text>
                    <Text style={styles.metricLabel}>Servings</Text>
                  </View>
                )}
                {recipe.estimatedCalories && (
                  <View style={styles.metricCard}>
                    <View style={styles.metricIconContainer}>
                      <Flame color="#128AFA" size={24} />
                    </View>
                    <Text style={styles.metricValue}>{recipe.estimatedCalories}</Text>
                    <Text style={styles.metricLabel}>Calories</Text>
                  </View>
                )}
              </View>

              {/* Colored Tags */}
              {recipe.tags && recipe.tags.length > 0 && (
                <View style={styles.tagsContainer}>
                  {recipe.tags.slice(0, 3).map((tag, idx) => {
                    const category = getTagCategory(tag);
                    const tagStyle = category === 'mealType' ? styles.tagMealType :
                                    category === 'cookingStyle' ? styles.tagCookingStyle :
                                    category === 'dietary' ? styles.tagDietary : styles.tag;
                    const textStyle = category === 'mealType' ? styles.tagMealTypeText :
                                     category === 'cookingStyle' ? styles.tagCookingStyleText :
                                     category === 'dietary' ? styles.tagDietaryText : styles.tagText;

                    return (
                      <View key={idx} style={[styles.tag, tagStyle]}>
                        <Text style={[styles.tagText, textStyle]}>{tag}</Text>
                      </View>
                    );
                  })}
                </View>
              )}

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
                        <View key={idx} style={styles.ingredientRow}>
                          <View style={styles.ingredientBullet} />
                          <Text style={styles.ingredientText}>
                            {ingName}
                            {suffix ? <Text style={styles.ingredientQty}> — {suffix}</Text> : null}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>
            </Animated.View>
          )}

          {/* Equipment Section */}
          {!!detectedEquipmentKeys.length && (
            <Animated.View entering={FadeInUp.delay(250).duration(500).springify()}>
              <View style={[styles.card, { marginTop: 20 }]}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardTitle}>Equipment</Text>
                </View>
                <View style={styles.equipmentContainer}>
                  {detectedEquipmentKeys.map((equipmentKey, idx) => {
                    const equipmentItem = EQUIPMENT_DB[equipmentKey];
                    if (!equipmentItem) return null;
                    return (
                      <View key={idx} style={styles.equipmentChip}>
                        <Text style={styles.equipmentIcon}>{equipmentItem.icon}</Text>
                        <Text style={styles.equipmentName}>{equipmentItem.name}</Text>
                      </View>
                    );
                  })}
                </View>
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
