import React from "react";
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRecipes } from "@/hooks/useRecipes";
import { useRouter } from "expo-router";
import AnimatedRecipeCard from "@/components/home/AnimatedRecipeCard";
import { Package, User } from "lucide-react-native";

export default function HomeScreen() {
  const { recipes, loading } = useRecipes();
  const router = useRouter();

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#128AFAFF" />
        <Text style={styles.loadingText}>Loading recipes...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Culina</Text>
        <View style={styles.headerButtons}>
          <TouchableOpacity
            onPress={() => router.push("/inventory" as any)}
            style={styles.iconButton}
          >
            <Package color="#128AFAFF" size={24} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => router.push("/profile")}
            style={styles.iconButton}
          >
            <User color="#128AFAFF" size={24} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} style={styles.scrollView}>
        {recipes.length === 0 ? (
          <Text style={styles.emptyText}>No shared recipes found. Add one to get started!</Text>
        ) : (
          <View style={styles.recipeList}>
            {recipes.map((recipe, index) => (
              <AnimatedRecipeCard key={recipe.id} recipe={recipe} index={index} />
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
  },
  loadingText: {
    marginTop: 12,
    color: "#6b7280",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#128AFAFF",
  },
  headerButtons: {
    flexDirection: "row",
    gap: 12,
  },
  iconButton: {
    backgroundColor: "#DCF3FCFF",
    borderRadius: 20,
    padding: 8,
  },
  scrollView: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  emptyText: {
    color: "#9ca3af",
    textAlign: "center",
    marginTop: 80,
  },
  recipeList: {
    gap: 20,
  },
});
