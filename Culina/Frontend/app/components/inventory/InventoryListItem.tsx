import React from "react";
import { View, Text, TouchableOpacity, Image } from "react-native";
import { Edit2, Trash2 } from "lucide-react-native";

type Props = {
  item: any;
  onEdit: () => void;
  onDelete: () => void;
};

export default function InventoryListItem({ item, onEdit, onDelete }: Props) {
  return (
    // UI Improvement: Card-based design with shadow for better separation
    <View className="flex-row items-center bg-white p-3 mb-3 rounded-xl shadow-md shadow-black/5">
      {item.imageUrl ? (
        <Image
          source={{ uri: item.imageUrl }}
          className="w-16 h-16 rounded-lg bg-gray-100"
        />
      ) : (
        <View className="w-16 h-16 rounded-lg bg-slate-100 justify-center items-center">
          <Text className="text-gray-400 text-3xl">🥕</Text>
        </View>
      )}

      {/* UI Improvement: Better typography and spacing */}
      <View className="flex-1 ml-4">
        <Text className="text-lg font-bold text-gray-800" numberOfLines={1}>
          {item.name}
        </Text>
        <Text className="text-base text-gray-500">
          {item.quantity} {item.unit}
        </Text>
        {item.type && (
          <View className="bg-green-100 self-start px-2 py-0.5 mt-1 rounded-full">
            <Text className="text-xs font-semibold text-green-800">{item.type}</Text>
          </View>
        )}
      </View>
      
      {/* UI Improvement: Larger touch areas for icons */}
      <View className="flex-row gap-2">
        <TouchableOpacity onPress={onEdit} className="p-2 active:bg-slate-100 rounded-full">
          <Edit2 size={20} color="#16a34a" />
        </TouchableOpacity>
        <TouchableOpacity onPress={onDelete} className="p-2 active:bg-red-50 rounded-full">
          <Trash2 size={20} color="#dc2626" />
        </TouchableOpacity>
      </View>
    </View>
  );
}