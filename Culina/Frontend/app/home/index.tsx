import React from "react";
import { View, Text, Image, ScrollView, TouchableOpacity, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRecipes } from "@/hooks/useRecipes";
import { useRouter } from "expo-router";

export default function HomeScreen() {
  const { recipes, loading } = useRecipes();
  const router = useRouter();

  if (loading) {
    return (
      <SafeAreaView className="flex-1 justify-center items-center bg-white">
        <ActivityIndicator size="large" color="#16a34a" />
        <Text className="mt-3 text-gray-600">Loading recipes...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white px-5 pt-5">
      <ScrollView showsVerticalScrollIndicator={false}>
        <Text className="text-3xl font-bold text-green-700 mb-6">🍽️ Culina Recipes</Text>

        {recipes.length === 0 ? (
          <Text className="text-gray-500 text-center mt-20">No recipes found. Add one to get started!</Text>
        ) : (
          <View className="space-y-5">
            {recipes.map((recipe) => (
              <TouchableOpacity
                key={recipe.id}
                onPress={() => router.push(`/recipe/${recipe.id}`)}
                className="bg-white rounded-2xl shadow-md overflow-hidden border border-gray-100"
              >
                <Image source={{ uri: recipe.imageUrl }} className="w-full h-48" resizeMode="cover" />

                <View className="p-4">
                  <Text className="text-lg font-semibold text-gray-800 mb-1">{recipe.title}</Text>
                  <Text className="text-gray-500 text-sm mb-2" numberOfLines={2}>
                    {recipe.description || "No description"}
                  </Text>

                  <View className="flex-row justify-between items-center">
                    <Text className="text-green-700 font-medium">{recipe.estKcal} kcal</Text>
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
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
