import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, SafeAreaView, Alert, ScrollView } from "react-native";
import { addRecipe } from "@/lib/firestoreUtils";

export default function TestAddRecipe() {
  const [title, setTitle] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [estKcal, setEstKcal] = useState("");
  const [source, setSource] = useState<"AI" | "Edited" | "Human">("Human");
  const [loading, setLoading] = useState(false);

  const handleAdd = async () => {
    if (!title || !imageUrl || !estKcal) {
      Alert.alert("Missing fields", "Please fill all required fields.");
      return;
    }

    setLoading(true);
    try {
      await addRecipe({
        title,
        imageUrl,
        estKcal: parseInt(estKcal),
        source,
        visibility: "public",
      });
      Alert.alert("Success 🎉", "Recipe added successfully!");
      setTitle("");
      setImageUrl("");
      setEstKcal("");
    } catch (err) {
      Alert.alert("Error ❌", "Failed to add recipe.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white px-5 pt-10">
      <ScrollView>
        <Text className="text-2xl font-bold text-green-700 mb-5">
          Add a New Recipe
        </Text>

        <TextInput
          className="border border-gray-300 rounded-lg p-3 mb-3"
          placeholder="Title"
          value={title}
          onChangeText={setTitle}
        />

        <TextInput
          className="border border-gray-300 rounded-lg p-3 mb-3"
          placeholder="Image URL"
          value={imageUrl}
          onChangeText={setImageUrl}
        />

        <TextInput
          className="border border-gray-300 rounded-lg p-3 mb-3"
          placeholder="Estimated Calories"
          keyboardType="numeric"
          value={estKcal}
          onChangeText={setEstKcal}
        />

        <View className="flex-row space-x-3 mt-2 mb-5">
          {["AI", "Edited", "Human"].map((type) => (
            <TouchableOpacity
              key={type}
              onPress={() => setSource(type as any)}
              className={`px-5 py-2 rounded-full border ${
                source === type
                  ? "bg-green-600 border-green-600"
                  : "bg-white border-gray-300"
              }`}
            >
              <Text
                className={`font-semibold ${
                  source === type ? "text-white" : "text-gray-700"
                }`}
              >
                {type}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          onPress={handleAdd}
          disabled={loading}
          className={`bg-green-600 py-4 rounded-xl ${
            loading ? "opacity-50" : ""
          }`}
        >
          <Text className="text-white text-center text-lg font-semibold">
            {loading ? "Adding..." : "Add Recipe"}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
