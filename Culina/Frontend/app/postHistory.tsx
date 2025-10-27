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
import { collection, query, where, onSnapshot, orderBy, deleteDoc, doc } from 'firebase/firestore';
import {
  ArrowLeft,
  ChefHat,
  Users,
  Flame,
  Clock,
  Trash2,
  Eye,
} from 'lucide-react-native';
import Animated, { FadeInUp, FadeIn } from 'react-native-reanimated';
import { Swipeable } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';
import type { Recipe } from '@/types/recipe';
import { unshareRecipe } from '@/lib/utils/shareRecipe';
import { normalizeRecipeSource, isAISource } from '@/lib/utils/recipeSource';

type SharedRecipe = Recipe & {
  id: string;
  userId: string;
  userRecipeId: string;
  sharedAt?: any;
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

type RecipeCardProps = {
  recipe: SharedRecipe;
  index: number;
  onPress: () => void;
  onDelete: (id: string) => void;
};

const RecipeCard = ({ recipe, index, onPress, onDelete }: RecipeCardProps) => {
  const dateStr = formatDate(recipe.sharedAt);
  const sourceLabel = normalizeRecipeSource(recipe.source);
  const ingredientCount = Array.isArray(recipe.ingredients) ? recipe.ingredients.length : null;

  const handleDelete = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    onDelete(recipe.id);
  };

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  };

  const renderRightActions = () => (
    <View style={styles.swipeActionsContainer}>
      <TouchableOpacity
        style={[styles.swipeAction, styles.viewAction]}
        onPress={handlePress}
      >
        <Eye size={24} color="#fff" />
        <Text style={styles.swipeActionText}>View</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.swipeAction, styles.deleteAction]}
        onPress={handleDelete}
      >
        <Trash2 size={24} color="#fff" />
        <Text style={styles.swipeActionText}>Unshare</Text>
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
            <Text style={styles.recipeTitle} numberOfLines={2}>
              {recipe.title}
            </Text>

            <View style={styles.sharedBadge}>
              <Text style={styles.sharedBadgeText}>Shared with community</Text>
            </View>

            {!!recipe.description && (
              <Text style={styles.recipeDescription} numberOfLines={2}>
                {recipe.description}
              </Text>
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

export default function PostHistoryScreen() {
  const [sharedRecipes, setSharedRecipes] = useState<SharedRecipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'AI' | 'Human'>('AI');
  const router = useRouter();

  // Filter recipes based on active tab
  const filteredRecipes = sharedRecipes.filter((recipe) => {
    if (activeTab === 'AI') {
      return isAISource(recipe.source);
    } else {
      return normalizeRecipeSource(recipe.source) === 'Human';
    }
  });

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    const uid = auth.currentUser?.uid;
    if (!uid) {
      setSharedRecipes([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    const sharedRecipesRef = collection(db, 'sharedRecipes');
    const sharedQuery = query(
      sharedRecipesRef,
      where('userId', '==', uid),
      orderBy('sharedAt', 'desc')
    );

    unsubscribe = onSnapshot(
      sharedQuery,
      (snapshot) => {
        const fetched = snapshot.docs.map((d) => {
          const data = d.data() as Omit<SharedRecipe, 'id'>;
          const source = normalizeRecipeSource(data?.source);
          return {
            id: d.id,
            ...data,
            source,
          };
        });
        setSharedRecipes(fetched);
        setLoading(false);
      },
      (error) => {
        console.error('Shared recipes snapshot error:', error);
        Alert.alert('Error', 'Failed to fetch shared recipes.');
        setLoading(false);
      }
    );

    return () => {
      unsubscribe?.();
    };
  }, []);

  const handleUnshare = async (sharedRecipeId: string) => {
    Alert.alert(
      'Unshare Recipe',
      'Are you sure you want to remove this recipe from the community?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unshare',
          style: 'destructive',
          onPress: async () => {
            try {
              const uid = auth.currentUser?.uid;
              if (!uid) return;

              // Find the recipe to get userRecipeId
              const recipe = sharedRecipes.find(r => r.id === sharedRecipeId);
              if (!recipe) return;

              const result = await unshareRecipe(recipe.userRecipeId, uid);

              if (result.success) {
                setSharedRecipes((prev) => prev.filter((r) => r.id !== sharedRecipeId));
                Alert.alert('Success', 'Recipe removed from community.');
              } else {
                Alert.alert('Error', result.error || 'Failed to unshare recipe.');
              }
            } catch (err) {
              console.error(err);
              Alert.alert('Error', 'Failed to unshare recipe.');
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft color="#0f172a" size={24} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Post History</Text>
        <View style={styles.backButton} />
      </View>

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
              {sharedRecipes.filter(r => isAISource(r.source)).length}
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
              {sharedRecipes.filter(r => normalizeRecipeSource(r.source) === 'Human').length}
            </Text>
          </View>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0ea5e9" />
          <Text style={styles.loadingText}>Loading shared recipes...</Text>
        </View>
      ) : filteredRecipes.length === 0 ? (
        <View style={styles.emptyContainer}>
          <ChefHat size={64} color="#9ca3af" />
          <Text style={styles.emptyPrimary}>
            No {activeTab === 'AI' ? 'AI-Generated' : 'Human-Made'} Posts
          </Text>
          <Text style={styles.emptySecondary}>
            {activeTab === 'AI'
              ? 'Share your AI-generated recipes with the community to see them here!'
              : 'Share your own recipes with the community to see them here!'}
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {filteredRecipes.map((recipe, index) => (
            <RecipeCard
              key={recipe.id}
              recipe={recipe}
              index={index}
              onPress={() => router.push({ pathname: `/recipe/${recipe.userRecipeId}` as any })}
              onDelete={handleUnshare}
            />
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0f172a',
  },
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
    gap: 12,
    backgroundColor: '#fff',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
    gap: 8,
  },
  tabActive: {
    backgroundColor: '#0ea5e9',
  },
  tabText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#64748b',
  },
  tabTextActive: {
    color: '#fff',
  },
  tabBadge: {
    backgroundColor: '#e2e8f0',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    minWidth: 24,
    alignItems: 'center',
  },
  tabBadgeActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  tabBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  tabBadgeTextActive: {
    color: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: '#6b7280',
    fontSize: 16,
  },
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
  recipeTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 8,
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
  sourcePill: {
    backgroundColor: '#e0f2fe',
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
  swipeActionsContainer: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 8,
    paddingRight: 8,
  },
  swipeAction: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
    borderRadius: 16,
    marginVertical: 8,
  },
  viewAction: {
    backgroundColor: '#0ea5e9',
  },
  deleteAction: {
    backgroundColor: '#ef4444',
  },
  swipeActionText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
});
