import React, { useState, useEffect } from "react";
import { View, Text, FlatList, SafeAreaView, ScrollView, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import Header from "@/components/home/Header";
import SearchBar from "@/components/home/SearchBar";
import CategoryTabs from "@/components/home/CategoryTabs";
import RecipeCard from "@/components/home/RecipeCard";

interface Recipe {
  id: string;
  title: string;
  imageUrl: string;
  estKcal: number;
  source: string;
}

export default function HomeScreen() {
  const router = useRouter();

  const [activeTab, setActiveTab] = useState("All");
  const [recipes, setRecipes] = useState<Recipe[]>([]);

  // Mock data for now
  useEffect(() => {
    setRecipes([
      {
        id: "1",
        title: "Garlic Butter Pasta",
        imageUrl: "https://images.unsplash.com/photo-1603133872878-684f36ec1a26",
        estKcal: 540,
        source: "AI",
      },
      {
        id: "2",
        title: "Vegan Buddha Bowl",
        imageUrl: "https://images.unsplash.com/photo-1601050690597-7a4cc03c7b22",
        estKcal: 420,
        source: "Human",
      },
      {
        id: "3",
        title: "Spicy Tuna Roll (Edited)",
        imageUrl: "https://images.unsplash.com/photo-1553621042-f6e147245754",
        estKcal: 380,
        source: "Edited",
      },
    ]);
  }, []);

  const filtered =
    activeTab === "All"
      ? recipes
      : recipes.filter((r) => r.source === activeTab);

  return (
    <SafeAreaView className="flex-1 bg-white">
      <Header />
      <ScrollView className="px-5">
        <SearchBar />
        <CategoryTabs activeTab={activeTab} setActiveTab={setActiveTab} />

        <Text className="text-lg font-semibold text-gray-700 mt-4 mb-2">
          Recommended Recipes 🍽️
        </Text>

        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <RecipeCard recipe={item} onPress={() => router.push(`/recipe/${item.id}`)} />
          )}
          scrollEnabled={false}
        />
      </ScrollView>

      <TouchableOpacity
        className="absolute bottom-8 right-8 bg-green-600 p-5 rounded-full shadow-lg"
        onPress={() => router.push("/generateRecipe")}
      >
        <Text className="text-white text-xl font-bold">＋</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}
