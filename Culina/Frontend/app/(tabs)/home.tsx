import React, { useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import AnimatedRecipeCard from "@/components/home/AnimatedRecipeCard";
import { Package, User, Globe, BookMarked, BookOpen } from "lucide-react-native";
import Background from "@/components/Background";
import { useSharedRecipes, SharedRecipe } from "@/hooks/useSharedRecipe";
import { homeStyles as styles } from "@/styles/tabs/homeStyles";

export default function HomeScreen() {
  const { mySharedRecipes, communityRecipes, loading, error } = useSharedRecipes();
  const [activeTab, setActiveTab] = useState<'my' | 'community'>('my');
  const router = useRouter();

  const displayedRecipes = activeTab === 'my' ? mySharedRecipes : communityRecipes;

  if (loading) {
    return (
      <Background>
        <SafeAreaView style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#128AFAFF" />
          <Text style={styles.loadingText}>Loading recipes...</Text>
        </SafeAreaView>
      </Background>
    );
  }

  if (error) {
    return (
      <Background>
        <SafeAreaView style={styles.loadingContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity 
            style={styles.retryButton}
            onPress={() => router.replace('/home')}
          >
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </SafeAreaView>
      </Background>
    );
  }

  return (
    <Background>
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

        <TouchableOpacity
          style={styles.createButton}
          activeOpacity={0.85}
          onPress={() => router.push('/recipe/maker' as any)}
        >
          <Text style={styles.createButtonText}>Create Your Recipe</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.databaseButton}
          activeOpacity={0.85}
          onPress={() => router.push('/recipe-database' as any)}
        >
          <BookOpen color="#128AFAFF" size={22} />
          <Text style={styles.databaseButtonText}>Explore Recipe Database</Text>
        </TouchableOpacity>

        {/* Tab Selector */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'my' && styles.tabActive]}
            onPress={() => setActiveTab('my')}
          >
            <BookMarked 
              size={20} 
              color={activeTab === 'my' ? '#128AFAFF' : '#64748b'} 
            />
            <Text style={[styles.tabText, activeTab === 'my' && styles.tabTextActive]}>
              My Shared
            </Text>
            {mySharedRecipes.length > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{mySharedRecipes.length}</Text>
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tab, activeTab === 'community' && styles.tabActive]}
            onPress={() => setActiveTab('community')}
          >
            <Globe 
              size={20} 
              color={activeTab === 'community' ? '#128AFAFF' : '#64748b'} 
            />
            <Text style={[styles.tabText, activeTab === 'community' && styles.tabTextActive]}>
              Community
            </Text>
            {communityRecipes.length > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{communityRecipes.length}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} style={styles.scrollView}>
          {displayedRecipes.length === 0 ? (
            <View style={styles.emptyContainer}>
              {activeTab === 'my' ? (
                <>
                  <BookMarked size={64} color="#94a3b8" />
                  <Text style={styles.emptyTitle}>No Shared Recipes Yet</Text>
                  <Text style={styles.emptyText}>
                    Share your recipes from the Saved Recipes page to see them here!
                  </Text>
                  <TouchableOpacity
                    style={styles.goToSavedButton}
                    onPress={() => router.push('/saved' as any)}
                  >
                    <Text style={styles.goToSavedText}>Go to Saved Recipes</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <Globe size={64} color="#94a3b8" />
                  <Text style={styles.emptyTitle}>No Community Recipes</Text>
                  <Text style={styles.emptyText}>
                    Be the first to share a recipe with the community!
                  </Text>
                </>
              )}
            </View>
          ) : (
            <View style={styles.recipeList}>
              {displayedRecipes.map((recipe: SharedRecipe, index: number) => (
                <AnimatedRecipeCard 
                  key={recipe.id} 
                  recipe={{ ...recipe, isShared: true }}
                  index={index}
                />
              ))}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </Background>
  );
}