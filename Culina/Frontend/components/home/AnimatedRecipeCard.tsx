import React, { useMemo, useState } from "react";
import { View, Text, Image, TouchableOpacity, StyleSheet } from "react-native";
import Animated, { FadeInUp, FadeIn } from "react-native-reanimated";
import { useRouter } from "expo-router";
import { Users, Flame, MessageCircle, Star } from "lucide-react-native";
import { normalizeRecipeSource } from "@/lib/utils/recipeSource";
import { StarRating } from "../ratings/StarRating";
import { RatingModal } from "../ratings/RatingModal";
import * as Haptics from "expo-haptics";

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
    ratings?: {
      averageRating: number;
      totalRatings: number;
    };
  };
  index: number;
};

export default function AnimatedRecipeCard({ recipe, index }: AnimatedRecipeCardProps) {
  const router = useRouter();
  const [showRatingModal, setShowRatingModal] = useState(false);

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
          <Text style={styles.title} numberOfLines={2}>
            {recipe.title}
          </Text>

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
            <>
              <View style={styles.footerRow}>
                {recipe.ratings && recipe.ratings.totalRatings > 0 ? (
                  <View style={styles.ratingContainer}>
                    <StarRating
                      rating={recipe.ratings.averageRating}
                      size={16}
                      showLabel
                      showCount
                      count={recipe.ratings.totalRatings}
                    />
                  </View>
                ) : (
                  <Text style={styles.noRatingText}>No ratings yet</Text>
                )}
                <TouchableOpacity style={styles.commentButton} onPress={handleCommentPress} activeOpacity={0.8}>
                  <MessageCircle size={16} color="#0f172a" />
                  <Text style={styles.commentText}>
                    {commentCount > 0 ? `${commentCount} Comment${commentCount === 1 ? "" : "s"}` : "View Comments"}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Quick Rate Button */}
              <TouchableOpacity
                style={styles.quickRateButton}
                onPress={(e) => {
                  e.stopPropagation();
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setShowRatingModal(true);
                }}
                activeOpacity={0.8}
              >
                <Star size={16} color="#0ea5e9" />
                <Text style={styles.quickRateText}>Rate Recipe</Text>
              </TouchableOpacity>
            </>
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

const styles = StyleSheet.create({
  cardWrapper: {
    backgroundColor: "#fff",
    borderRadius: 20,
    marginBottom: 20,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    shadowColor: "#94a3b8",
    shadowOpacity: 0.18,
    shadowOffset: { width: 0, height: 5 },
    shadowRadius: 15,
    elevation: 5,
  },
  cover: {
    width: "100%",
    height: 192,
  },
  content: {
    padding: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#1e293b",
    marginBottom: 8,
  },
  description: {
    color: "#475569",
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 12,
  },
  previewSection: {
    marginBottom: 16,
    gap: 4,
  },
  previewLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0f172a",
  },
  previewItem: {
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
  sourcePill: {
    backgroundColor: "#e0f2fe",
  },
  servingsPill: {
    backgroundColor: "#dbeafe",
  },
  caloriesPill: {
    backgroundColor: "#fff7ed",
  },
  ingredientsPill: {
    backgroundColor: "#f1f5f9",
  },
  datePill: {
    backgroundColor: "#f1f5f9",
  },
  metaText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#0f172a",
  },
  footerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 16,
  },
  ratingContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  noRatingText: {
    fontSize: 13,
    color: "#94a3af",
    fontStyle: "italic",
  },
  commentButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: "rgba(18,138,250,0.12)",
    borderRadius: 999,
  },
  commentText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#0f172a",
  },
  quickRateButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#e0f2fe",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginTop: 12,
    gap: 6,
    borderWidth: 1,
    borderColor: "#0ea5e9",
  },
  quickRateText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0ea5e9",
  },
});