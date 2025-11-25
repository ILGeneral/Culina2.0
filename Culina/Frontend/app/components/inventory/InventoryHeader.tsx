import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { Plus, ArrowLeft } from "lucide-react-native";

type Props = {
  onAddPress: () => void;
};

export default function InventoryHeader({ onAddPress }: Props) {
  const router = useRouter();

  return (
    <View className="flex-row justify-between items-center px-4 pt-5 pb-4 bg-white shadow-sm">
      <View className="flex-row items-center gap-3">
        <TouchableOpacity onPress={() => router.back()} className="p-2">
          <ArrowLeft color="#15803d" size={26} />
        </TouchableOpacity>
        <Text className="text-3xl font-bold text-gray-800">Pantry 🥬</Text>
      </View>

      <TouchableOpacity
        onPress={onAddPress}
        className="bg-green-600 rounded-full p-3 active:bg-green-700"
      >
        <Plus color="#fff" size={22} />
      </TouchableOpacity>
    </View>
  );
}