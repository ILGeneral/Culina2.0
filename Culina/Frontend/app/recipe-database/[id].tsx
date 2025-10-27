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
  Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeInUp, FadeIn } from "react-native-reanimated";
import Background from "@/components/Background";
import { SPOONACULAR_API_KEY } from "@/lib/secrets";
import { ArrowLeft, Clock, Users, ChefHat, MapPin, Tag, Check, X } from "lucide-react-native";
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
  const { inventory, updateIngredient, deleteIngredient } = useInventory();
  const [suggestions, setSuggestions] = useState<Record<string, SuggestionState>>({});

  // Cooking mode states
  const [cookingMode, setCookingMode] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const [isDeductingInventory, setIsDeductingInventory] = useState(false);
  const [hasDeductedInventory, setHasDeductedInventory] = useState(false);

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

  // Parse ingredient quantities from recipe
  const parseIngredientQuantity = (ingredientStr: string): { name: string; quantity: number } => {
    // Extract numbers from the beginning of the string
    const match = ingredientStr.match(/^([\d./]+)\s*([a-zA-Z]*)\s+(.+)$/);
    if (match) {
      const [, numStr, , name] = match;

      // Handle fractions like "1/2"
      let quantity = 1;
      if (numStr.includes('/')) {
        const [numerator, denominator] = numStr.split('/').map(Number);
        quantity = numerator / denominator;
      } else {
        quantity = parseFloat(numStr);
      }

      return { name: name.trim(), quantity: isNaN(quantity) ? 1 : quantity };
    }
    // If no quantity found, assume 1
    return { name: ingredientStr.trim(), quantity: 1 };
  };

  // Deduct ingredients from inventory
  const handleDeductFromPantry = useCallback(async () => {
    if (!recipe || !inventory.length) {
      Alert.alert("No Inventory", "You don't have any items in your pantry to deduct.");
      return;
    }

    if (hasDeductedInventory) {
      Alert.alert(
        "Already Deducted!",
        "You've already deducted ingredients for this recipe. Deduct again?",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Deduct Again", onPress: () => performDeduction() },
        ]
      );
      return;
    }

    performDeduction();
  }, [recipe, inventory, hasDeductedInventory]);

  const performDeduction = useCallback(async () => {
    setIsDeductingInventory(true);
    let deductedCount = 0;
    let errors: string[] = [];

    try {
      for (const recipeIngredient of recipe!.ingredients) {
        const { name: ingredientName, quantity: recipeQuantity } = parseIngredientQuantity(recipeIngredient);

        // Find matching ingredient in inventory (fuzzy match)
        const matchedInventoryItem = inventory.find((item) =>
          item.name.toLowerCase().includes(ingredientName.toLowerCase()) ||
          ingredientName.toLowerCase().includes(item.name.toLowerCase())
        );

        if (matchedInventoryItem && matchedInventoryItem.id) {
          try {
            const newQuantity = Math.max(0, matchedInventoryItem.quantity - recipeQuantity);

            if (newQuantity === 0) {
              // Delete the ingredient if quantity reaches 0
              await deleteIngredient(matchedInventoryItem.id);
            } else {
              // Update the ingredient quantity
              await updateIngredient(matchedInventoryItem.id, { quantity: newQuantity });
            }
            deductedCount++;
          } catch (err) {
            errors.push(`Failed to update ${matchedInventoryItem.name}`);
            console.error(`Error updating ${matchedInventoryItem.name}:`, err);
          }
        }
      }

      setHasDeductedInventory(true);

      if (deductedCount > 0) {
        Alert.alert(
          "Ingredients Deducted!",
          `Successfully deducted ${deductedCount} ingredient${deductedCount > 1 ? 's' : ''} from your pantry.${
            errors.length > 0 ? `\n\nSome ingredients couldn't be updated: ${errors.join(', ')}` : ''
          }`,
          [{ text: "Great!" }]
        );
      } else {
        Alert.alert(
          "No Matches Found",
          "No matching ingredients found in your pantry to deduct.",
          [{ text: "OK" }]
        );
      }
    } catch (err) {
      console.error("Error deducting ingredients:", err);
      Alert.alert(
        "Error",
        "Failed to update pantry. Your ingredients were not deducted.",
        [{ text: "OK" }]
      );
    } finally {
      setIsDeductingInventory(false);
    }
  }, [recipe, inventory, updateIngredient, deleteIngredient]);

  // Start cooking mode
  const handleStartCooking = useCallback(() => {
    if (!recipe || recipe.instructions.length === 0) {
      Alert.alert("No Instructions", "This recipe doesn't have cooking instructions.");
      return;
    }

    setCookingMode(true);
    setCurrentStep(0);
    setCompletedSteps(new Set());
    setHasDeductedInventory(false);
  }, [recipe]);

  // Mark step as complete and advance to next step
  const handleStepComplete = useCallback((stepNumber: number) => {
    setCompletedSteps((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(stepNumber)) {
        newSet.delete(stepNumber);
      } else {
        newSet.add(stepNumber);
        // Auto-advance to next step
        const totalSteps = recipe?.instructions.length || 0;
        if (stepNumber < totalSteps) {
          setCurrentStep(stepNumber); // Move to next step (0-indexed)
        }
      }
      return newSet;
    });
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

        <TouchableOpacity style={styles.ctaButton} activeOpacity={0.9} onPress={handleStartCooking}>
          <ChefHat size={20} color="#ffffff" />
          <Text style={styles.ctaText}>Start Cooking</Text>
        </TouchableOpacity>

        {/* Cooking Mode Modal */}
        <Modal visible={cookingMode} animationType="slide" presentationStyle="pageSheet">
          <SafeAreaView style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() => {
                  Alert.alert(
                    "Exit Cooking Mode?",
                    "Your progress will be lost. Are you sure?",
                    [
                      { text: "Keep Cooking", style: "cancel" },
                      { text: "Exit", style: "destructive", onPress: () => setCookingMode(false) },
                    ]
                  );
                }}
              >
                <X size={24} color="#0f172a" />
              </TouchableOpacity>
              <Text style={styles.modalHeaderTitle}>{recipe?.title}</Text>
              <View style={{ width: 40 }} />
            </View>

            <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalScrollContent}>
              <View style={styles.progressSection}>
                <Text style={styles.progressText}>
                  Progress: {completedSteps.size} / {recipe?.instructions.length || 0} steps
                </Text>
                <View style={styles.progressBar}>
                  <View
                    style={[
                      styles.progressBarFill,
                      {
                        width: `${
                          ((completedSteps.size / (recipe?.instructions.length || 1)) * 100)
                        }%`,
                      },
                    ]}
                  />
                </View>
              </View>

              {recipe?.instructions.map((step) => {
                const isCompleted = completedSteps.has(step.number);
                const isCurrentStep = currentStep === step.number - 1;
                return (
                  <Animated.View
                    key={step.number}
                    entering={FadeInUp.delay(step.number * 50).duration(300)}
                    style={[
                      styles.cookingStepCard,
                      isCompleted && styles.cookingStepCardCompleted,
                      isCurrentStep && !isCompleted && styles.cookingStepCardCurrent,
                    ]}
                  >
                    <View style={styles.cookingStepHeader}>
                      <View style={[styles.stepBadge, isCompleted && styles.stepBadgeCompleted]}>
                        <Text style={[styles.stepBadgeText, isCompleted && styles.stepBadgeTextCompleted]}>
                          {step.number}
                        </Text>
                      </View>
                      <TouchableOpacity
                        style={[styles.checkboxButton, isCompleted && styles.checkboxButtonCompleted]}
                        onPress={() => handleStepComplete(step.number)}
                      >
                        {isCompleted && <Check size={20} color="#ffffff" />}
                      </TouchableOpacity>
                    </View>
                    <Text style={[styles.cookingStepText, isCompleted && styles.cookingStepTextCompleted]}>
                      {step.step}
                    </Text>

                    {/* Mark as Complete Button - Only show for current/incomplete steps */}
                    {!isCompleted && (
                      <TouchableOpacity
                        style={styles.markCompleteButton}
                        onPress={() => handleStepComplete(step.number)}
                      >
                        <Check size={16} color="#ffffff" />
                        <Text style={styles.markCompleteButtonText}>Mark as Complete</Text>
                      </TouchableOpacity>
                    )}
                  </Animated.View>
                );
              })}

              {/* Deduct from Pantry Section - Only show when all steps completed */}
              {completedSteps.size === recipe?.instructions.length && (
                <Animated.View entering={FadeIn.duration(500)} style={styles.deductSection}>
                  <View style={styles.deductInfoCard}>
                    <Text style={styles.deductInfoTitle}>All Steps Completed!</Text>
                    <Text style={styles.deductInfoText}>
                      Tap the button below to automatically deduct the ingredients used from your pantry inventory.
                    </Text>
                  </View>

                  <TouchableOpacity
                    style={[
                      styles.deductButton,
                      isDeductingInventory && styles.deductButtonDisabled,
                      hasDeductedInventory && styles.deductButtonSuccess,
                    ]}
                    onPress={handleDeductFromPantry}
                    disabled={isDeductingInventory}
                  >
                    {isDeductingInventory ? (
                      <ActivityIndicator size="small" color="#ffffff" />
                    ) : (
                      <>
                        <Check size={20} color="#ffffff" />
                        <Text style={styles.deductButtonText}>
                          {hasDeductedInventory ? "Deducted ✓" : "Deduct from Pantry"}
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                </Animated.View>
              )}
            </ScrollView>
          </SafeAreaView>
        </Modal>
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
  // Cooking Mode Modal Styles
  modalContainer: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  modalCloseButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#fee2e2",
    alignItems: "center",
    justifyContent: "center",
  },
  modalHeaderTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: "700",
    color: "#0f172a",
    textAlign: "center",
    marginHorizontal: 12,
  },
  modalScroll: {
    flex: 1,
  },
  modalScrollContent: {
    padding: 20,
    paddingBottom: 100,
  },
  progressSection: {
    marginBottom: 24,
    padding: 16,
    backgroundColor: "#ffffff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  progressText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#0f172a",
    marginBottom: 12,
  },
  progressBar: {
    height: 8,
    backgroundColor: "#e2e8f0",
    borderRadius: 4,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: "#128AFA",
    borderRadius: 4,
  },
  cookingStepCard: {
    marginBottom: 16,
    padding: 16,
    backgroundColor: "#ffffff",
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "#e2e8f0",
  },
  cookingStepCardCompleted: {
    backgroundColor: "#f0fdf4",
    borderColor: "#86efac",
  },
  cookingStepCardCurrent: {
    borderColor: "#128AFA",
    borderWidth: 2,
  },
  cookingStepHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  stepBadgeCompleted: {
    backgroundColor: "#22c55e",
  },
  stepBadgeTextCompleted: {
    color: "#ffffff",
  },
  checkboxButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "#cbd5e1",
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxButtonCompleted: {
    backgroundColor: "#22c55e",
    borderColor: "#22c55e",
  },
  cookingStepText: {
    fontSize: 15,
    lineHeight: 22,
    color: "#1e293b",
  },
  cookingStepTextCompleted: {
    color: "#15803d",
    textDecorationLine: "line-through",
  },
  markCompleteButton: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: "#128AFA",
  },
  markCompleteButtonText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "600",
  },
  deductSection: {
    marginTop: 32,
    gap: 16,
  },
  deductInfoCard: {
    padding: 16,
    backgroundColor: "#eff6ff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#bfdbfe",
  },
  deductInfoTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1e40af",
    marginBottom: 8,
  },
  deductInfoText: {
    fontSize: 14,
    color: "#1e40af",
    lineHeight: 20,
  },
  deductButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 16,
    borderRadius: 16,
    backgroundColor: "#128AFA",
    shadowColor: "#128AFA",
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 16,
    elevation: 6,
  },
  deductButtonDisabled: {
    opacity: 0.6,
  },
  deductButtonSuccess: {
    backgroundColor: "#22c55e",
    shadowColor: "#22c55e",
  },
  deductButtonText: {
    color: "#ffffff",
    fontSize: 17,
    fontWeight: "700",
  },
});
