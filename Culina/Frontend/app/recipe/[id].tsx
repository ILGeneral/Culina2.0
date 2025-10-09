import React, { useEffect, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { View, Text, Image, ScrollView, ActivityIndicator, TouchableOpacity } from "react-native";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebaseConfig";
import { ArrowLeft } from "lucide-react-native";

export default function RecipeDetails() {
  const { id } = useLocalSearchParams(); // dynamic param from URL
  const router = useRouter();
  const [recipe, setRecipe] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;

    const fetchRecipe = async () => {
      try {
        const docRef = doc(db, "recipes", id as string);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          setRecipe(docSnap.data());
        } else {
          console.log("❌ Recipe not found");
        }
      } catch (error) {
        console.error("❌ Error fetching recipe:", error);
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
        <Text className="text-gray-500 mt-3">Loading recipe...</Text>
      </View>
    );
  }

  if (!recipe) {
    return (
      <View className="flex-1 justify-center items-center bg-white">
        <Text className="text-gray-500">Recipe not found.</Text>
        <TouchableOpacity onPress={() => router.back()} className="mt-4 bg-green-600 px-5 py-2 rounded-lg">
          <Text className="text-white font-semibold">Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-white">
      {/* Header Image */}
      <Image source={{ uri: recipe.imageUrl }} className="w-full h-64" resizeMode="cover" />

      {/* Back Button */}
      <TouchableOpacity
        onPress={() => router.back()}
        className="absolute top-12 left-5 bg-white/80 rounded-full p-2 shadow-md"
      >
        <ArrowLeft color="#166534" size={22} />
      </TouchableOpacity>

      <View className="p-5">
        <Text className="text-2xl font-bold text-green-700 mb-1">{recipe.title}</Text>
        {recipe.description && (
          <Text className="text-gray-600 text-base mb-4">{recipe.description}</Text>
        )}

        <View className="flex-row items-center mb-4">
          <Text className="text-green-700 font-semibold mr-3">{recipe.estKcal} kcal</Text>
          <View
            className={`px-3 py-1 rounded-full ${
              recipe.source === "AI"
                ? "bg-purple-100"
                : recipe.source === "Edited"
                ? "bg-yellow-100"
                : "bg-green-100"
            }`}
          >
            <Text
              className={`text-xs font-semibold ${
                recipe.source === "AI"
                  ? "text-purple-700"
                  : recipe.source === "Edited"
                  ? "text-yellow-700"
                  : "text-green-700"
              }`}
            >
              {recipe.source}
            </Text>
          </View>
        </View>

        {/* Ingredients */}
        {recipe.ingredients && recipe.ingredients.length > 0 && (
          <View className="mb-5">
            <Text className="text-lg font-semibold text-gray-800 mb-2">🧂 Ingredients</Text>
            {recipe.ingredients.map((item: any, index: number) => (
              <Text key={index} className="text-gray-600">
                • {typeof item === "string" ? item : item.name || "Unknown ingredient"}
              </Text>
            ))}
          </View>
        )}

        {/* Instructions */}
        {recipe.instructions && recipe.instructions.length > 0 && (
          <View className="mb-10">
            <Text className="text-lg font-semibold text-gray-800 mb-2">👨‍🍳 Instructions</Text>
            {recipe.instructions.map((step: string, index: number) => (
              <Text key={index} className="text-gray-600 mb-1">
                {index + 1}. {step}
              </Text>
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
}
