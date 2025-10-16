import React, { useEffect, useState } from "react";
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
import { ArrowLeft, Trash2, ChefHat } from "lucide-react-native";

export default function SavedRecipesScreen() {
  const [recipes, setRecipes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

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

      const fetched = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      setRecipes(fetched);
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
            setRecipes(recipes.filter((r) => r.id !== id));
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
            <ArrowLeft color="#16a34a" size={24} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Saved Recipes</Text>
        </View>

        <TouchableOpacity onPress={fetchRecipes}>
          <Text style={styles.refreshText}>Refresh</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#16a34a" />
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
          {recipes.map((recipe) => (
            <TouchableOpacity
              key={recipe.id}
              onPress={() => router.push(`/recipe/${recipe.id}`)}
              style={styles.recipeCard}
            >
              <View style={styles.recipeCardRow}>
                <View style={styles.recipeContent}>
                  <Text style={styles.recipeTitle}>
                    {recipe.title}
                  </Text>
                  {recipe.description ? (
                    <Text style={styles.recipeDescription} numberOfLines={2}>
                      {recipe.description}
                    </Text>
                  ) : null}
                  <Text style={styles.recipeMeta}>
                    {recipe.servings
                      ? `Serves ${recipe.servings} | `
                      : ""}
                    {recipe.estimatedCalories
                      ? `${recipe.estimatedCalories} kcal`
                      : ""}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => handleDelete(recipe.id)}
                  style={styles.deleteButton}
                >
                  <Trash2 size={20} color="#dc2626" />
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
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
  headerTitle: { marginLeft: 8, fontSize: 24, fontWeight: "700", color: "#047857" },
  refreshText: { color: "#16a34a", fontWeight: "600" },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  loadingText: { marginTop: 8, color: "#6b7280" },
  emptyContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  emptyPrimary: { color: "#6b7280", marginTop: 12 },
  emptySecondary: { color: "#9ca3af", fontSize: 14, marginTop: 4 },
  list: { paddingHorizontal: 20, paddingTop: 12 },
  recipeCard: {
    backgroundColor: "#f0fdf4",
    borderRadius: 24,
    padding: 16,
    marginBottom: 12,
  },
  recipeCardRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  recipeContent: { flex: 1, paddingRight: 12 },
  recipeTitle: { fontSize: 20, fontWeight: "700", color: "#065f46" },
  recipeDescription: { color: "#4b5563", marginTop: 4 },
  recipeMeta: { color: "#6b7280", marginTop: 8, fontSize: 14 },
  deleteButton: { padding: 4 },
});