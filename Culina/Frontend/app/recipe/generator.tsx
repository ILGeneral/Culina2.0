import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  SafeAreaView,
  Alert,
} from "react-native";
import { ChefHat, Save, UtensilsCrossed } from "lucide-react-native";
import { useInventory } from "@/hooks/useInventory";
import { generateRecipeFromInventory } from "@/lib/generateRecipe";
import { auth, db } from "@/lib/firebaseConfig";
import { doc, setDoc, serverTimestamp, getDocs, collection, writeBatch } from "firebase/firestore";

interface InventoryItem {
  id: string;
  name: string;
  quantity: number;
  unit?: string;
  type?: string;
  caloriesPerUnit?: number;
}

interface Recipe {
  id?: string;
  title: string;
  description?: string;
  ingredients: string[];
  instructions: string[];
  servings?: number;
  estimatedCalories?: number;
}

export default function RecipeGeneratorScreen() {
  const { inventory, loading: invLoading } = useInventory();
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [cooking, setCooking] = useState(false);

  const handleGenerate = async () => {
    try {
      setLoading(true);
      const preferences = {
        diet: "Vegetarian",
        religion: "None",
        caloriePlan: "Maintain",
      };

      const result = await generateRecipeFromInventory(inventory, preferences);
      setRecipe(result);
    } catch (err) {
      console.error(err);
      Alert.alert("Error", "Failed to generate recipe. Try again.");
    } finally {
      setLoading(false);
    }
  };

  // 🧠 Save generated recipe to Firestore
  const handleSave = async () => {
    if (!recipe) return;
    try {
      setSaving(true);
      const uid = auth.currentUser?.uid;
      if (!uid) {
        Alert.alert("Error", "You must be logged in to save recipes.");
        return;
      }

      const newRecipeRef = doc(collection(db, "users", uid, "recipes"));
      await setDoc(newRecipeRef, {
        ...recipe,
        createdAt: serverTimestamp(),
        source: "AI",
      });

      Alert.alert("Saved!", "Recipe added to your collection.");
    } catch (err) {
      console.error(err);
      Alert.alert("Error", "Could not save recipe.");
    } finally {
      setSaving(false);
    }
  };

  // 🍳 Deduct ingredients from inventory
  const handleCookThis = async () => {
    if (!recipe) return;
    try {
      setCooking(true);
      const uid = auth.currentUser?.uid;
      if (!uid) {
        Alert.alert("Error", "You must be logged in to cook recipes.");
        return;
      }

      const batch = writeBatch(db);
      const invRef = collection(db, "users", uid, "inventory");
      const snapshot = await getDocs(invRef);
      const invData: InventoryItem[] = snapshot.docs.map(
        (doc) => ({ id: doc.id, ...(doc.data() as Omit<InventoryItem, "id">) })
      );
      

      // Try to match ingredient names (simple contains-based matching)
      recipe.ingredients.forEach((ri: string) => {
        const match = invData.find((inv: any) =>
          ri.toLowerCase().includes(inv.name.toLowerCase())
        );
        if (match) {
          const ref = doc(invRef, match.id);
          const newQty = Math.max(0, (match.quantity || 0) - 1); // default 1 deduction
          batch.update(ref, { quantity: newQty });
        }
      });

      await batch.commit();
      Alert.alert("Success", "Ingredients deducted from inventory!");
    } catch (err) {
      console.error(err);
      Alert.alert("Error", "Failed to update inventory.");
    } finally {
      setCooking(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white px-5 pt-5">
      <View className="flex-row justify-between items-center mb-4">
        <Text className="text-3xl font-bold text-green-700">AI Recipe Maker 🧑‍🍳</Text>
        <ChefHat color="#16a34a" size={28} />
      </View>

      {invLoading ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#16a34a" />
          <Text className="mt-2 text-gray-500">Loading inventory...</Text>
        </View>
      ) : (
        <TouchableOpacity
          onPress={handleGenerate}
          disabled={loading}
          className="bg-green-600 rounded-xl py-4 mb-4 active:opacity-80"
        >
          <Text className="text-white text-center text-lg font-semibold">
            {loading ? "Generating Recipe..." : "Generate Recipe from Inventory"}
          </Text>
        </TouchableOpacity>
      )}

      {loading && (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#16a34a" />
          <Text className="text-gray-500 mt-2">Cooking up ideas...</Text>
        </View>
      )}

      {recipe && (
        <ScrollView className="space-y-3">
          <Text className="text-2xl font-bold text-green-700">{recipe.title}</Text>
          <Text className="text-gray-600 italic">{recipe.description}</Text>

          <Text className="text-lg font-semibold mt-4 text-green-700">Ingredients</Text>
          {recipe.ingredients.map((ing: string, i: number) => (
            <Text key={i} className="text-gray-700">• {ing}</Text>
          ))}

          <Text className="text-lg font-semibold mt-4 text-green-700">Instructions</Text>
          {recipe.instructions.map((step: string, i: number) => (
            <Text key={i} className="text-gray-700">{i + 1}. {step}</Text>
          ))}

          <View className="mt-4 bg-green-50 rounded-lg p-3">
            <Text className="text-gray-800">
              Servings: {recipe.servings} | Estimated: {recipe.estimatedCalories} kcal
            </Text>
          </View>

          {/* Save and Cook buttons */}
          <View className="flex-row justify-between mt-5 gap-3">
            <TouchableOpacity
              onPress={handleSave}
              disabled={saving}
              className="flex-1 bg-green-600 py-3 rounded-xl active:opacity-80"
            >
              <View className="flex-row justify-center items-center gap-2">
                <Save color="#fff" size={20} />
                <Text className="text-white text-lg font-semibold">
                  {saving ? "Saving..." : "Save Recipe"}
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleCookThis}
              disabled={cooking}
              className="flex-1 bg-orange-500 py-3 rounded-xl active:opacity-80"
            >
              <View className="flex-row justify-center items-center gap-2">
                <UtensilsCrossed color="#fff" size={20} />
                <Text className="text-white text-lg font-semibold">
                  {cooking ? "Cooking..." : "Cook This!"}
                </Text>
              </View>
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
