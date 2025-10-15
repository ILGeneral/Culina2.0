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
import { useLocalSearchParams, useRouter } from "expo-router";
import { db, auth } from "@/lib/firebaseConfig";
import {
  doc,
  getDoc,
  collection,
  getDocs,
  writeBatch,
} from "firebase/firestore";
import { ArrowLeft, UtensilsCrossed, RotateCcw, Star } from "lucide-react-native";
import { rateRecipe } from "@/lib/functions/rateRecipe";
import type { Recipe } from "@/types/recipe";

interface InventoryItem {
  id: string;
  name: string;
  quantity: number;
  unit?: string;
  type?: string;
  caloriesPerUnit?: number;
}

/* STEP 1 — Unit conversion map */
const unitConversions: Record<string, Record<string, number>> = {
  g: { kg: 0.001 },
  kg: { g: 1000 },
  ml: { l: 0.001, tbsp: 1 / 15, tsp: 1 / 5 },
  l: { ml: 1000 },
  tbsp: { ml: 15 },
  tsp: { ml: 5 },
  pcs: { piece: 1, unit: 1 },
  piece: { pcs: 1 },
};

/* ✅ STEP 2 — Convert between units when possible */
function convertUnit(amount: number, from?: string, to?: string): number {
  if (!from || !to || from === to) return amount;
  const table = unitConversions[from.toLowerCase()];
  if (table && table[to.toLowerCase()]) {
    return amount * table[to.toLowerCase()];
  }
  const reverse = unitConversions[to.toLowerCase()];
  if (reverse && reverse[from.toLowerCase()]) {
    return amount / reverse[from.toLowerCase()];
  }
  return amount; // fallback if no conversion found
}

/* STEP 3 — Parse ingredient text */
function parseIngredients(lines: string[]) {
  const fractionToDecimal = (str: string): number => {
    if (str.includes("/")) {
      const [num, den] = str.split("/").map(Number);
      return den ? num / den : 0;
    }
    return parseFloat(str);
  };

  return lines.map((line) => {
    const lower = line.toLowerCase().trim();
    const match = lower.match(
      /^(\d+(?:[.,]\d+)?|\d+\s*\d*\/\d*)\s*([a-zA-Z]*)?\s*(.*)$/
    );

    if (match) {
      const quantity = fractionToDecimal(match[1]);
      const unit = match[2] || undefined;
      const name = match[3]?.trim() || "";
      return { name, quantity, unit };
    } else {
      return { name: lower, quantity: 1 };
    }
  });
}

export default function RecipeDetailsScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [loading, setLoading] = useState(true);
  const [cooking, setCooking] = useState(false);
  const [lastDeducted, setLastDeducted] = useState<
    { id: string; previousQty: number; newQty: number }[]
  >([]);

  /* Fetch recipe details */
  const fetchRecipe = async () => {
    try {
      setLoading(true);
      const uid = auth.currentUser?.uid;
      if (!uid) {
        Alert.alert("Error", "You must be logged in to view this recipe.");
        return;
      }

      const recipeRef = doc(db, "users", uid, "recipes", id as string);
      const snapshot = await getDoc(recipeRef);

      if (snapshot.exists()) {
        const data = snapshot.data() as Omit<Recipe, "id"> | undefined;
        if (data) setRecipe({ id: snapshot.id, ...data });
        else {
          Alert.alert("Not Found", "Recipe data missing.");
          router.back();
        }
      } else {
        Alert.alert("Not Found", "Recipe not found.");
        router.back();
      }
    } catch (err) {
      console.error(err);
      Alert.alert("Error", "Failed to fetch recipe details.");
    } finally {
      setLoading(false);
    }
  };

  /* 🍳 Cook This — Deduct ingredients */
  const handleCookThis = async () => {
    if (!recipe) return;
    try {
      setCooking(true);
      const uid = auth.currentUser?.uid;
      if (!uid) {
        Alert.alert("Error", "You must be logged in to cook recipes.");
        return;
      }

      const invRef = collection(db, "users", uid, "inventory");
      const snapshot = await getDocs(invRef);
      const inventory: InventoryItem[] = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...(doc.data() as Omit<InventoryItem, "id">),
      }));

      const ingredientsAsStrings = recipe.ingredients.map((ing) => {
        if (typeof ing === 'string') {
          return ing;
        }
        return `${ing.qty || ''} ${ing.name}`.trim();
      });

      const parsed = parseIngredients(ingredientsAsStrings);
      const batch = writeBatch(db);
      const deductions: { id: string; previousQty: number; newQty: number }[] =
        [];
      let deductedCount = 0;

      for (const item of parsed) {
        const match = inventory.find((inv) =>
          inv.name.toLowerCase().includes(item.name.toLowerCase())
        );
        if (!match) continue;

        const invUnit = match.unit?.toLowerCase();
        const itemUnit = item.unit?.toLowerCase();
        let deductQty = item.quantity || 1;

        if (invUnit && itemUnit && invUnit !== itemUnit) {
          deductQty = convertUnit(deductQty, itemUnit, invUnit);
        }

        const currentQty = match.quantity || 0;
        const newQty = Math.max(0, currentQty - deductQty);

        if (newQty !== currentQty) {
          const ref = doc(invRef, match.id);
          batch.update(ref, { quantity: newQty });
          deductions.push({ id: match.id, previousQty: currentQty, newQty });
          deductedCount++;
        }
      }

      if (deductedCount > 0) {
        await batch.commit();
        setLastDeducted(deductions);
        Alert.alert(
          "Cooked Successfully",
          `Ingredients updated for ${deductedCount} items. You can undo this action.`
        );
      } else {
        Alert.alert(
          "Notice",
          "No matching or convertible ingredients found in your inventory."
        );
      }
    } catch (err) {
      console.error("CookThis Error:", err);
      Alert.alert("Error", "Failed to update inventory.");
    } finally {
      setCooking(false);
    }
  };

  /* Undo Cook — Restore previous quantities */
  const handleUndoCook = async () => {
    if (lastDeducted.length === 0) {
      Alert.alert("Nothing to Undo", "No previous cooking deductions found.");
      return;
    }

    try {
      const uid = auth.currentUser?.uid;
      if (!uid) return;

      const invRef = collection(db, "users", uid, "inventory");
      const batch = writeBatch(db);

      lastDeducted.forEach((item) => {
        const ref = doc(invRef, item.id);
        batch.update(ref, { quantity: item.previousQty });
      });

      await batch.commit();
      setLastDeducted([]); // clear history after undo
      Alert.alert("Undo Successful!", "Inventory quantities have been restored!");
    } catch (err) {
      console.error("UndoCook Error:", err);
      Alert.alert("Error", "Failed to restore ingredient quantities.");
    }
  };

// Rate Recipe
const handleRateRecipe = async (rating: number) => {
  if (!recipe?.id) return;
  try {
    await rateRecipe(recipe.id, rating);
    Alert.alert("⭐ Thank you!", `You rated this recipe ${rating} stars.`);
  } catch (err) {
    console.error("RateRecipe Error:", err);
    Alert.alert("Error", "Failed to submit rating.");
  }
};

  useEffect(() => {
    fetchRecipe();
  }, []);

  if (loading) {
    return (
      <SafeAreaView className="flex-1 justify-center items-center bg-white">
        <ActivityIndicator size="large" color="#16a34a" />
        <Text className="mt-2 text-gray-500">Loading recipe...</Text>
      </SafeAreaView>
    );
  }

  if (!recipe) return null;

  return (
    <SafeAreaView className="flex-1 bg-white">
      {/* Header */}
      <View className="flex-row items-center justify-between px-5 pt-5 pb-3 border-b border-gray-200">
        <View className="flex-row items-center gap-3">
          <TouchableOpacity onPress={() => router.back()}>
            <ArrowLeft color="#16a34a" size={24} />
          </TouchableOpacity>
          <Text className="text-3xl font-bold text-green-700">
            Recipe Details
          </Text>
        </View>
      </View>

      <ScrollView className="px-5 pt-4">
        <Text className="text-2xl font-bold text-green-800">
          {recipe.title}
        </Text>
        {recipe.description ? (
          <Text className="text-gray-600 italic mt-2">{recipe.description}</Text>
        ) : null}

        <View className="mt-3 bg-green-50 p-3 rounded-lg">
          <Text className="text-gray-700">
            Servings: {recipe.servings || "N/A"} | Calories:{" "}
            {recipe.estimatedCalories || "N/A"} kcal
          </Text>
        </View>

        {/* Ingredients */}
        <Text className="text-lg font-semibold mt-5 text-green-700">
          Ingredients
        </Text>
        {recipe.ingredients?.map((ing, i) => {
          if (typeof ing === 'string') {
            return (
              <Text key={i} className="text-gray-700 mt-1">
                • {ing}
              </Text>
            );
          }
          return (
            <Text key={i} className="text-gray-700 mt-1">
              • {ing.qty ? `${ing.qty} ` : ''}{ing.name}
            </Text>
          );
        })}

        {/* Instructions */}
        <Text className="text-lg font-semibold mt-5 text-green-700">
          Instructions
        </Text>
        {recipe.instructions?.map((step: string, i: number) => (
          <Text key={i} className="text-gray-700 mt-1">
            {i + 1}. {step}
          </Text>
        ))}

        {/* Cook / Undo Buttons */}
        <View className="flex-row justify-between mt-6 mb-8">
          <TouchableOpacity
            onPress={handleCookThis}
            disabled={cooking}
            className="flex-1 bg-orange-500 rounded-xl py-4 mx-1 active:opacity-80"
          >
            <View className="flex-row justify-center items-center gap-2">
              <UtensilsCrossed color="#fff" size={22} />
              <Text className="text-white text-lg font-semibold">
                {cooking ? "Cooking..." : "Cook This!"}
              </Text>
            </View>
          </TouchableOpacity>

          {lastDeducted.length > 0 && (
            <TouchableOpacity
              onPress={handleUndoCook}
              className="flex-1 bg-gray-500 rounded-xl py-4 mx-1 active:opacity-80"
            >
              <View className="flex-row justify-center items-center gap-2">
                <RotateCcw color="#fff" size={22} />
                <Text className="text-white text-lg font-semibold">
                  Undo Cook
                </Text>
              </View>
            </TouchableOpacity>
          )}
        </View>
        <View className="flex-row justify-around mt-5 mb-10">
          {[1, 2, 3, 4, 5].map((star) => (
            <TouchableOpacity key={star} onPress={() => handleRateRecipe(star)}>
              <Star color="#facc15" size={28} />
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
