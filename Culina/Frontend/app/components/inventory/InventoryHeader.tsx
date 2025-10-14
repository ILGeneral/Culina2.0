import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { Plus, Camera, ArrowLeft } from "lucide-react-native";

type Props = {
  onAddPress: () => void;
  onCameraPress: () => void;
};

export default function InventoryHeader({ onAddPress, onCameraPress }: Props) {
  const router = useRouter();
  
  return (
    <View className="flex-row justify-between items-center px-4 pt-5 pb-4 bg-white shadow-sm">
      <View className="flex-row items-center gap-3">
        <TouchableOpacity onPress={() => router.back()} className="p-2">
          <ArrowLeft color="#15803d" size={26} />
        </TouchableOpacity>
        <Text className="text-3xl font-bold text-gray-800">Pantry 🥬</Text>
      </View>

      <View className="flex-row gap-2">
        {/* UI Improvement: Consistent button styling */}
        <TouchableOpacity
          onPress={onCameraPress}
          className="bg-slate-100 rounded-full p-3 active:bg-slate-200"
        >
          <Camera color="#15803d" size={22} />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={onAddPress}
          className="bg-green-600 rounded-full p-3 active:bg-green-700"
        >
          <Plus color="#fff" size={22} />
        </TouchableOpacity>
      </View>
    </View>
  );
}