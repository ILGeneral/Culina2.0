import React from "react";
import { View, Text, TouchableOpacity, ScrollView } from "react-native";

const categories = ["All", "AI", "Edited", "Human"];

export default function CategoryTabs({ activeTab, setActiveTab }: any) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mt-4">
      <View className="flex-row space-x-3">
        {categories.map((cat) => (
          <TouchableOpacity
            key={cat}
            onPress={() => setActiveTab(cat)}
            className={`px-5 py-2 rounded-full border ${
              activeTab === cat
                ? "bg-green-600 border-green-600"
                : "bg-white border-gray-300"
            }`}
          >
            <Text
              className={`font-semibold ${
                activeTab === cat ? "text-white" : "text-gray-700"
              }`}
            >
              {cat}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
}
