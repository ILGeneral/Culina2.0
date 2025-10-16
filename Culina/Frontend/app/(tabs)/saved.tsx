import React, { useEffect, useState, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { db, auth } from "@/lib/firebaseConfig";
import {
  collection,
  getDocs,
  deleteDoc,
  doc,
  orderBy,
  query,
} from "firebase/firestore";
import {
  ArrowLeft,
  Trash2,
  ChefHat,
  Users,
  Flame,
  Clock,
} from "lucide-react-native";

type SavedRecipe = {
  id: string;
  title: string;
  description?: string;
  servings?: number;
  estimatedCalories?: number;
  createdAt?: any; // Firestore Timestamp or millis or ISO string
};

export default function SavedRecipesScreen() {
  const [recipes, setRecipes] = useState<SavedRecipe[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // --- Helpers ---
  const formatDate = (val: any): string | null => {
    if (!val) return null;
    try {
      // Firestore Timestamp
      if (typeof val?.seconds === "number") {
        return new Date(val.seconds * 1000).toLocaleDateString();
      }
      // millis
      if (typeof val === "number") {
        return new Date(val).toLocaleDateString();
      }
      // string
      const d = new Date(val);
      if (!isNaN(d.getTime())) return d.toLocaleDateString();
      return null;
    } catch {
      return null;
    }
  };

  //  Load saved recipes from Firestore
  const fetchRecipes = async () => {
    try {
      setLoading(true);
      const uid = auth.currentUser?.uid;
      if (!uid) {
        Alert.alert("Error", "Please log in to view your saved recipes.");
        return;
      }

      const recipesRef = collection(db, "users", uid, "recipes");
      const q = query(recipesRef, orderBy("createdAt", "desc"));
      const snapshot = await getDocs(q);

      const fetched = snapshot.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<SavedRecipe, "id">),
      }));

      setRecipes(fetched as SavedRecipe[]);
    } catch (err) {
      console.error(err);
      Alert.alert("Error", "Failed to fetch recipes.");
    } finally {
      setLoading(false);
    }
  };

  // Delete a recipe
  const handleDelete = async (id: string) => {
    Alert.alert("Delete Recipe", "Are you sure you want to delete this recipe?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            const uid = auth.currentUser?.uid;
            if (!uid) return;
            await deleteDoc(doc(db, "users", uid, "recipes", id));
            setRecipes((prev) => prev.filter((r) => r.id !== id));
          } catch (err) {
            console.error(err);
            Alert.alert("Error", "Failed to delete recipe.");
          }
        },
      },
    ]);
  };

  useEffect(() => {
    fetchRecipes();
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={() => router.back()}>
            <ArrowLeft color="#128AFAFF" size={24} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Saved Recipes</Text>
        </View>

        <TouchableOpacity onPress={fetchRecipes}>
          <Text style={styles.refreshText}>Refresh</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#128AFAFF" />
          <Text style={styles.loadingText}>Loading recipes...</Text>
        </View>
      ) : recipes.length === 0 ? (
        <View style={styles.emptyContainer}>
          <ChefHat size={64} color="#9ca3af" />
          <Text style={styles.emptyPrimary}>No saved recipes yet.</Text>
          <Text style={styles.emptySecondary}>
            Generate one in the AI Recipe Maker!
          </Text>
        </View>
      ) : (
        <ScrollView style={styles.list}>
          {recipes.map((recipe) => {
            const dateStr = formatDate(recipe.createdAt);
            return (
              <TouchableOpacity
                key={recipe.id}
                onPress={() => router.push(`/recipe/${recipe.id}`)}
                onLongPress={() => handleDelete(recipe.id)}
                delayLongPress={600}
                style={styles.recipeCard}
                activeOpacity={0.9}
              >
                <View style={styles.recipeContent}>
                    <Text style={styles.recipeTitle} numberOfLines={1}>
                      {recipe.title}
                    </Text>

                    {!!recipe.description && (
                      <Text style={styles.recipeDescription} numberOfLines={2}>
                        {recipe.description}
                      </Text>
                    )}

                    {/* --- Enhanced Metadata Section --- */}
                    <View style={styles.recipeMetaContainer}>
                      {!!recipe.servings && (
                        <View style={styles.metaItem}>
                          <Users size={14} color="#128AFAFF" />
                          <Text style={styles.metaText}>
                            Serves {recipe.servings}
                          </Text>
                        </View>
                      )}

                      {!!recipe.estimatedCalories && (
                        <View style={styles.metaItem}>
                          <Flame size={14} color="#f97316" />
                          <Text style={styles.metaText}>
                            {recipe.estimatedCalories} kcal
                          </Text>
                        </View>
                      )}

                      {!!dateStr && (
                        <View style={styles.metaItem}>
                          <Clock size={14} color="#6b7280" />
                          <Text style={styles.metaText}>{dateStr}</Text>
                        </View>
                      )}
                    </View>
                  </View>
                  <Text style={styles.holdHint}>Press & Hold to delete</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },

  // Header
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  headerTitle: {
    marginLeft: 8,
    fontSize: 24,
    fontWeight: "700",
    color: "#128AFAFF",
  },
  refreshText: { color: "#128AFAFF", fontWeight: "600" },

  // States
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  loadingText: { marginTop: 8, color: "#6b7280" },
  emptyContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  emptyPrimary: { color: "#6b7280", marginTop: 12, fontSize: 16 },
  emptySecondary: { color: "#9ca3af", fontSize: 14, marginTop: 4 },

  // List & Cards
  list: { paddingHorizontal: 20, paddingTop: 12 },
  recipeCard: {
    backgroundColor: "#F0F8FDFF",
    borderRadius: 24,
    padding: 18,
    marginBottom: 14,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 5,
    elevation: 2,
  },
  recipeContent: { flex: 1, paddingRight: 12 },
  recipeTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#0C83E6",
  },
  recipeDescription: {
    color: "#4b5563",
    marginTop: 6,
    fontSize: 14.5,
    lineHeight: 20,
  },

  // Metadata
  recipeMetaContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 10,
    gap: 12,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  metaText: {
    fontSize: 13.5,
    color: "#6b7280",
  },

  holdHint: {
    marginTop: 12,
    fontSize: 12,
    color: "#9ca3af",
    fontStyle: "italic",
  },
});
