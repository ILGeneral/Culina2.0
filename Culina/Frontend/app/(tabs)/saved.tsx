import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { db, auth } from '@/lib/firebaseConfig';
import { collection, doc, deleteDoc, onSnapshot, query, orderBy } from 'firebase/firestore';
import {
  ChefHat,
  Users,
  Flame,
  Clock,
  Share2,
  Pencil,
  Package,
  User,
} from 'lucide-react-native';
import Animated, { FadeInUp, FadeIn } from 'react-native-reanimated';
import Background from '@/components/Background';
import type { Recipe } from '@/types/recipe';
import { shareRecipe, unshareRecipe, isRecipeShared } from '@/lib/utils/shareRecipe';
import { normalizeRecipeSource, isAISource } from '@/lib/utils/recipeSource';

type SavedRecipe = Recipe & {
  id: string;
  createdAt?: any;
  isShared?: boolean;
};

const formatDate = (val: any): string | null => {
  if (!val) return null;
  try {
    if (typeof val?.seconds === 'number') {
      return new Date(val.seconds * 1000).toLocaleDateString();
    }
    if (typeof val === 'number') {
      return new Date(val).toLocaleDateString();
    }
    const d = new Date(val);
    if (!isNaN(d.getTime())) return d.toLocaleDateString();
    return null;
  } catch {
    return null;
  }
};

type IngredientEntry = string | { name: string; qty?: string; unit?: string };

type RecipeCardProps = {
  recipe: SavedRecipe;
  index: number;
  onPress: () => void;
  onDelete: (id: string) => void;
  onShare: (recipe: SavedRecipe) => void;
  onEdit?: () => void;
  inventoryCounts: Record<string, number>;
};

const isNumericToken = (token: string) => /^\d+(?:[\/.]\d+)?$/.test(token);

const parseIngredientString = (entry: string): { name: string; qty?: string; unit?: string } => {
  const raw = entry.replace(/\s+/g, ' ').trim();
  if (!raw) {
    return { name: '' };
  }

  const hyphenParts = raw.split(/[–—-]/);
  if (hyphenParts.length > 1) {
    const name = hyphenParts[0].trim();
    const trailing = hyphenParts.slice(1).join('-').trim();
    const tokens = trailing.split(/\s+/);
    const mutable = [...tokens];
    const qtyTokens: string[] = [];

    while (mutable.length && isNumericToken(mutable[0])) {
      qtyTokens.push(mutable.shift()!);
    }

    const unit = mutable.join(' ').trim();

    return {
      name: name || raw,
      ...(qtyTokens.length ? { qty: qtyTokens.join(' ') } : {}),
      ...(unit ? { unit } : {}),
    };
  }

  return { name: raw };
};

const normalizeIngredientEntry = (ingredient: IngredientEntry): { name: string; qty?: string; unit?: string } => {
  if (typeof ingredient === 'string') {
    return parseIngredientString(ingredient);
  }
  const name = ingredient.name?.trim() ?? '';
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
    const qtyUnit = [amount, unit].filter(Boolean).join(' ');
    parts.push(qtyUnit);
  }
  return parts.join(' — ');
};

const formatNameOnly = (ingredient: IngredientEntry) => {
  const normalized = normalizeIngredientEntry(ingredient);
  return normalized.name;
};

const RecipeCard = ({ recipe, index, onPress, onDelete, onShare, onEdit, inventoryCounts }: RecipeCardProps) => {
  const dateStr = formatDate(recipe.createdAt);
  const ingredientsPreview = Array.isArray(recipe.ingredients)
    ? (recipe.ingredients as IngredientEntry[]).slice(0, 3)
    : [];

  const ingredientCount = Array.isArray(recipe.ingredients) ? recipe.ingredients.length : null;
  const sourceLabel = normalizeRecipeSource(recipe.source);
  const canEdit = isAISource(recipe.source);

  const handleEditPress = (event: any) => {
    event?.stopPropagation?.();
    if (!canEdit) return;
    onEdit?.();
  };

  const getInventoryKey = (ingredient: IngredientEntry) => {
    const name = formatNameOnly(ingredient).toLowerCase();
    if (name) return name;
    if (typeof ingredient === 'string') return ingredient.toLowerCase();
    return '';
  };

  const getInventoryCount = (ingredient: IngredientEntry) => {
    const key = getInventoryKey(ingredient);
    if (!key) return null;
    if (inventoryCounts[key] !== undefined) return inventoryCounts[key];
    if (key.endsWith('s')) {
      const singular = key.slice(0, -1);
      if (inventoryCounts[singular] !== undefined) return inventoryCounts[singular];
    }
    return null;
  };

  return (
    <Animated.View
      entering={FadeInUp.delay(index * 100).duration(400).springify()}
    >
      <TouchableOpacity
        onPress={onPress}
        onLongPress={() => onDelete(recipe.id)}
        delayLongPress={500}
        style={styles.recipeCard}
        activeOpacity={0.8}
      >
        <View style={styles.recipeContent}>
          <View style={styles.titleRow}>
            <Text style={styles.recipeTitle} numberOfLines={2}>
              {recipe.title}
            </Text>
            <View style={styles.cardActions}>
              {canEdit && (
                <TouchableOpacity
                  onPress={handleEditPress}
                  style={styles.shareButton}
                >
                  <Pencil size={20} color="#0284c7" />
                </TouchableOpacity>
              )}
              <TouchableOpacity
                onPress={() => onShare(recipe)}
                style={[styles.shareButton, recipe.isShared && styles.shareButtonActive]}
              >
                <Share2 size={20} color={recipe.isShared ? "#0ea5e9" : "#64748b"} />
              </TouchableOpacity>
            </View>
          </View>

          {recipe.isShared && (
            <View style={styles.sharedBadge}>
              <Text style={styles.sharedBadgeText}>Shared with community</Text>
            </View>
          )}

          {!!recipe.description && (
            <Text style={styles.recipeDescription} numberOfLines={2}>
              {recipe.description}
            </Text>
          )}

          {ingredientsPreview.length > 0 && (
            <View style={styles.previewSection}>
              <Text style={styles.previewLabel}>Key ingredients</Text>
              {ingredientsPreview.map((ingredient, idx) => {
                const displayName = formatIngredientLabel(ingredient);
                const count = getInventoryCount(ingredient);
                const countLabel =
                  count === null ? 'Not in pantry' : count === 0 ? 'Out of stock' : `${count} in pantry`;
                return (
                  <View key={idx} style={styles.previewRow}>
                    <Text style={styles.previewItem}>• {displayName}</Text>
                    <Text style={[styles.previewCount, (count === null || count === 0) && styles.previewCountLow]}>
                      {countLabel}
                    </Text>
                  </View>
                );
              })}
            </View>
          )}

          <Animated.View
            style={styles.recipeMetaContainer}
            entering={FadeIn.delay(index * 100 + 200).duration(500)}
          >
            <View style={[styles.metaPill, styles.sourcePill]}>
              <Text style={styles.metaText}>{sourceLabel}</Text>
            </View>
            {!!recipe.servings && (
              <View style={[styles.metaPill, styles.servingsPill]}>
                <Users size={14} color="#0284c7" />
                <Text style={styles.metaText}>Serves {recipe.servings}</Text>
              </View>
            )}
            {!!recipe.estimatedCalories && (
              <View style={[styles.metaPill, styles.caloriesPill]}>
                <Flame size={14} color="#f97316" />
                <Text style={styles.metaText}>
                  {recipe.estimatedCalories} kcal
                </Text>
              </View>
            )}
            {ingredientCount && (
              <View style={[styles.metaPill, styles.ingredientsPill]}>
                <Text style={styles.metaText}>
                  🥕 {ingredientCount} ingredient{ingredientCount === 1 ? '' : 's'}
                </Text>
              </View>
            )}
            {!!dateStr && (
              <View style={[styles.metaPill, styles.datePill]}>
                <Clock size={14} color="#64748b" />
                <Text style={styles.metaText}>{dateStr}</Text>
              </View>
            )}
          </Animated.View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

export default function SavedRecipesScreen() {
  const [recipes, setRecipes] = useState<SavedRecipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [inventoryCounts, setInventoryCounts] = useState<Record<string, number>>({});
  const router = useRouter();

  useEffect(() => {
    let unsubscribeInventory: (() => void) | undefined;
    let unsubscribeRecipes: (() => void) | undefined;

    const uid = auth.currentUser?.uid;
    if (!uid) {
      setLoading(false);
      return;
    }

    setLoading(true);

    const recipesRef = collection(db, 'users', uid, 'recipes');
    const recipesQuery = query(recipesRef, orderBy('createdAt', 'desc'));
    unsubscribeRecipes = onSnapshot(
      recipesQuery,
      (snapshot) => {
        const fetched = snapshot.docs.map((d) => {
          const data = d.data() as Omit<SavedRecipe, 'id'>;
          const source = normalizeRecipeSource(data?.source);
          return {
            id: d.id,
            ...data,
            source,
          };
        });
        setRecipes(fetched);
        setLoading(false);
      },
      (error) => {
        console.error('Saved recipes snapshot error:', error);
        Alert.alert('Error', 'Failed to fetch recipes.');
        setLoading(false);
      }
    );

    const invRef = collection(db, 'users', uid, 'ingredients');
    unsubscribeInventory = onSnapshot(invRef, (snapshot) => {
      const counts: Record<string, number> = {};
      snapshot.docs.forEach((docSnap) => {
        const data = docSnap.data() as { name?: string; quantity?: number };
        if (!data?.name) return;
        const baseKey = data.name.toLowerCase();
        const qty = typeof data.quantity === 'number' ? data.quantity : 0;
        counts[baseKey] = qty;
        const normalized = formatNameOnly(data.name).toLowerCase();
        if (normalized && normalized !== baseKey) {
          counts[normalized] = qty;
        }
        if (baseKey.endsWith('s')) {
          counts[baseKey.slice(0, -1)] = qty;
        }
      });

      setInventoryCounts(counts);
    });

    return () => {
      unsubscribeInventory?.();
      unsubscribeRecipes?.();
    };
  }, []);

  const handleShare = async (recipe: SavedRecipe) => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;

    try {
      // Check if already shared
      const isShared = await isRecipeShared(recipe.id, uid);
      
      if (isShared) {
        // Option to unshare
        Alert.alert(
          'Unshare Recipe',
          'This recipe is already shared. Would you like to unshare it?',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Unshare',
              style: 'destructive',
              onPress: async () => {
                const result = await unshareRecipe(recipe.id, uid);
                if (result.success) {
                  setRecipes((prev) =>
                    prev.map((r) =>
                      r.id === recipe.id ? { ...r, isShared: false } : r
                    )
                  );
                  Alert.alert('Success', 'Recipe unshared from the community.');
                } else {
                  Alert.alert('Error', result.error || 'Failed to unshare recipe.');
                }
              },
            },
          ]
        );
        return;
      }

      // Share the recipe
      Alert.alert(
        'Share Recipe',
        'Share this recipe with the Culina community?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Share',
            onPress: async () => {
              const result = await shareRecipe(recipe, uid);
              
              if (result.success) {
                setRecipes((prev) =>
                  prev.map((r) =>
                    r.id === recipe.id ? { ...r, isShared: true } : r
                  )
                );
                Alert.alert('Success', 'Recipe shared with the community!');
              } else {
                Alert.alert('Error', result.error || 'Failed to share recipe.');
              }
            },
          },
        ]
      );
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'An unexpected error occurred.');
    }
  };

  const handleDelete = async (id: string) => {
    Alert.alert('Delete Recipe', 'Are you sure you want to delete this recipe?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            const uid = auth.currentUser?.uid;
            if (!uid) return;
            await deleteDoc(doc(db, 'users', uid, 'recipes', id));
            setRecipes((prev) => prev.filter((r) => r.id !== id));
          } catch (err) {
            console.error(err);
            Alert.alert('Error', 'Failed to delete recipe.');
          }
        },
      },
    ]);
  };

  return (
    <Background>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Culina</Text>
          <View style={styles.headerButtons}>
            <TouchableOpacity
              onPress={() => router.push('/inventory' as any)}
              style={styles.iconButton}
            >
              <Package color="#128AFAFF" size={24} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => router.push('/profile')}
              style={styles.iconButton}
            >
              <User color="#128AFAFF" size={24} />
            </TouchableOpacity>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Saved Recipes</Text>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#0ea5e9" />
            <Text style={styles.loadingText}>Loading recipes...</Text>
          </View>
        ) : recipes.length === 0 ? (
          <View style={styles.emptyContainer}>
            <ChefHat size={64} color="#9ca3af" />
            <Text style={styles.emptyPrimary}>No Saved Recipes</Text>
            <Text style={styles.emptySecondary}>
              Your culinary creations will appear here.
            </Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.list}>
            {recipes.map((recipe, index) => (
              <RecipeCard
                key={recipe.id}
                recipe={recipe}
                index={index}
                onPress={() => router.push(`/recipe/${recipe.id}`)}
                onDelete={handleDelete}
                onShare={handleShare}
                onEdit={() => router.push({ pathname: "/recipe/maker", params: { recipeId: recipe.id } })}
                inventoryCounts={inventoryCounts}
              />
            ))}
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#128AFAFF',
  },
  headerButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  iconButton: {
    backgroundColor: '#DCF3FCFF',
    borderRadius: 20,
    padding: 8,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#0f172a',
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, color: '#6b7280', fontSize: 16 },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyPrimary: {
    color: '#334155',
    marginTop: 16,
    fontSize: 20,
    fontWeight: '600',
  },
  emptySecondary: {
    color: '#64748b',
    fontSize: 16,
    marginTop: 8,
    textAlign: 'center',
  },
  list: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 40,
  },
  recipeCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    marginBottom: 16,
    shadowColor: '#94a3b8',
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 5 },
    shadowRadius: 15,
    elevation: 5,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  recipeContent: {
    padding: 20,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  recipeTitle: {
    flex: 1,
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1e293b',
    marginRight: 12,
  },
  shareButton: {
    padding: 8,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
  },
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  shareButtonActive: {
    backgroundColor: '#e0f2fe',
  },
  sourcePill: {
    backgroundColor: '#e0f2fe',
  },
  sharedBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#dcfce7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 12,
  },
  sharedBadgeText: {
    color: '#16a34a',
    fontSize: 12,
    fontWeight: '600',
  },
  recipeDescription: {
    color: '#475569',
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 16,
  },
  previewSection: {
    marginBottom: 16,
  },
  previewLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
    marginBottom: 6,
  },
  previewItem: {
    fontSize: 16,
    color: '#334155',
    marginBottom: 6,
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 6,
  },
  previewCount: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0f172a',
  },
  previewCountLow: {
    color: '#b91c1c',
  },
  recipeMetaContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 16,
  },
  metaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
  },
  metaText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#334155',
  },
  servingsPill: {
    backgroundColor: '#e0f2fe',
  },
  caloriesPill: {
    backgroundColor: '#fff7ed',
  },
  ingredientsPill: {
    backgroundColor: '#E2F0E7FF',
  },
  datePill: {
    backgroundColor: '#f1f5f9',
  },
});
