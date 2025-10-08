import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { User } from "lucide-react-native";

export default function Header() {
  const router = useRouter();

  return (
    <View className="flex-row justify-between items-center px-5 pt-10 pb-4 bg-white shadow-sm">
      <View>
        <Text className="text-gray-500 text-sm">Welcome back 👋</Text>
        <Text className="text-xl font-bold text-green-700">Culina Recipes</Text>
      </View>
      <TouchableOpacity onPress={() => router.push("/profile")}>
        <User color="#16a34a" size={26} />
      </TouchableOpacity>
    </View>
  );
}
