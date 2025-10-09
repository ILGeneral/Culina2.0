import React, { useEffect, useState } from "react";
import { View, Text, Image, ScrollView, TouchableOpacity, ActivityIndicator } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebaseConfig"; // ✅ adjust if your Firestore is in firebase.ts
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { ArrowLeft } from "lucide-react-native"; // install: npm i lucide-react-native

type Recipe = {
  id: string;
  title: string;
  description?: string;
  imageUrl?: string;
  estKcal?: number;
  servings?: number;
  ingredients?: { name: string; qty: string }[];
  steps?: string[];
  source?: "AI" | "Edited" | "Human";
};

export default function RecipeDetailsScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRecipe = async () => {
      try {
        const ref = doc(db, "recipes", String(id));
        const snap = await getDoc(ref);
        if (snap.exists()) {
          setRecipe({ id: snap.id, ...snap.data() } as Recipe);
        }
      } catch (err) {
        console.error("Error loading recipe:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchRecipe();
  }, [id]);

  if (loading) {
    return (
      <View className="flex-1 justify-center items-center bg-white">
        <ActivityIndicator size="large" color="#16a34a" />
        <Text className="mt-2 text-gray-600">Loading recipe...</Text>
      </View>
    );
  }

  if (!recipe) {
    return (
      <View className="flex-1 justify-center items-center bg-white">
        <Text className="text-gray-600">Recipe not found.</Text>
      </View>
    );
  }

  return (
    <Animated.View entering={FadeIn.duration(500)} exiting={FadeOut.duration(400)} className="flex-1 bg-white">
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* 🍲 Header Image */}
        <View className="relative">
          <Image
            source={{ uri: recipe.imageUrl }}
            className="w-full h-64"
            resizeMode="cover"
          />
          <TouchableOpacity
            onPress={() => router.back()}
            className="absolute top-12 left-5 bg-white/80 rounded-full p-2 shadow-md"
          >
            <ArrowLeft color="#166534" size={22} />
          </TouchableOpacity>
        </View>

        {/* 🧾 Recipe Info */}
        <View className="p-5">
          <Text className="text-3xl font-bold text-green-700 mb-1">
            {recipe.title}
          </Text>

          {recipe.description && (
            <Text className="text-gray-500 mb-3">{recipe.description}</Text>
          )}

          {/* 🔹 Info Chips */}
          <View className="flex-row flex-wrap gap-2 mb-4">
            {recipe.estKcal && (
              <View className="bg-green-100 px-3 py-1 rounded-full">
                <Text className="text-green-700 text-sm font-medium">
                  {recipe.estKcal} kcal
                </Text>
              </View>
            )}
            {recipe.servings && (
              <View className="bg-amber-100 px-3 py-1 rounded-full">
                <Text className="text-amber-700 text-sm font-medium">
                  Serves {recipe.servings}
                </Text>
              </View>
            )}
            {recipe.source && (
              <View className="bg-purple-100 px-3 py-1 rounded-full">
                <Text className="text-purple-700 text-sm font-medium">
                  {recipe.source}
                </Text>
              </View>
            )}
          </View>

          {/* 🥦 Ingredients */}
          {recipe.ingredients && recipe.ingredients.length > 0 && (
            <>
              <Text className="text-xl font-semibold text-green-700 mb-2">
                Ingredients
              </Text>
              {recipe.ingredients.map((ing, idx) => (
                <Text key={idx} className="text-gray-700 mb-1">
                  • {ing.name} – {ing.qty}
                </Text>
              ))}
            </>
          )}

          {/* 👩‍🍳 Instructions */}
          {recipe.steps && recipe.steps.length > 0 && (
            <>
              <Text className="text-xl font-semibold text-green-700 mt-5 mb-2">
                Instructions
              </Text>
              {recipe.steps.map((step, idx) => (
                <Text key={idx} className="text-gray-700 mb-2">
                  {idx + 1}. {step}
                </Text>
              ))}
            </>
          )}
        </View>
      </ScrollView>

      {/* 🧈 Bottom Button */}
      <View className="absolute bottom-0 left-0 right-0 p-5 bg-white border-t border-gray-100">
        <TouchableOpacity
          onPress={() => alert("Feature coming soon — Cook Now! 🍳")}
          className="bg-green-600 py-4 rounded-full shadow-md active:opacity-80"
        >
          <Text className="text-center text-white text-lg font-bold">
            Cook Now
          </Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}
