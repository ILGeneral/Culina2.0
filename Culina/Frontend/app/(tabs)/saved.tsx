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
import {
  collection,
  getDocs,
  deleteDoc,
  doc,
  orderBy,
  query,
} from 'firebase/firestore';
import {
  ArrowLeft,
  ChefHat,
  Users,
  Flame,
  Clock,
} from 'lucide-react-native';
import Animated, { FadeInUp, FadeIn } from 'react-native-reanimated';
import Background from '@/components/Background';
import type { Recipe } from '@/types/recipe';

type SavedRecipe = Recipe & {
  id: string;
  createdAt?: any;
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
  recipe: SavedRecipe;
  index: number;
  onPress: () => void;
  onDelete: (id: string) => void;
};

const formatNameOnly = (ingredient: string | { name: string; qty?: string }) => {
  if (typeof ingredient === 'string') {
    return ingredient
      .split(/\s+/)
      .filter((token, idx, arr) => {
        const lower = token.toLowerCase();
        if (idx === 0 && /^[\d/.,-]+$/.test(lower)) return false;
        if ([
          'cup', 'cups', 'tsp', 'teaspoon', 'teaspoons', 'tbsp', 'tablespoon', 'tablespoons',
          'oz', 'ounce', 'ounces', 'g', 'gram', 'grams', 'kg', 'kilogram', 'kilograms',
          'ml', 'milliliter', 'milliliters', 'l', 'liter', 'liters', 'lb', 'pound', 'pounds',
          'pinch', 'dash', 'clove', 'cloves', 'slice', 'slices', 'piece', 'pieces',
          'bunch', 'bunches', 'large', 'small', 'medium', 'of'
        ].includes(lower)) {
          return false;
        }
        if (idx === 1 && arr[0] && /^[\d/.,-]+$/.test(arr[0])) {
          if ([
            'cup', 'cups', 'tsp', 'teaspoon', 'teaspoons', 'tbsp', 'tablespoon', 'tablespoons',
            'oz', 'ounce', 'ounces', 'g', 'gram', 'grams', 'kg', 'kilogram', 'kilograms',
            'ml', 'milliliter', 'milliliters', 'l', 'liter', 'liters', 'lb', 'pound', 'pounds',
            'pinch', 'dash', 'clove', 'cloves', 'slice', 'slices', 'piece', 'pieces',
            'bunch', 'bunches', 'large', 'small', 'medium'
          ].includes(lower)) return false;
        }
        return true;
      })
      .join(' ')
      .trim();
  }

  return ingredient.name || '';
};

const RecipeCard = ({ recipe, index, onPress, onDelete }: RecipeCardProps) => {
  const dateStr = formatDate(recipe.createdAt);
  const ingredientsPreview = Array.isArray(recipe.ingredients)
    ? (recipe.ingredients as (string | { name: string; qty?: string })[]).slice(0, 3)
    : [];

  const ingredientCount = Array.isArray(recipe.ingredients) ? recipe.ingredients.length : null;

  const formatIngredient = (ingredient: string | { name: string; qty?: string }) => {
    return formatNameOnly(ingredient);
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
          <Text style={styles.recipeTitle} numberOfLines={2}>
            {recipe.title}
          </Text>

          {!!recipe.description && (
            <Text style={styles.recipeDescription} numberOfLines={2}>
              {recipe.description}
            </Text>
          )}

          {ingredientsPreview.length > 0 && (
            <View style={styles.previewSection}>
              <Text style={styles.previewLabel}>Key ingredients</Text>
              {ingredientsPreview.map((ingredient, idx) => (
                <Text key={idx} style={styles.previewItem}>
                  • {formatIngredient(ingredient)}
                </Text>
              ))}
            </View>
          )}

          <Animated.View
            style={styles.recipeMetaContainer}
            entering={FadeIn.delay(index * 100 + 200).duration(500)}
          >
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
  const router = useRouter();

  const fetchRecipes = async () => {
    try {
      setLoading(true);
      const uid = auth.currentUser?.uid;
      if (!uid) {
        Alert.alert('Error', 'Please log in to view your saved recipes.');
        setLoading(false);
        return;
      }
      const recipesRef = collection(db, 'users', uid, 'recipes');
      const q = query(recipesRef, orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      const fetched = snapshot.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<SavedRecipe, 'id'>),
      }));
      setRecipes(fetched);
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Failed to fetch recipes.');
    } finally {
      setLoading(false);
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

  useEffect(() => {
    fetchRecipes();
  }, []);

  return (
    <Background>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.headerIcon}
            onPress={() => router.back()}
          >
            <ArrowLeft color="#0284c7" size={28} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Saved Recipes</Text>
        </View>

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
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerIcon: {
    padding: 4,
  },
  headerTitle: {
    marginLeft: 12,
    fontSize: 28,
    fontWeight: 'bold',
    color: '#0f172a',
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
  recipeTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 8,
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
    color: '#334155',
    marginBottom: 4,
    lineHeight: 20,
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