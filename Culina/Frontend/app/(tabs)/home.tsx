import React, { useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import AnimatedRecipeCard from "@/components/home/AnimatedRecipeCard";
import { Package, User, Globe, BookMarked } from "lucide-react-native";
import Background from "@/components/Background";
import { useSharedRecipes, SharedRecipe } from "@/hooks/useSharedRecipe";

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
                  recipe={{ ...recipe, source: 'shared' } as any}
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
  },
  loadingText: {
    marginTop: 12,
    color: "#6b7280",
    fontSize: 16,
  },
  errorText: {
    color: "#ef4444",
    fontSize: 16,
    textAlign: "center",
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: "#128AFAFF",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  retryText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
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
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
    gap: 12,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: '#f1f5f9',
    gap: 8,
  },
  tabActive: {
    backgroundColor: '#e0f2fe',
    borderWidth: 2,
    borderColor: '#128AFAFF',
  },
  tabText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#64748b',
  },
  tabTextActive: {
    color: '#128AFAFF',
  },
  badge: {
    backgroundColor: '#128AFAFF',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    minWidth: 24,
    alignItems: 'center',
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  scrollView: {
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#334155',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    color: "#9ca3af",
    textAlign: "center",
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 20,
  },
  goToSavedButton: {
    backgroundColor: '#128AFAFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 8,
  },
  goToSavedText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  recipeList: {
    gap: 20,
    paddingBottom: 20,
  },
});