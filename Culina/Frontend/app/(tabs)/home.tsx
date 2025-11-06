import React, { useState, useMemo, useEffect } from "react";
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Image } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import AnimatedRecipeCard from "@/components/home/AnimatedRecipeCard";
import { Package, User, Globe, BookMarked, BookOpen, SlidersHorizontal, Star, TrendingUp, Clock, ChevronDown } from "lucide-react-native";
import Background from "@/components/Background";
import { useSharedRecipes, SharedRecipe } from "@/hooks/useSharedRecipe";
import { homeStyles as styles } from "@/styles/tabs/homeStyles";
import { auth, db } from "@/lib/firebaseConfig";
import { doc, getDoc } from "firebase/firestore";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  Easing,
} from "react-native-reanimated";

type SortOption = 'recent' | 'rating' | 'ratingCount';
type FilterOption = 'all' | '4plus' | '3plus';

export default function HomeScreen() {
  const { mySharedRecipes, communityRecipes, loading, error } = useSharedRecipes();
  const [activeTab, setActiveTab] = useState<'my' | 'community'>('my');
  const [sortBy, setSortBy] = useState<SortOption>('recent');
  const [filterRating, setFilterRating] = useState<FilterOption>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [showNavigation, setShowNavigation] = useState(true);
  const [userProfilePicture, setUserProfilePicture] = useState<string | null>(null);
  const router = useRouter();

  // Animated values for navigation container (initialize with showNavigation state)
  const navigationHeight = useSharedValue(showNavigation ? 1 : 0);
  const chevronRotation = useSharedValue(showNavigation ? 180 : 0);

  // Update animated values when showNavigation changes
  useEffect(() => {
    navigationHeight.value = withTiming(showNavigation ? 1 : 0, {
      duration: 300,
      easing: Easing.bezier(0.25, 0.1, 0.25, 1),
    });
    chevronRotation.value = withSpring(showNavigation ? 180 : 0, {
      damping: 15,
      stiffness: 150,
    });
  }, [showNavigation]);

  // Animated styles
  const animatedContentStyle = useAnimatedStyle(() => ({
    maxHeight: navigationHeight.value * 500, // Approximate max height
    opacity: navigationHeight.value,
    overflow: 'hidden',
  }));

  const animatedChevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${chevronRotation.value}deg` }],
  }));

  // Fetch user profile picture
  useEffect(() => {
    const fetchUserProfile = async () => {
      const user = auth.currentUser;
      if (!user) return;

      try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        const userData = userDoc.data();
        if (userData?.profilePicture) {
          setUserProfilePicture(userData.profilePicture);
        }
      } catch (error) {
        console.error('Error fetching user profile:', error);
      }
    };

    fetchUserProfile();
  }, []);

  // Filter and sort recipes
  const displayedRecipes = useMemo(() => {
    let recipes = activeTab === 'my' ? mySharedRecipes : communityRecipes;

    // Apply rating filter
    if (filterRating !== 'all') {
      recipes = recipes.filter((recipe) => {
        const avgRating = recipe.ratings?.averageRating || 0;
        if (filterRating === '4plus') return avgRating >= 4;
        if (filterRating === '3plus') return avgRating >= 3;
        return true;
      });
    }

    // Apply sorting
    recipes = [...recipes].sort((a, b) => {
      if (sortBy === 'rating') {
        const ratingA = a.ratings?.averageRating || 0;
        const ratingB = b.ratings?.averageRating || 0;
        return ratingB - ratingA; // Highest first
      }
      if (sortBy === 'ratingCount') {
        const countA = a.ratings?.totalRatings || 0;
        const countB = b.ratings?.totalRatings || 0;
        return countB - countA; // Most rated first
      }
      // Default: recent (already sorted by sharedAt in hook)
      return 0;
    });

    return recipes;
  }, [activeTab, mySharedRecipes, communityRecipes, sortBy, filterRating]);

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
              style={styles.profileButton}
            >
              {userProfilePicture ? (
                <Image
                  source={{ uri: userProfilePicture }}
                  style={styles.profileImage}
                />
              ) : (
                <User color="#128AFAFF" size={24} />
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Collapsible Navigation Container */}
        <View style={styles.navigationContainer}>
          <TouchableOpacity
            style={styles.navigationHeader}
            onPress={() => setShowNavigation(!showNavigation)}
            activeOpacity={0.7}
          >
            <Text style={styles.navigationHeaderText}>Navigation</Text>
            <Animated.View style={animatedChevronStyle}>
              <ChevronDown
                size={20}
                color="#128AFAFF"
              />
            </Animated.View>
          </TouchableOpacity>

          <Animated.View style={[styles.navigationContent, animatedContentStyle]}>
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

              {/* Filter/Sort Controls */}
              <View style={styles.filterContainer}>
                <TouchableOpacity
                  style={styles.filterToggle}
                  onPress={() => setShowFilters(!showFilters)}
                >
                  <SlidersHorizontal size={18} color="#128AFAFF" />
                  <Text style={styles.filterToggleText}>
                    {showFilters ? 'Hide' : 'Show'} Filters
                  </Text>
                </TouchableOpacity>

          {showFilters && (
            <View style={styles.filterOptions}>
              {/* Sort Options */}
              <View style={styles.filterSection}>
                <Text style={styles.filterSectionTitle}>Sort By</Text>
                <View style={styles.filterButtons}>
                  <TouchableOpacity
                    style={[styles.filterButton, sortBy === 'recent' && styles.filterButtonActive]}
                    onPress={() => setSortBy('recent')}
                  >
                    <Clock size={16} color={sortBy === 'recent' ? '#fff' : '#128AFAFF'} />
                    <Text style={[styles.filterButtonText, sortBy === 'recent' && styles.filterButtonTextActive]}>
                      Recent
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.filterButton, sortBy === 'rating' && styles.filterButtonActive]}
                    onPress={() => setSortBy('rating')}
                  >
                    <Star size={16} color={sortBy === 'rating' ? '#fff' : '#128AFAFF'} />
                    <Text style={[styles.filterButtonText, sortBy === 'rating' && styles.filterButtonTextActive]}>
                      Top Rated
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.filterButton, sortBy === 'ratingCount' && styles.filterButtonActive]}
                    onPress={() => setSortBy('ratingCount')}
                  >
                    <TrendingUp size={16} color={sortBy === 'ratingCount' ? '#fff' : '#128AFAFF'} />
                    <Text style={[styles.filterButtonText, sortBy === 'ratingCount' && styles.filterButtonTextActive]}>
                      Most Rated
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Filter Options */}
              <View style={styles.filterSection}>
                <Text style={styles.filterSectionTitle}>Filter by Rating</Text>
                <View style={styles.filterButtons}>
                  <TouchableOpacity
                    style={[styles.filterButton, filterRating === 'all' && styles.filterButtonActive]}
                    onPress={() => setFilterRating('all')}
                  >
                    <Text style={[styles.filterButtonText, filterRating === 'all' && styles.filterButtonTextActive]}>
                      All
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.filterButton, filterRating === '4plus' && styles.filterButtonActive]}
                    onPress={() => setFilterRating('4plus')}
                  >
                    <Star size={16} color={filterRating === '4plus' ? '#fff' : '#FFD700'} fill={filterRating === '4plus' ? '#fff' : '#FFD700'} />
                    <Text style={[styles.filterButtonText, filterRating === '4plus' && styles.filterButtonTextActive]}>
                      4+ Stars
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.filterButton, filterRating === '3plus' && styles.filterButtonActive]}
                    onPress={() => setFilterRating('3plus')}
                  >
                    <Star size={16} color={filterRating === '3plus' ? '#fff' : '#FFD700'} fill={filterRating === '3plus' ? '#fff' : '#FFD700'} />
                    <Text style={[styles.filterButtonText, filterRating === '3plus' && styles.filterButtonTextActive]}>
                      3+ Stars
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}
              </View>
          </Animated.View>
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