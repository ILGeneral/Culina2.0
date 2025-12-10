// Displays shared recipe cards with animations in the home screen
// Shows recipe details, ratings, comments count, and action buttons (edit/unshare)
// Tap to view full recipe details and ratings
import React, { useMemo, useState } from "react";
import { View, Text, Image, TouchableOpacity, Alert } from "react-native";
import Animated, { FadeInUp, FadeIn } from "react-native-reanimated";
import { useRouter } from "expo-router";
import { Users, Flame, MessageCircle, Star, Share2, Pencil } from "lucide-react-native";
import { normalizeRecipeSource } from "@/lib/utils/recipeSource";
import { StarRating } from "../ratings/StarRating";
import { RatingModal } from "../ratings/RatingModal";
import * as Haptics from "expo-haptics";
import { styles } from "@/styles/components/home/animatedRecipeCardStyles";
import { unshareRecipe } from "@/lib/utils/shareRecipe";
import { auth } from "@/lib/firebaseConfig";

// Converts Firestore timestamp to readable date string
const formatTimestamp = (val: any): string | null => {
  if (!val) return null;
  try {
    if (typeof val?.toDate === "function") {
      return val.toDate().toLocaleDateString();
    }
    if (typeof val?.seconds === "number") {
      return new Date(val.seconds * 1000).toLocaleDateString();
    }
    if (typeof val === "number") {
      return new Date(val).toLocaleDateString();
    }
    const parsed = new Date(val);
    if (!isNaN(parsed.getTime())) {
      return parsed.toLocaleDateString();
    }
  } catch (err) {
    console.warn("Unable to format timestamp", err);
  }
  return null;
};

type IngredientEntry = string | { name: string; qty?: string; unit?: string };

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

const formatIngredientLabel = (ingredient: IngredientEntry) => {
  const normalized = normalizeIngredientEntry(ingredient);
  const parts = [normalized.name].filter(Boolean) as string[];
  const amount = normalized.qty;
  const unit = normalized.unit;
  if (amount || unit) {
    const qtyUnit = [amount, unit].filter(Boolean).join(" ");
    parts.push(qtyUnit);
  }
  return parts.join(" — ");
};

const toPreviewList = (items: IngredientEntry[] | undefined) => {
  if (!Array.isArray(items)) return [];
  return items
    .slice(0, 3)
    .map((item) => formatIngredientLabel(item))
    .filter(Boolean);
};

type AnimatedRecipeCardProps = {
  recipe: {
    id: string;
    title: string;
    description?: string;
    imageUrl?: string;
    estKcal?: number;
    estimatedCalories?: number;
    servings?: number;
    sharedAt?: any;
    ingredients?: IngredientEntry[];
    source?: string;
    isShared?: boolean;
    userRecipeId?: string;
    userId?: string;
    ratings?: {
      averageRating: number;
      totalRatings: number;
      ratingDistribution?: { 1: number; 2: number; 3: number; 4: number; 5: number };
    };
  };
  index: number;
  showUnshareButton?: boolean;
  showEditButton?: boolean;
  onRecipeUnshared?: () => void;
};

export default function AnimatedRecipeCard({ recipe, index, showUnshareButton = false, showEditButton = false, onRecipeUnshared }: AnimatedRecipeCardProps) {
  const router = useRouter();
  const [showRatingModal, setShowRatingModal] = useState(false);

  const handleEdit = (e: any) => {
    e.stopPropagation();
    if (!recipe.userRecipeId) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push({
      pathname: `/recipe/maker` as any,
      params: { recipeId: recipe.userRecipeId }
    });
  };

  const handleUnshare = async (e: any) => {
    e.stopPropagation();

    if (!recipe.userRecipeId || !auth.currentUser) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    Alert.alert(
      'Unshare Recipe',
      'Remove this recipe from the community?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unshare',
          style: 'destructive',
          onPress: async () => {
            const result = await unshareRecipe(recipe.userRecipeId!, auth.currentUser!.uid);
            if (result.success) {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              Alert.alert('Success', 'Recipe removed from community.');
              onRecipeUnshared?.();
            } else {
              Alert.alert('Error', result.error || 'Failed to unshare recipe.');
            }
          },
        },
      ]
    );
  };

  const previewIngredients = useMemo(() => toPreviewList(recipe.ingredients), [recipe.ingredients]);
  const sharedDate = useMemo(() => formatTimestamp(recipe.sharedAt) || formatTimestamp((recipe as any)?.createdAt), [recipe.sharedAt, (recipe as any)?.createdAt]);
  const commentCount = useMemo(() => (recipe as any)?.commentCount ?? 0, [recipe]);

  const handlePress = () => {
    if (recipe.isShared) {
      router.push({
        pathname: `/recipe/[id]` as any,
        params: { 
          id: recipe.id,
          source: 'shared'
        }
      });
    } else {
      router.push(`/recipe/${recipe.id}`);
    }
  };

  const handleCommentPress = () => {
    if (!recipe?.id) return;
    router.push({
      pathname: `/recipe/[id]/comments` as any,
      params: {
        id: recipe.id,
        title: recipe.title,
      },
    });
  };

  const handleRatingsPress = () => {
    if (!recipe?.id) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const defaultDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    const distribution = recipe.ratings?.ratingDistribution
      ? { ...defaultDistribution, ...recipe.ratings.ratingDistribution }
      : defaultDistribution;

    router.push({
      pathname: `/recipe/[id]/ratings` as any,
      params: {
        id: recipe.id,
        title: recipe.title || 'Recipe',
        averageRating: recipe.ratings?.averageRating || 0,
        totalRatings: recipe.ratings?.totalRatings || 0,
        ratingDistribution: JSON.stringify(distribution),
      },
    });
  };

  // Use estimatedCalories or estKcal
  const calories = recipe.estimatedCalories || recipe.estKcal;

  const displaySource = normalizeRecipeSource(recipe.source);
  const ingredientCount = Array.isArray(recipe.ingredients) ? recipe.ingredients.length : undefined;

  return (
    <Animated.View
      entering={FadeInUp.delay(index * 100).duration(400).springify()}
      style={styles.cardWrapper}
    >
      <TouchableOpacity onPress={handlePress} activeOpacity={0.85}>
        {recipe.imageUrl && (
          <Image source={{ uri: recipe.imageUrl }} style={styles.cover} resizeMode="cover" />
        )}

        <View style={styles.content}>
          <View style={styles.titleRow}>
            <Text style={styles.title} numberOfLines={2}>
              {recipe.title}
            </Text>
            {(showEditButton || showUnshareButton) && (
              <View style={styles.cardActions}>
                {showEditButton && (
                  <TouchableOpacity
                    onPress={handleEdit}
                    style={styles.iconButton}
                    activeOpacity={0.7}
                  >
                    <Pencil size={20} color="#0284c7" />
                  </TouchableOpacity>
                )}
                {showUnshareButton && (
                  <TouchableOpacity
                    onPress={handleUnshare}
                    style={[styles.iconButton, styles.iconButtonActive]}
                    activeOpacity={0.7}
                  >
                    <Share2 size={20} color="#0ea5e9" />
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>

          {!!recipe.description && (
            <Text style={styles.description} numberOfLines={2}>
              {recipe.description}
            </Text>
          )}

          {previewIngredients.length > 0 && (
            <View style={styles.previewSection}>
              <Text style={styles.previewLabel}>Key ingredients</Text>
              {previewIngredients.map((item, idx) => (
                <Text key={idx} style={styles.previewItem} numberOfLines={1}>
                  • {item}
                </Text>
              ))}
            </View>
          )}

          <Animated.View entering={FadeIn.delay(index * 100 + 150).duration(400)} style={styles.metaRow}>
            <View style={[styles.metaPill, styles.sourcePill]}>
              <Text style={styles.metaText}>{displaySource}</Text>
            </View>
            {!!recipe.servings && (
              <View style={[styles.metaPill, styles.servingsPill]}>
                <Users size={14} color="#0284c7" />
                <Text style={styles.metaText}>Serves {recipe.servings}</Text>
              </View>
            )}
            {!!calories && (
              <View style={[styles.metaPill, styles.caloriesPill]}>
                <Flame size={14} color="#f97316" />
                <Text style={styles.metaText}>{calories} kcal</Text>
              </View>
            )}
            {!!ingredientCount && (
              <View style={[styles.metaPill, styles.ingredientsPill]}>
                <Text style={styles.metaText}>🥕 {ingredientCount} ingredient{ingredientCount === 1 ? '' : 's'}</Text>
              </View>
            )}
            {!!sharedDate && (
              <View style={[styles.metaPill, styles.datePill]}>
                <Text style={styles.metaText}>Shared {sharedDate}</Text>
              </View>
            )}
          </Animated.View>

          {recipe.isShared && (
            <View style={styles.interactionSection}>
              {/* Ratings Display */}
              {recipe.ratings && recipe.ratings.totalRatings > 0 ? (
                <TouchableOpacity
                  style={styles.ratingsDisplayRow}
                  onPress={(e) => {
                    e.stopPropagation();
                    handleRatingsPress();
                  }}
                  activeOpacity={0.7}
                >
                  <StarRating
                    rating={recipe.ratings.averageRating}
                    size={16}
                    showLabel
                    showCount
                    count={recipe.ratings.totalRatings}
                  />
                  <Text style={styles.seeRatingsText}>• See all</Text>
                </TouchableOpacity>
              ) : (
                <View style={styles.ratingsDisplayRow}>
                  <Text style={styles.noRatingText}>No ratings yet</Text>
                </View>
              )}

              {/* Action Buttons Row */}
              <View style={styles.actionButtonsRow}>
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={handleCommentPress}
                  activeOpacity={0.8}
                >
                  <MessageCircle size={16} color="#0f172a" />
                  <Text style={styles.actionButtonText}>
                    {commentCount > 0 ? `${commentCount}` : "Comments"}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionButton, styles.rateActionButton]}
                  onPress={(e) => {
                    e.stopPropagation();
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setShowRatingModal(true);
                  }}
                  activeOpacity={0.8}
                >
                  <Star size={16} color="#0ea5e9" fill="#0ea5e9" />
                  <Text style={[styles.actionButtonText, styles.rateButtonText]}>Rate</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </TouchableOpacity>

      {/* Rating Modal */}
      {recipe.isShared && (
        <RatingModal
          visible={showRatingModal}
          onClose={() => setShowRatingModal(false)}
          sharedRecipeId={recipe.id}
          recipeName={recipe.title}
        />
      )}
    </Animated.View>
  );
}