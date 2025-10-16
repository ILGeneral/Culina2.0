import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  Image,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { doc, getDoc } from "firebase/firestore";
import { db, auth } from "@/lib/firebaseConfig";
import { ArrowLeft } from "lucide-react-native";
import AnimatedPageWrapper from "@/app/components/AnimatedPageWrapper";
import type { Recipe } from "@/types/recipe";

type RecipeDoc = Recipe & {
  id: string;
  ingredients?: (string | { name: string; qty?: string })[];
  instructions?: string[];
  estimatedCalories?: number;
  source?: "AI" | "Edited" | "Human";
};

export default function RecipeDetailsScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const [recipe, setRecipe] = useState<RecipeDoc | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRecipe = async () => {
      try {
        const uid = auth.currentUser?.uid;
        
        if (!uid) {
          console.error("User not authenticated");
          setLoading(false);
          return;
        }

        // ✅ First, try to load from user's personal recipes subcollection
        const userRecipeRef = doc(db, "users", uid, "recipes", String(id));
        const userRecipeSnap = await getDoc(userRecipeRef);
        
        if (userRecipeSnap.exists()) {
          const data = userRecipeSnap.data() as Partial<RecipeDoc>;
          if (data.title && Array.isArray(data.ingredients) && Array.isArray(data.instructions)) {
            setRecipe({ id: userRecipeSnap.id, ...data } as RecipeDoc);
            setLoading(false);
            return;
          }
        }

        // ✅ If not found in user's subcollection, try top-level recipes collection
        const topLevelRecipeRef = doc(db, "recipes", String(id));
        const topLevelRecipeSnap = await getDoc(topLevelRecipeRef);
        
        if (topLevelRecipeSnap.exists()) {
          const data = topLevelRecipeSnap.data() as Partial<RecipeDoc>;
          if (data.title && Array.isArray(data.ingredients) && Array.isArray(data.instructions)) {
            setRecipe({ id: topLevelRecipeSnap.id, ...data } as RecipeDoc);
          }
        }
      } catch (err) {
        console.error("Error loading recipe:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchRecipe();
  }, [id]);

  if (loading) {
    return (
      <View className="flex-1 justify-center items-center bg-white">
        <ActivityIndicator size="large" color="#16a34a" />
        <Text className="mt-2 text-gray-600">Loading recipe...</Text>
      </View>
    );
  }

  if (!recipe) {
    return (
      <View className="flex-1 justify-center items-center bg-white">
        <Text className="text-gray-600">Recipe not found.</Text>
        <TouchableOpacity 
          onPress={() => router.back()}
          className="mt-4 bg-green-600 px-6 py-3 rounded-full"
        >
          <Text className="text-white font-semibold">Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <AnimatedPageWrapper>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* 🍲 Header Image */}
        {recipe.imageUrl && (
          <View className="relative">
            <Image
              source={{ uri: recipe.imageUrl }}
              className="w-full h-64"
              resizeMode="cover"
            />
            <TouchableOpacity
              onPress={() => router.back()}
              className="absolute top-12 left-5 bg-white/80 rounded-full p-2 shadow-md"
            >
              <ArrowLeft color="#166534" size={22} />
            </TouchableOpacity>
          </View>
        )}

        {/* If no image, show back button at top */}
        {!recipe.imageUrl && (
          <View className="pt-12 px-5 pb-3">
            <TouchableOpacity
              onPress={() => router.back()}
              className="self-start bg-green-100 rounded-full p-2"
            >
              <ArrowLeft color="#166534" size={22} />
            </TouchableOpacity>
          </View>
        )}

        {/* 🧾 Recipe Info */}
        <View className="p-5">
          <Text className="text-3xl font-bold text-green-700 mb-1">
            {recipe.title}
          </Text>

          {recipe.description && (
            <Text className="text-gray-500 mb-3">{recipe.description}</Text>
          )}

          {/* 🔹 Info Chips */}
          <View className="flex-row flex-wrap gap-2 mb-4">
            {recipe.estimatedCalories && (
              <View className="bg-green-100 px-3 py-1 rounded-full">
                <Text className="text-green-700 text-sm font-medium">
                  {recipe.estimatedCalories} kcal
                </Text>
              </View>
            )}
            {recipe.servings && (
              <View className="bg-amber-100 px-3 py-1 rounded-full">
                <Text className="text-amber-700 text-sm font-medium">
                  Serves {recipe.servings}
                </Text>
              </View>
            )}
            {recipe.source && (
              <View className="bg-purple-100 px-3 py-1 rounded-full">
                <Text className="text-purple-700 text-sm font-medium">
                  {recipe.source}
                </Text>
              </View>
            )}
          </View>

          {/* 🥦 Ingredients */}
          {recipe.ingredients && recipe.ingredients.length > 0 && (
            <>
              <Text className="text-xl font-semibold text-green-700 mb-2">
                Ingredients
              </Text>
              {recipe.ingredients.map((ing: string | { name: string; qty?: string }, idx: number) => {
                if (typeof ing === "string")
                  return (
                    <Text key={idx} className="text-gray-700 mb-1">
                      • {ing}
                    </Text>
                  );
                return (
                  <Text key={idx} className="text-gray-700 mb-1">
                    • {ing.name}
                    {ing.qty ? ` — ${ing.qty}` : ""}
                  </Text>
                );
              })}
            </>
          )}

          {/* 👩‍🍳 Instructions */}
          {recipe.instructions && recipe.instructions.length > 0 && (
            <>
              <Text className="text-xl font-semibold text-green-700 mt-5 mb-2">
                Instructions
              </Text>
              {recipe.instructions.map((step: string, idx: number) => (
                <Text key={idx} className="text-gray-700 mb-2">
                  {idx + 1}. {step}
                </Text>
              ))}
            </>
          )}
        </View>
      </ScrollView>

      {/* 🧈 Bottom Button */}
      <View className="absolute bottom-0 left-0 right-0 p-5 bg-white border-t border-gray-100">
        <TouchableOpacity
          onPress={() => alert("Feature coming soon — Cook Now! 🍳")}
          className="bg-green-600 py-4 rounded-full shadow-md active:opacity-80"
        >
          <Text className="text-center text-white text-lg font-bold">
            Cook Now
          </Text>
        </TouchableOpacity>
      </View>
    </AnimatedPageWrapper>
  );
}