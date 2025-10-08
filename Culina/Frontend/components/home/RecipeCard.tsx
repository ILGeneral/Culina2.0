import React from "react";
import { View, Text, Image, TouchableOpacity } from "react-native";

export default function RecipeCard({ recipe, onPress }: any) {
  return (
    <TouchableOpacity
      className="bg-white border border-gray-100 rounded-2xl shadow-sm mb-5 overflow-hidden"
      onPress={onPress}
    >
      <Image
        source={{ uri: recipe.imageUrl }}
        className="w-full h-44"
        resizeMode="cover"
      />
      <View className="p-4">
        <Text className="text-lg font-bold text-gray-800 mb-1">
          {recipe.title}
        </Text>
        <Text className="text-gray-500 text-sm mb-2">
          {recipe.estKcal} kcal
        </Text>

        <View
          className={`self-start px-3 py-1 rounded-full ${
            recipe.source === "AI"
              ? "bg-green-100"
              : recipe.source === "Edited"
              ? "bg-yellow-100"
              : "bg-blue-100"
          }`}
        >
          <Text
            className={`text-xs font-semibold ${
              recipe.source === "AI"
                ? "text-green-700"
                : recipe.source === "Edited"
                ? "text-yellow-700"
                : "text-blue-700"
            }`}
          >
            {recipe.source === "AI"
              ? "AI Recipe 🤖"
              : recipe.source === "Edited"
              ? "User Edited ✍️"
              : "Human 🍴"}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}
