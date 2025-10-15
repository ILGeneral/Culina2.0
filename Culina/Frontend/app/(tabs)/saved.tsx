import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
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
    <SafeAreaView className="flex-1 bg-white">
      {/* Header */}
      <View className="flex-row justify-between items-center px-5 pt-5 pb-3 border-b border-gray-200">
        <View className="flex-row items-center gap-3">
          <TouchableOpacity onPress={() => router.back()}>
            <ArrowLeft color="#16a34a" size={24} />
          </TouchableOpacity>
          <Text className="text-3xl font-bold text-green-700">Saved Recipes</Text>
        </View>

        <TouchableOpacity onPress={fetchRecipes}>
          <Text className="text-green-600 font-semibold">Refresh</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#16a34a" />
          <Text className="mt-2 text-gray-500">Loading recipes...</Text>
        </View>
      ) : recipes.length === 0 ? (
        <View className="flex-1 justify-center items-center">
          <ChefHat size={64} color="#9ca3af" />
          <Text className="text-gray-500 mt-3">No saved recipes yet.</Text>
          <Text className="text-gray-400 text-sm mt-1">
            Generate one in the AI Recipe Maker!
          </Text>
        </View>
      ) : (
        <ScrollView className="px-5 pt-3">
          {recipes.map((recipe) => (
            <TouchableOpacity
              key={recipe.id}
              onPress={() => router.push(`/recipe/${recipe.id}`)}
              className="bg-green-50 rounded-2xl p-4 mb-3 active:opacity-80"
            >
              <View className="flex-row justify-between items-center">
                <View className="flex-1 pr-3">
                  <Text className="text-xl font-bold text-green-800">
                    {recipe.title}
                  </Text>
                  {recipe.description ? (
                    <Text className="text-gray-600 mt-1" numberOfLines={2}>
                      {recipe.description}
                    </Text>
                  ) : null}
                  <Text className="text-gray-500 mt-2 text-sm">
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
                  className="p-1"
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
