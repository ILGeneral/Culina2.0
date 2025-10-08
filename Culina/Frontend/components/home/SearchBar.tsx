import React, { useState } from "react";
import { View, TextInput } from "react-native";
import { Search } from "lucide-react-native";

export default function SearchBar() {
  const [query, setQuery] = useState("");

  return (
    <View className="flex-row items-center bg-gray-100 rounded-xl px-3 py-2 mt-4">
      <Search size={20} color="#6b7280" />
      <TextInput
        className="flex-1 ml-2 text-gray-700"
        placeholder="Search recipes or ingredients..."
        value={query}
        onChangeText={setQuery}
      />
    </View>
  );
}
