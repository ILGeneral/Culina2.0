import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native';
import { styles } from '@/styles/tabs/savedStyles';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { db, auth } from '@/lib/firebaseConfig';
import { collection, doc, deleteDoc, onSnapshot, query, orderBy, getDoc } from 'firebase/firestore';
import {
  ChefHat,
  Users,
  Flame,
  Clock,
  Share2,
  Pencil,
  Package,
  User,
  Trash2,
} from 'lucide-react-native';
import Animated, { FadeInUp, FadeIn } from 'react-native-reanimated';
import { Swipeable } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';
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
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
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

  const handleDelete = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    onDelete(recipe.id);
  };

  const handleShare = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onShare(recipe);
  };

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  };

  const renderRightActions = () => (
    <View style={styles.swipeActionsContainer}>
      <TouchableOpacity
        style={[styles.swipeAction, styles.shareAction]}
        onPress={handleShare}
      >
        <Share2 size={24} color="#fff" />
        <Text style={styles.swipeActionText}>Share</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.swipeAction, styles.deleteAction]}
        onPress={handleDelete}
      >
        <Trash2 size={24} color="#fff" />
        <Text style={styles.swipeActionText}>Delete</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <Animated.View
      entering={FadeInUp.delay(index * 100).duration(400).springify()}
    >
      <Swipeable
        renderRightActions={renderRightActions}
        overshootRight={false}
        friction={2}
      >
        <TouchableOpacity
          onPress={handlePress}
          onLongPress={handleDelete}
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
      </Swipeable>
    </Animated.View>
  );
};

export default function SavedRecipesScreen() {
  const [recipes, setRecipes] = useState<SavedRecipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [inventoryCounts, setInventoryCounts] = useState<Record<string, number>>({});
  const [activeTab, setActiveTab] = useState<'AI' | 'Human'>('AI');
  const [userProfilePicture, setUserProfilePicture] = useState<string | null>(null);
  const router = useRouter();

  // Fetch user profile picture
  useEffect(() => {
    const fetchUserProfile = async () => {
      const user = auth.currentUser;
      if (!user) return;

      try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        const userData = userDoc.data();
        if (userData?.profilePicture) {
          setUserProfilePicture(userData.profilePicture);
        }
      } catch (error) {
        console.error('Error fetching user profile:', error);
      }
    };

    fetchUserProfile();
  }, []);

  // Filter recipes based on active tab
  const filteredRecipes = recipes.filter((recipe) => {
    if (activeTab === 'AI') {
      return isAISource(recipe.source);
    } else {
      return normalizeRecipeSource(recipe.source) === 'Human';
    }
  });

  useEffect(() => {
    let unsubscribeInventory: (() => void) | undefined;
    let unsubscribeRecipes: (() => void) | undefined;

    const uid = auth.currentUser?.uid;
    if (!uid) {
      setRecipes([]);
      setInventoryCounts({});
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
  }, [auth.currentUser?.uid]);

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
              style={styles.profileButton}
            >
              {userProfilePicture ? (
                <Image
                  source={{ uri: userProfilePicture }}
                  style={styles.profileImage}
                />
              ) : (
                <User color="#128AFAFF" size={24} />
              )}
            </TouchableOpacity>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Saved Recipes</Text>

        {/* Tab Navigation */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'AI' && styles.tabActive]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setActiveTab('AI');
            }}
          >
            <Text style={[styles.tabText, activeTab === 'AI' && styles.tabTextActive]}>
              AI-Generated
            </Text>
            <View style={[styles.tabBadge, activeTab === 'AI' && styles.tabBadgeActive]}>
              <Text style={[styles.tabBadgeText, activeTab === 'AI' && styles.tabBadgeTextActive]}>
                {recipes.filter(r => isAISource(r.source)).length}
              </Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'Human' && styles.tabActive]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setActiveTab('Human');
            }}
          >
            <Text style={[styles.tabText, activeTab === 'Human' && styles.tabTextActive]}>
              Human-Made
            </Text>
            <View style={[styles.tabBadge, activeTab === 'Human' && styles.tabBadgeActive]}>
              <Text style={[styles.tabBadgeText, activeTab === 'Human' && styles.tabBadgeTextActive]}>
                {recipes.filter(r => normalizeRecipeSource(r.source) === 'Human').length}
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#0ea5e9" />
            <Text style={styles.loadingText}>Loading recipes...</Text>
          </View>
        ) : filteredRecipes.length === 0 ? (
          <View style={styles.emptyContainer}>
            <ChefHat size={64} color="#9ca3af" />
            <Text style={styles.emptyPrimary}>
              No {activeTab === 'AI' ? 'AI-Generated' : 'Human-Made'} Recipes
            </Text>
            <Text style={styles.emptySecondary}>
              {activeTab === 'AI'
                ? 'Generate recipes using AI to see them here.'
                : 'Create or save human-made recipes to see them here.'}
            </Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.list}>
            {filteredRecipes.map((recipe, index) => (
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
