import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Alert,
  Modal,
  TextInput,
} from "react-native";
import { styles } from "@/styles/recipe/recipeDetailStyles";
import { useLocalSearchParams, useRouter } from "expo-router";
import { doc, getDoc, onSnapshot, writeBatch } from "firebase/firestore";
import { db, auth } from "@/lib/firebaseConfig";
import { saveRecipeToCollection, isRecipeSaved } from "@/lib/utils/saveRecipe";
import {
  ArrowLeft,
  Clock,
  Users,
  Flame,
  BookmarkPlus,
  ChevronDown,
  Leaf,
  ChefHat,
  Share2,
  Pencil,
  Scale,
  Sparkles,
} from "lucide-react-native";
import AnimatedPageWrapper from "@/app/components/AnimatedPageWrapper";
import CookingMode from "@/components/CookingMode";
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
import { useInventory } from "@/hooks/useInventory";
import { parseIngredient } from "@/lib/ingredientMatcher";
import { shareRecipe, unshareRecipe, isRecipeShared } from "@/lib/utils/shareRecipe";
import { normalizeRecipeSource, isAISource } from "@/lib/utils/recipeSource";
import { RatingModal } from "@/components/ratings/RatingModal";
import { getUserRating } from "@/lib/utils/rateRecipe";
import type { Rating } from "@/types/rating";
import { EQUIPMENT_DB } from "@/lib/equipmentDetector";
import { suggestIngredientSubstitutes, type IngredientSubstitute } from "@/lib/suggestIngredientSubstitutes";

type IngredientEntry = string | { name: string; qty?: string; unit?: string };

type RecipeDoc = Recipe & {
  id: string;
  imageUrl?: string;
  description?: string;
  ingredients?: IngredientEntry[];
  instructions?: string[];
  estimatedCalories?: number;
  source?: "AI" | "Edited" | "Human";
  readyInMinutes?: number;
  tags?: string[];
  servings?: number;
  userId?: string;
  authorUsername?: string;
  authorProfilePicture?: string;
  ratings?: {
    averageRating: number;
    totalRatings: number;
    ratingDistribution: {
      1: number;
      2: number;
      3: number;
      4: number;
      5: number;
    };
    lastRatedAt: any;
  };
};

const HERO_HEIGHT = 320;

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

export default function RecipeDetailsScreen() {
  const router = useRouter();
  const { id, source } = useLocalSearchParams(); // Added 'source' parameter
  const [recipe, setRecipe] = useState<RecipeDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const [userRecipeId, setUserRecipeId] = useState<string | null>(null);
  const [openIngredients, setOpenIngredients] = useState(true);
  const [openInstructions, setOpenInstructions] = useState(true);
  const [cookingMode, setCookingMode] = useState(false);
  const [isShared, setIsShared] = useState(false);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [userRating, setUserRating] = useState<Rating | null>(null);
  const [imageError, setImageError] = useState(false);
  const [authorImageError, setAuthorImageError] = useState(false);
  const [servingMultiplier, setServingMultiplier] = useState(1);
  const [showScalingModal, setShowScalingModal] = useState(false);
  const [customScaleInput, setCustomScaleInput] = useState("");

  // Alternative ingredient state - now tracking per ingredient
  const [expandedIngredientIndex, setExpandedIngredientIndex] = useState<number | null>(null);
  const [alternativeSuggestions, setAlternativeSuggestions] = useState<IngredientSubstitute[]>([]);
  const [loadingAlternatives, setLoadingAlternatives] = useState(false);

  const scrollY = useSharedValue(0);
  const saveButtonScale = useSharedValue(1);
  const shareButtonScale = useSharedValue(1);

  // Use inventory hook for deduction
  const { inventory } = useInventory();

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

  const animatedShareButtonStyle = useAnimatedStyle(() => {
    return { transform: [{ scale: shareButtonScale.value }] };
  });

  const handleSavePress = async () => {
    if (!recipe || !auth.currentUser) return;

    // If already saved, just show message
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
        id: recipe.id,
        title: recipe.title,
        description: recipe.description,
        ingredients: recipe.ingredients || [],
        instructions: recipe.instructions || [],
        servings: recipe.servings,
        estimatedCalories: recipe.estimatedCalories,
        prepTime: recipe.prepTime,
        cookTime: recipe.cookTime,
        difficulty: recipe.difficulty as any,
        cuisine: recipe.cuisine,
        tags: recipe.tags,
        imageUrl: recipe.imageUrl,
        source: recipe.source,
        readyInMinutes: recipe.readyInMinutes,
      }, auth.currentUser.uid);

      if (result.success && result.savedRecipeId) {
        setSaved(true);
        setUserRecipeId(result.savedRecipeId);
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

  const handleStartCooking = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setCookingMode(true);
  };

  const scaleQuantity = (originalQty: string | undefined): string => {
    if (!originalQty) return '';
    const num = parseFloat(originalQty);
    if (isNaN(num)) return originalQty;
    const scaled = num * servingMultiplier;
    return scaled % 1 === 0 ? scaled.toString() : scaled.toFixed(1);
  };

  const handleScaleRecipe = (multiplier: number) => {
    setServingMultiplier(multiplier);
    setShowScalingModal(false);
    setCustomScaleInput("");
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleCustomScale = () => {
    const value = parseFloat(customScaleInput);
    if (!isNaN(value) && value > 0 && value <= 10) {
      setServingMultiplier(value);
      setShowScalingModal(false);
      setCustomScaleInput("");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      Alert.alert("Invalid Input", "Please enter a number between 0.1 and 10");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  // Handle showing alternative ingredients
  const handleShowAlternatives = async (ingredientName: string, index: number) => {
    if (!recipe) return;

    // If clicking the same ingredient, toggle it closed
    if (expandedIngredientIndex === index) {
      setExpandedIngredientIndex(null);
      setAlternativeSuggestions([]);
      return;
    }

    // Expand this ingredient
    setExpandedIngredientIndex(index);
    setLoadingAlternatives(true);
    setAlternativeSuggestions([]);

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      const response = await suggestIngredientSubstitutes({
        recipeTitle: recipe.title,
        recipeDescription: recipe.description,
        targetIngredient: ingredientName,
        inventory: inventory,
      });

      setAlternativeSuggestions(response.suggestions);

      if (response.suggestions.length > 0) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (error) {
      console.error("Failed to load alternatives:", error);
      Alert.alert("Error", "Failed to load alternative ingredients. Please try again.");
      setAlternativeSuggestions([]);
    } finally {
      setLoadingAlternatives(false);
    }
  };

  // Parse ingredient quantity from string using the robust ingredientMatcher utility
  const parseIngredientQuantity = (ingredientEntry: IngredientEntry): { name: string; quantity: number } => {
    let ingredientName = '';
    let quantity = 1;

    if (typeof ingredientEntry === 'string') {
      // If it's a string, use parseIngredient to extract everything
      const parsed = parseIngredient(ingredientEntry);
      ingredientName = parsed.name.trim();
      quantity = parsed.quantity || 1;
    } else {
      // If it's an object, the name field IS the ingredient name
      // The qty and unit are separate fields
      ingredientName = (ingredientEntry.name || '').trim();
      const qtyStr = ingredientEntry.qty || '';

      // Parse quantity from the qty string
      if (qtyStr) {
        // Handle fractions like "1/2" or "1 1/2"
        const fractionMatch = qtyStr.match(/([\d.]+)?\s*\/\s*([\d.]+)/);
        if (fractionMatch) {
          const numerator = parseFloat(fractionMatch[1] || '1');
          const denominator = parseFloat(fractionMatch[2]);
          quantity = numerator / denominator;
        } else {
          // Handle regular numbers
          const numbers = qtyStr.match(/[\d.]+/g);
          if (numbers) {
            quantity = numbers.reduce((sum, num) => sum + parseFloat(num), 0);
          }
        }
      }
    }

    return {
      name: ingredientName,
      quantity: quantity || 1
    };
  };

  // Improved fuzzy matching function
  const findMatchingInventoryItem = (ingredientName: string) => {
    const searchName = ingredientName.toLowerCase().trim();

    // Try exact match first
    let match = inventory.find(item => item.name.toLowerCase().trim() === searchName);
    if (match) return match;

    // Try substring match (inventory contains recipe ingredient)
    match = inventory.find(item => item.name.toLowerCase().includes(searchName));
    if (match) return match;

    // Try reverse substring match (recipe ingredient contains inventory)
    match = inventory.find(item => searchName.includes(item.name.toLowerCase()));
    if (match) return match;

    // Try word-based matching (split by spaces and match any word)
    const searchWords = searchName.split(/\s+/).filter(w => w.length > 2);
    match = inventory.find(item => {
      const itemWords = item.name.toLowerCase().split(/\s+/).filter(w => w.length > 2);
      return searchWords.some(sw => itemWords.some(iw =>
        sw.includes(iw) || iw.includes(sw)
      ));
    });
    if (match) return match;

    return null;
  };

  // Handle ingredient deduction with Firestore batch writes (atomic operation)
  const handleDeductIngredients = useCallback(async (ingredients: IngredientEntry[]) => {
    if (!auth.currentUser?.uid) {
      Alert.alert('Error', 'You must be logged in to deduct ingredients');
      return;
    }

    let deductedCount = 0;
    const notFoundIngredients: string[] = [];
    const batch = writeBatch(db);

    try {
      // First pass: validate and prepare batch operations
      for (const recipeIngredient of ingredients) {
        const { name: ingredientName, quantity: recipeQuantity } = parseIngredientQuantity(recipeIngredient);

        // Find matching ingredient in inventory
        const matchedInventoryItem = findMatchingInventoryItem(ingredientName);

        if (matchedInventoryItem && matchedInventoryItem.id) {
          const newQuantity = Math.max(0, matchedInventoryItem.quantity - recipeQuantity);
          const itemRef = doc(db, 'users', auth.currentUser.uid, 'ingredients', matchedInventoryItem.id);

          if (newQuantity === 0) {
            batch.delete(itemRef);
          } else {
            batch.update(itemRef, { quantity: newQuantity });
          }
          deductedCount++;
        } else {
          notFoundIngredients.push(ingredientName);
        }
      }

      // Execute all operations atomically
      if (deductedCount > 0) {
        await batch.commit();
      }

      if (deductedCount > 0) {
        let message = `Successfully deducted ${deductedCount} ingredient${deductedCount > 1 ? 's' : ''} from your pantry.`;

        if (notFoundIngredients.length > 0) {
          message += `\n\nNot found in pantry:\n${notFoundIngredients.map(i => `• ${i}`).join('\n')}`;
        }

        Alert.alert('Ingredients Deducted!', message, [{ text: 'Great!' }]);
      } else {
        Alert.alert(
          'No Matches Found',
          `None of the recipe ingredients were found in your pantry.\n\nRecipe needs:\n${notFoundIngredients.slice(0, 5).map(i => `• ${i}`).join('\n')}${notFoundIngredients.length > 5 ? '\n...and more' : ''}`,
          [{ text: 'OK' }]
        );
      }
    } catch (err) {
      console.error('Error deducting ingredients (batch failed):', err);
      Alert.alert('Error', 'Failed to update pantry. Please try again.');
      throw err;
    }
  }, [inventory]);

  // Check if recipe is shared
  useEffect(() => {
    const checkSharedStatus = async () => {
      if (!id || !auth.currentUser?.uid || !saved) return;
      try {
        const shared = await isRecipeShared(String(id), auth.currentUser.uid);
        setIsShared(shared);
      } catch (err) {
        console.error('Error checking shared status:', err);
      }
    };
    checkSharedStatus();
  }, [id, saved]);

  // Fetch user's rating for this recipe and listen for real-time updates
  useEffect(() => {
    if (!id || !auth.currentUser?.uid || source !== 'shared') return;

    const currentUserId = auth.currentUser.uid; // Store uid to avoid null checks
    let isMounted = true; // Track if component is still mounted

    const fetchUserRating = async () => {
      // Safety check: ensure user is still logged in
      if (!auth.currentUser || !isMounted) return;

      try {
        const rating = await getUserRating(String(id), currentUserId);
        if (isMounted) {
          setUserRating(rating);
        }
      } catch (err) {
        console.error('Error fetching user rating:', err);
      }
    };

    // Initial fetch
    fetchUserRating();

    // Set up real-time listener for recipe updates (to get updated ratings)
    const recipeRef = doc(db, 'sharedRecipes', String(id));
    const unsubscribe = onSnapshot(
      recipeRef,
      (docSnapshot) => {
        // Safety check: ensure component is still mounted and user is still logged in
        if (!isMounted || !auth.currentUser) return;

        if (docSnapshot.exists()) {
          const data = docSnapshot.data();
          // Update recipe with new ratings data
          if (data?.ratings) {
            setRecipe((prev) => prev ? { ...prev, ratings: data.ratings } : prev);
          }
          // Also refresh user's own rating
          fetchUserRating();
        }
      },
      (error) => {
        console.error('Error listening to recipe updates:', error);
      }
    );

    // Cleanup listener on unmount
    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [id, source]);

  // Refetch user rating when modal closes
  const handleRatingModalClose = async () => {
    setShowRatingModal(false);
    if (id && auth.currentUser?.uid && source === 'shared') {
      const rating = await getUserRating(String(id), auth.currentUser.uid);
      setUserRating(rating);
    }
  };

  useEffect(() => {
    const fetchRecipe = async () => {
      if (!id) {
        setLoading(false);
        return;
      }
      try {
        const uid = auth.currentUser?.uid;
        if (!uid) {
          console.error("User not authenticated");
          setLoading(false);
          return;
        }

        // Check if this is a shared recipe (from URL param or will try sharedRecipes first)
        if (source === 'shared') {
          const sharedRecipeRef = doc(db, 'sharedRecipes', String(id));
          const sharedSnap = await getDoc(sharedRecipeRef);

          if (sharedSnap.exists()) {
            const data = sharedSnap.data();
            setRecipe({ id: sharedSnap.id, ...data } as RecipeDoc);

            // Check if this recipe is already saved in user's collection
            if (data.title) {
              const savedRecipeId = await isRecipeSaved(data.title, uid);
              if (savedRecipeId) {
                setSaved(true);
                setUserRecipeId(savedRecipeId);
              }
            }

            setLoading(false);
            return;
          } else {
            setLoading(false);
            return;
          }
        }

        // Try user's personal recipes first
        const userRecipeRef = doc(db, "users", uid, "recipes", String(id));
        const userRecipeSnap = await getDoc(userRecipeRef);

        if (userRecipeSnap.exists()) {
          const data = userRecipeSnap.data();
          setRecipe({ id: userRecipeSnap.id, ...data } as RecipeDoc);
          setSaved(true);
          setUserRecipeId(userRecipeSnap.id);
          return;
        }

        // Try sharedRecipes as fallback (in case accessed without source param)
        const sharedRecipeRef = doc(db, 'sharedRecipes', String(id));
        const sharedSnap = await getDoc(sharedRecipeRef);

        if (sharedSnap.exists()) {
          const data = sharedSnap.data();
          setRecipe({ id: sharedSnap.id, ...data } as RecipeDoc);

          // Check if this recipe is already saved in user's collection
          if (data.title) {
            const savedRecipeId = await isRecipeSaved(data.title, uid);
            if (savedRecipeId) {
              setSaved(true);
              setUserRecipeId(savedRecipeId);
            }
          }

          return;
        }

        // Final fallback to top-level recipes
        const topLevelRecipeRef = doc(db, "recipes", String(id));
        const topLevelRecipeSnap = await getDoc(topLevelRecipeRef);

        if (topLevelRecipeSnap.exists()) {
          const data = topLevelRecipeSnap.data();
          setRecipe({ id: topLevelRecipeSnap.id, ...data } as RecipeDoc);
        }
      } catch (err) {
        console.error("Failed to fetch recipe:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchRecipe();
  }, [id, source]); // Added 'source' to dependencies

  const handleSharePress = async () => {
    if (!recipe || !auth.currentUser || !saved) {
      Alert.alert('Cannot Share', 'Only saved recipes can be shared with the community.');
      return;
    }

    try {
      shareButtonScale.value = withSpring(0.8, {}, () => {
        shareButtonScale.value = withSpring(1);
      });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      if (isShared) {
        // Unshare the recipe
        Alert.alert(
          'Unshare Recipe',
          'Remove this recipe from the community?',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Unshare',
              style: 'destructive',
              onPress: async () => {
                const result = await unshareRecipe(String(id), auth.currentUser!.uid);
                if (result.success) {
                  setIsShared(false);
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                  Alert.alert('Success', 'Recipe removed from community.');
                } else {
                  Alert.alert('Error', result.error || 'Failed to unshare recipe.');
                }
              },
            },
          ]
        );
      } else {
        // Share the recipe
        Alert.alert(
          'Share Recipe',
          'Share this recipe with the Culina community?',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Share',
              onPress: async () => {
                const result = await shareRecipe(recipe, auth.currentUser!.uid);
                if (result.success) {
                  setIsShared(true);
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                  Alert.alert('Success', 'Recipe shared with the community!');
                } else {
                  Alert.alert('Error', result.error || 'Failed to share recipe.');
                }
              },
            },
          ]
        );
      }
    } catch (err) {
      console.error('Share error:', err);
      Alert.alert('Error', 'An unexpected error occurred.');
    }
  };

  const handleEditPress = () => {
    if (!recipe || !saved || !userRecipeId) return;

    const canEdit = isAISource(recipe.source);
    if (!canEdit) {
      Alert.alert('Cannot Edit', 'Only AI-generated recipes can be edited.');
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push({ pathname: "/recipe/maker", params: { recipeId: userRecipeId } });
  };

  // Helper to determine tag category for styling
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
          {saved && userRecipeId && isAISource(recipe.source) && (
            <TouchableOpacity onPress={handleEditPress}>
              <View style={styles.headerButton}>
                <Pencil color="#0284c7" size={20} />
              </View>
            </TouchableOpacity>
          )}
          {saved && (
            <TouchableOpacity onPress={handleSharePress}>
              <Animated.View style={animatedShareButtonStyle}>
                <View style={[styles.headerButton, isShared && styles.headerButtonActive]}>
                  <Share2 color={isShared ? "#0ea5e9" : "#64748b"} size={20} />
                </View>
              </Animated.View>
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={handleSavePress}>
            <Animated.View style={animatedSaveButtonStyle}>
              <View style={styles.headerButton}>
                <BookmarkPlus color={saved ? "#10b981" : "#0F172A"} size={22} fill={saved ? "#10b981" : "none"} />
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
          {recipe.imageUrl && !imageError ? (
            <Image
              source={{ uri: recipe.imageUrl }}
              style={styles.heroImage}
              resizeMode="cover"
              onError={(error) => {
                console.warn('Failed to load recipe hero image:', recipe.imageUrl, error);
                setImageError(true);
              }}
            />
          ) : (
            <LinearGradient colors={["#128AFA", "#6EC4FF"]} style={styles.heroImage} />
          )}
          <LinearGradient
            colors={["transparent", "rgba(0,0,0,0.3)", "rgba(0,0,0,0.7)"]}
            locations={[0, 0.5, 1]}
            style={styles.heroOverlay}
          >
            <Text style={styles.heroTitle}>{recipe.title}</Text>
          </LinearGradient>
        </Animated.View>

        <View style={styles.contentArea}>
          <Animated.View entering={FadeInUp.delay(100).duration(500).springify()}>
            <View style={styles.card}>
              {/* Author Info for Shared Recipes */}
              {(recipe.authorUsername || source === 'shared') && recipe.userId && (
                <TouchableOpacity
                  style={styles.authorContainer}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    router.push({
                      pathname: `/postHistory` as any,
                      params: {
                        userId: recipe.userId,
                        userName: recipe.authorUsername || 'Anonymous',
                      },
                    });
                  }}
                  activeOpacity={0.7}
                >
                  {!authorImageError ? (
                    <Image
                      source={{
                        uri: recipe.authorProfilePicture || `https://api.dicebear.com/7.x/avataaars/png?seed=${recipe.userId}&size=200`
                      }}
                      style={styles.authorImage}
                      onError={(error) => {
                        console.warn('Failed to load author profile picture:', error);
                        setAuthorImageError(true);
                      }}
                    />
                  ) : (
                    <View style={[styles.authorImage, { backgroundColor: '#0ea5e9', justifyContent: 'center', alignItems: 'center' }]}>
                      <Text style={{ fontSize: 20, fontWeight: '700', color: '#fff' }}>
                        {(recipe.authorUsername || 'A').charAt(0).toUpperCase()}
                      </Text>
                    </View>
                  )}
                  <View style={styles.authorInfo}>
                    <Text style={styles.authorLabel}>Created by</Text>
                    <Text style={styles.authorName}>{recipe.authorUsername || 'Anonymous'}</Text>
                  </View>
                </TouchableOpacity>
              )}

              {/* Source Badge */}
              {recipe.source && (
                <View style={[
                  styles.sourceBadge,
                  isAISource(recipe.source) ? styles.sourceBadgeAI : styles.sourceBadgeHuman
                ]}>
                  {isAISource(recipe.source) ? (
                    <ChefHat color="#1E40AF" size={14} />
                  ) : (
                    <Leaf color="#15803D" size={14} />
                  )}
                  <Text style={[
                    styles.sourceBadgeText,
                    isAISource(recipe.source) ? styles.sourceBadgeTextAI : styles.sourceBadgeTextHuman
                  ]}>
                    {normalizeRecipeSource(recipe.source)}
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
                <View style={styles.cardHeader}>
                  <TouchableOpacity
                    style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}
                    onPress={() => setOpenIngredients((s) => !s)}
                  >
                    <Text style={styles.cardTitle}>Ingredients</Text>
                    {servingMultiplier !== 1 && (
                      <Text style={{ marginLeft: 8, fontSize: 14, color: '#0284c7', fontWeight: '600' }}>
                        ({servingMultiplier}x)
                      </Text>
                    )}
                  </TouchableOpacity>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <TouchableOpacity
                      style={styles.scaleButton}
                      onPress={() => setShowScalingModal(true)}
                    >
                      <Scale size={18} color="#0284c7" />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setOpenIngredients((s) => !s)}>
                      <ChevronDown color="#0F172A" style={{ transform: [{ rotate: openIngredients ? "180deg" : "0deg" }] }} />
                    </TouchableOpacity>
                  </View>
                </View>
                {openIngredients && (
                  <View style={styles.ingredientList}>
                    {recipe.ingredients.map((ing, idx) => {
                      const normalized = normalizeIngredientEntry(ing);
                      const ingName = normalized.name;
                      const qty = normalized.qty;
                      const unit = normalized.unit;

                      // Scale the quantity
                      const scaledQty = scaleQuantity(qty);

                      // Helper to check if unit is in qty (handles plural/singular)
                      const unitInQty = (q: string, u: string): boolean => {
                        if (q.includes(u)) return true;
                        // Check singular/plural variants
                        if (u.endsWith('s') && q.includes(u.slice(0, -1))) return true;
                        if (!u.endsWith('s') && q.includes(u + 's')) return true;
                        return false;
                      };

                      // Check if unit is already in qty to avoid duplication
                      let suffix = '';
                      if (scaledQty && unit) {
                        const qtyLower = scaledQty.toLowerCase();
                        const unitLower = unit.toLowerCase();
                        // If unit is already in qty, just use qty
                        suffix = unitInQty(qtyLower, unitLower) ? scaledQty : `${scaledQty} ${unit}`;
                      } else {
                        suffix = [scaledQty, unit].filter(Boolean).join(" ");
                      }

                      const isExpanded = expandedIngredientIndex === idx;

                      return (
                        <View key={idx}>
                          <View style={styles.ingredientRow}>
                            <View style={styles.ingredientBullet} />
                            <Text style={[styles.ingredientText, { flex: 1 }]}>
                              {ingName}
                              {suffix ? <Text style={styles.ingredientQty}> — {suffix}</Text> : null}
                            </Text>
                            <TouchableOpacity
                              style={{
                                padding: 8,
                                borderRadius: 8,
                                backgroundColor: isExpanded ? '#F59E0B30' : '#F59E0B15',
                              }}
                              onPress={() => handleShowAlternatives(ingName, idx)}
                            >
                              <Sparkles size={18} color="#F59E0B" />
                            </TouchableOpacity>
                          </View>

                          {/* Show alternatives below this ingredient when expanded */}
                          {isExpanded && (
                            <View style={styles.alternativesContainer}>
                              {loadingAlternatives ? (
                                <View style={styles.alternativesLoading}>
                                  <ActivityIndicator size="small" color="#F59E0B" />
                                  <Text style={styles.alternativesLoadingText}>Finding alternatives...</Text>
                                </View>
                              ) : alternativeSuggestions.length > 0 ? (
                                <>
                                  <Text style={styles.alternativesTitle}>Alternative ingredients:</Text>
                                  {alternativeSuggestions.map((suggestion, altIdx) => (
                                    <View key={altIdx} style={styles.alternativeItem}>
                                      <View style={styles.alternativeIconContainer}>
                                        <Sparkles size={16} color="#F59E0B" />
                                      </View>
                                      <View style={styles.alternativeContent}>
                                        <View style={styles.alternativeHeader}>
                                          <Text style={styles.alternativeName}>{suggestion.ingredient}</Text>
                                          {suggestion.inInventory && (
                                            <View style={styles.inInventoryBadge}>
                                              <Text style={styles.inInventoryText}>In Pantry</Text>
                                            </View>
                                          )}
                                        </View>
                                        <Text style={styles.alternativeReason}>{suggestion.reason}</Text>
                                      </View>
                                    </View>
                                  ))}
                                </>
                              ) : (
                                <Text style={styles.noAlternativesText}>No alternatives found.</Text>
                              )}
                            </View>
                          )}
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>
            </Animated.View>
          )}

          {/* Equipment Section */}
          {!!recipe.equipment?.length && (
            <Animated.View entering={FadeInUp.delay(250).duration(500).springify()}>
              <View style={[styles.card, { marginTop: 20 }]}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardTitle}>Equipment</Text>
                </View>
                <View style={styles.equipmentContainer}>
                  {recipe.equipment.map((equipmentKey, idx) => {
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

      <View style={styles.ctaContainer}>
        <TouchableOpacity style={styles.primaryButton} onPress={handleStartCooking}>
          <ChefHat color="white" size={20} />
          <Text style={styles.primaryButtonText}>Start Cooking</Text>
        </TouchableOpacity>
      </View>

      {/* Cooking Mode Modal */}
      <Modal
        visible={cookingMode}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setCookingMode(false)}
      >
        {recipe?.instructions && (
          <CookingMode
            instructions={recipe.instructions}
            recipeTitle={recipe.title}
            onClose={() => setCookingMode(false)}
            ingredients={recipe.ingredients}
            inventory={inventory}
            onDeductIngredients={handleDeductIngredients}
          />
        )}
      </Modal>

      {/* Rating Modal */}
      {source === 'shared' && recipe && (
        <RatingModal
          visible={showRatingModal}
          onClose={handleRatingModalClose}
          sharedRecipeId={String(id)}
          recipeName={recipe.title}
          existingRating={userRating?.rating || 0}
          existingReview={userRating?.review}
        />
      )}

      {/* Scaling Modal */}
      <Modal
        visible={showScalingModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowScalingModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowScalingModal(false)}
        >
          <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Scale Recipe</Text>
              <Text style={styles.modalSubtitle}>Adjust serving size</Text>
              <View style={styles.scaleOptions}>
                {[0.5, 1, 1.5, 2, 3].map((multiplier) => (
                  <TouchableOpacity
                    key={multiplier}
                    style={[
                      styles.scaleOption,
                      servingMultiplier === multiplier && styles.scaleOptionActive,
                    ]}
                    onPress={() => handleScaleRecipe(multiplier)}
                  >
                    <Text
                      style={[
                        styles.scaleOptionText,
                        servingMultiplier === multiplier && styles.scaleOptionTextActive,
                      ]}
                    >
                      {multiplier}x
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.customScaleLabel}>Or enter custom multiplier:</Text>
              <View style={styles.customScaleContainer}>
                <TextInput
                  style={styles.customScaleInput}
                  value={customScaleInput}
                  onChangeText={setCustomScaleInput}
                  placeholder="e.g., 2.5"
                  placeholderTextColor="#94a3b8"
                  keyboardType="decimal-pad"
                  maxLength={5}
                />
                <TouchableOpacity
                  style={styles.customScaleButton}
                  onPress={handleCustomScale}
                >
                  <Text style={styles.customScaleButtonText}>Apply</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </AnimatedPageWrapper>
  );
}