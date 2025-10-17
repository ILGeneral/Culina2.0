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
import { auth, db } from "@/lib/firebaseConfig";
import {
  doc,
  setDoc,
  serverTimestamp,
  getDocs,
  collection,
  writeBatch,
} from "firebase/firestore";
import type { Recipe } from "@/types/recipe";
import { generateRecipe } from "@/lib/generateRecipe";


interface InventoryItem {
  id: string;
  name: string;
  quantity: number;
  unit?: string;
  type?: string;
  caloriesPerUnit?: number;
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
      const ingredients = inventory.map((i) => i.name);
      const data = await generateRecipe(ingredients, ["Vegetarian", "Maintain Calories"]);

      if (data?.recipes?.length && data.recipes.length >= 5) {
        setRecipe(data.recipes[0]);
      } else {
        Alert.alert("Error", "Recipe generation failed to return enough recipes.");
      }
    } catch (err) {
      console.error("GenerateRecipe Error:", err);
      Alert.alert("Error", "Failed to generate recipe. Try again.");
    } finally {
      setLoading(false);
    }
  };

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
        source: "AI (Cloud)",
      });

      Alert.alert("Saved!", "Recipe added to your collection.");
    } catch (err) {
      console.error(err);
      Alert.alert("Error", "Could not save recipe.");
    } finally {
      setSaving(false);
    }
  };

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
      const invRef = collection(db, "users", uid, "ingredients");
      const snapshot = await getDocs(invRef);
      const invData: InventoryItem[] = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...(doc.data() as Omit<InventoryItem, "id">),
      }));

      // Handle both string[] and object[] types
      recipe.ingredients.forEach((ri) => {
        const ingredientName = typeof ri === 'string' ? ri : ri.name;
        
        const match = invData.find((inv) =>
          ingredientName.toLowerCase().includes(inv.name.toLowerCase())
        );
        if (match) {
          const ref = doc(invRef, match.id);
          const newQty = Math.max(0, (match.quantity || 0) - 1);
          batch.update(ref, { quantity: newQty });
        }
      });

      await batch.commit();
      Alert.alert("Success!", "Ingredients deducted from inventory!");
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
        <Text className="text-3xl font-bold text-green-700">
          AI Recipe Maker 🧑‍🍳
        </Text>
        <ChefHat color="#1643A3FF" size={28} />
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
          {recipe.description && (
            <Text className="text-gray-600 italic">{recipe.description}</Text>
          )}

          <Text className="text-lg font-semibold mt-4 text-green-700">
            Ingredients
          </Text>
          {recipe.ingredients.map((ing, i) => (
            <Text key={i} className="text-gray-700">
              • {typeof ing === 'string' ? ing : `${ing.name}${ing.qty ? ` - ${ing.qty}` : ''}`}
            </Text>
          ))}

          <Text className="text-lg font-semibold mt-4 text-green-700">
            Instructions
          </Text>
          {/* FIXED: Handle possibly undefined instructions */}
          {(recipe.instructions || []).map((step, i) => (
            <Text key={i} className="text-gray-700">
              {i + 1}. {step}
            </Text>
          ))}

          <View className="mt-4 bg-green-50 rounded-lg p-3">
            <Text className="text-gray-800">
              Servings: {recipe.servings ?? "N/A"} | Estimated:{" "}
              {recipe.estimatedCalories ?? "N/A"} kcal
            </Text>
          </View>

          <View className="flex-row justify-between mt-5 gap-3">
            <TouchableOpacity
              onPress={handleSave}
              disabled={saving}
              className="flex-1 bg-blue-600 py-3 rounded-xl active:opacity-80"
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