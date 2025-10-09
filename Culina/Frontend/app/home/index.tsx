import React from "react";
import { View, Text, Image, ScrollView, TouchableOpacity, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRecipes } from "@/hooks/useRecipes";
import { useRouter } from "expo-router";
import AnimatedRecipeCard from "@/components/home/AnimatedRecipeCard";
import { Package, User } from "lucide-react-native";

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
    <SafeAreaView className="flex-1 bg-white">
      {/* Header */}
      <View className="flex-row justify-between items-center px-5 pt-5 pb-3 border-b border-gray-200">
        <Text className="text-3xl font-bold text-green-700">Culina Recipes</Text>
        <View className="flex-row gap-3">
          <TouchableOpacity
            onPress={() => router.push("/inventory" as any)}
            className="bg-green-100 rounded-full p-2"
          >
            <Package color="#16a34a" size={24} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => router.push("/profile")}
            className="bg-green-100 rounded-full p-2"
          >
            <User color="#16a34a" size={24} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} className="px-5 pt-5">
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
