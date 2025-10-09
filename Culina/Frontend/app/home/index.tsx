import React from "react";
import { View, Text, Image, ScrollView, TouchableOpacity, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRecipes } from "@/hooks/useRecipes";
import { useRouter } from "expo-router";
import AnimatedRecipeCard from "@/components/home/AnimatedRecipeCard";

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
        <Text className="text-3xl font-bold text-green-700 mb-6">Culina Recipes</Text>

        {recipes.length === 0 ? (
          <Text className="text-gray-500 text-center mt-20">No recipes found. Add one to get started!</Text>
        ) : (
          <View className="space-y-5">
          {recipes.map((recipe, index) => (
            <AnimatedRecipeCard key={recipe.id} recipe={recipe} index={index} />
          ))}
        </View>

        )}
      </ScrollView>
    </SafeAreaView>
  );
}
