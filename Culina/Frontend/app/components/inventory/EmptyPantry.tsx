import React from "react";
import { View, Text } from "react-native";

export default function EmptyPantry() {
  return (
    <View className="flex-1 justify-center items-center mt-24">
      <Text className="text-6xl mb-4">🥫</Text>
      <Text className="text-xl font-bold text-gray-700">Your pantry is empty</Text>
      <Text className="text-base text-gray-500 mt-2 text-center px-8">
        Tap the `+` or `📷` button to add your first ingredient!
      </Text>
    </View>
  );
}