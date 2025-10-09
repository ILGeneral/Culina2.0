import React from "react";
import { View, Text, Image, TouchableOpacity } from "react-native";
import Animated, { FadeInUp } from "react-native-reanimated";
import { useRouter } from "expo-router";

type AnimatedRecipeCardProps = {
  recipe: {
    id: string;
    title: string;
    description?: string;
    imageUrl?: string;
    estKcal?: number;
    source?: "AI" | "Edited" | "Human";
  };
  index: number;
};

export default function AnimatedRecipeCard({ recipe, index }: AnimatedRecipeCardProps) {
  const router = useRouter();

  return (
    <Animated.View
      entering={FadeInUp.delay(index * 80).springify()} // staggered fade animation
      className="bg-white rounded-2xl shadow-md overflow-hidden border border-gray-100"
    >
      <TouchableOpacity onPress={() => router.push(`/recipe/${recipe.id}`)}>
        <Image
          source={{ uri: recipe.imageUrl }}
          className="w-full h-48"
          resizeMode="cover"
        />

        <View className="p-4">
          <Text className="text-lg font-semibold text-gray-800 mb-1">
            {recipe.title}
          </Text>

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
    </Animated.View>
  );
}
