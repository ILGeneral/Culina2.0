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
    estimatedCalories?: number;
    source?: "AI" | "Edited" | "Human" | "shared";
  };
  index: number;
};

export default function AnimatedRecipeCard({ recipe, index }: AnimatedRecipeCardProps) {
  const router = useRouter();

  const handlePress = () => {
    // Check if this is a shared recipe
    if (recipe.source === 'shared') {
      router.push({
        pathname: `/recipe/[id]` as any,
        params: { 
          id: recipe.id,
          source: 'shared'
        }
      });
    } else {
      router.push(`/recipe/${recipe.id}`);
    }
  };

  // Use estimatedCalories or estKcal
  const calories = recipe.estimatedCalories || recipe.estKcal;

  // Determine display source
  const displaySource = recipe.source === 'shared' ? 'Community' : recipe.source;

  return (
    <Animated.View
      entering={FadeInUp.delay(index * 80).springify()}
      className="bg-white rounded-2xl shadow-md overflow-hidden border border-gray-100"
    >
      <TouchableOpacity onPress={handlePress}>
        {recipe.imageUrl ? (
          <Image
            source={{ uri: recipe.imageUrl }}
            className="w-full h-48"
            resizeMode="cover"
          />
        ) : (
          <View className="w-full h-48 bg-gradient-to-br from-blue-400 to-blue-600 justify-center items-center">
            <Text className="text-white text-6xl">🍳</Text>
          </View>
        )}

        <View className="p-4">
          <Text className="text-lg font-semibold text-gray-800 mb-1">
            {recipe.title}
          </Text>

          <Text className="text-gray-500 text-sm mb-2" numberOfLines={2}>
            {recipe.description || "No description"}
          </Text>

          <View className="flex-row justify-between items-center">
            {calories && (
              <Text className="text-green-700 font-medium">{calories} kcal</Text>
            )}

            {displaySource && (
              <View
                className={`px-3 py-1 rounded-full ${
                  displaySource === "AI"
                    ? "bg-purple-100"
                    : displaySource === "Edited"
                    ? "bg-yellow-100"
                    : displaySource === "Community"
                    ? "bg-blue-100"
                    : "bg-green-100"
                }`}
              >
                <Text
                  className={`text-xs font-semibold ${
                    displaySource === "AI"
                      ? "text-purple-700"
                      : displaySource === "Edited"
                      ? "text-yellow-700"
                      : displaySource === "Community"
                      ? "text-blue-700"
                      : "text-green-700"
                  }`}
                >
                  {displaySource}
                </Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}