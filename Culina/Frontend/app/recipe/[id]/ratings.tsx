import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Star } from 'lucide-react-native';
import { StarRating } from '@/components/ratings/StarRating';
import { RatingModal } from '@/components/ratings/RatingModal';
import { getAllRatings, getUserRating } from '@/lib/utils/rateRecipe';
import { auth, db } from '@/lib/firebaseConfig';
import { doc, onSnapshot, collection, query, where } from 'firebase/firestore';
import type { Rating } from '@/types/rating';
import * as Haptics from 'expo-haptics';

export default function RatingsScreen() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const { id, title, averageRating, totalRatings, ratingDistribution } = params;

  const [ratings, setRatings] = useState<Rating[]>([]);
  const [userRating, setUserRating] = useState<Rating | null>(null);
  const [loading, setLoading] = useState(true);
  const [showRatingModal, setShowRatingModal] = useState(false);

  // State for real-time aggregate stats
  const [aggregateStats, setAggregateStats] = useState({
    averageRating: parseFloat(String(averageRating)) || 0,
    totalRatings: parseInt(String(totalRatings)) || 0,
    ratingDistribution: (() => {
      try {
        if (typeof ratingDistribution === 'string') {
          return JSON.parse(ratingDistribution);
        }
        return ratingDistribution || { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
      } catch {
        return { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
      }
    })(),
  });

  useEffect(() => {
    fetchRatings();

    // Set up real-time listeners
    if (!id) return;

    const unsubscribers: (() => void)[] = [];

    // 1. Listen to recipe document for aggregate rating changes
    const recipeRef = doc(db, 'sharedRecipes', String(id));
    const unsubRecipe = onSnapshot(
      recipeRef,
      (docSnapshot) => {
        if (docSnapshot.exists()) {
          const data = docSnapshot.data();
          if (data?.ratings) {
            // Update aggregate stats in real-time
            setAggregateStats({
              averageRating: data.ratings.averageRating || 0,
              totalRatings: data.ratings.totalRatings || 0,
              ratingDistribution: data.ratings.ratingDistribution || { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
            });
          }
        }
      },
      (error) => {
        console.error('Error listening to recipe updates:', error);
      }
    );
    unsubscribers.push(unsubRecipe);

    // 2. Listen to ratings collection for real-time rating changes
    const ratingsRef = collection(db, 'ratings');
    const ratingsQuery = query(
      ratingsRef,
      where('sharedRecipeId', '==', String(id))
    );
    const unsubRatings = onSnapshot(
      ratingsQuery,
      (snapshot) => {
        // Map and filter ratings in real-time
        const newRatings = snapshot.docs
          .map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }))
          .filter((rating: any) => !rating.deleted) as Rating[];

        // Sort by most recent first
        const sortedRatings = newRatings.sort((a, b) => {
          const aTime = a.createdAt?.seconds || 0;
          const bTime = b.createdAt?.seconds || 0;
          return bTime - aTime;
        });

        setRatings(sortedRatings);

        // Update user's own rating if present
        if (auth.currentUser?.uid) {
          const myRating = sortedRatings.find(
            (r) => r.userId === auth.currentUser!.uid
          );
          setUserRating(myRating || null);
        }

        setLoading(false);
      },
      (error) => {
        console.error('Error listening to ratings:', error);
        setLoading(false);
      }
    );
    unsubscribers.push(unsubRatings);

    // Cleanup all listeners on unmount
    return () => {
      unsubscribers.forEach((unsub) => unsub());
    };
  }, [id]);

  const fetchRatings = async () => {
    if (!id) return;

    setLoading(true);
    try {
      const [allRatings, currentUserRating] = await Promise.all([
        getAllRatings(String(id)),
        auth.currentUser?.uid ? getUserRating(String(id), auth.currentUser.uid) : null,
      ]);

      setRatings(allRatings);
      setUserRating(currentUserRating);
    } catch (error) {
      console.error('Error fetching ratings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRatingSubmitted = () => {
    setShowRatingModal(false);
    // No need to manually fetch - real-time listener will update automatically
    // The onSnapshot listener on the ratings collection will pick up the change instantly
  };

  const formatDate = (timestamp: any) => {
    try {
      if (timestamp?.toDate) {
        return timestamp.toDate().toLocaleDateString();
      }
      if (timestamp?.seconds) {
        return new Date(timestamp.seconds * 1000).toLocaleDateString();
      }
      return new Date(timestamp).toLocaleDateString();
    } catch {
      return 'Recently';
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.back();
          }}
        >
          <ArrowLeft size={24} color="#0f172a" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {String(title) || 'Recipe Ratings'}
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Rating Overview */}
        <View style={styles.overviewCard}>
          <View style={styles.averageSection}>
            <Text style={styles.averageNumber}>{aggregateStats.averageRating.toFixed(1)}</Text>
            <StarRating rating={aggregateStats.averageRating} size={28} />
            <Text style={styles.totalCount}>
              {aggregateStats.totalRatings} rating{aggregateStats.totalRatings !== 1 ? 's' : ''}
            </Text>
          </View>

          {/* Distribution Bars */}
          <View style={styles.distributionSection}>
            {[5, 4, 3, 2, 1].map((star) => {
              const count = aggregateStats.ratingDistribution[star as keyof typeof aggregateStats.ratingDistribution] || 0;
              const percentage = aggregateStats.totalRatings > 0 ? (count / aggregateStats.totalRatings) * 100 : 0;
              return (
                <View key={star} style={styles.distributionRow}>
                  <Text style={styles.starLabel}>{star}★</Text>
                  <View style={styles.barContainer}>
                    <View style={[styles.barFill, { width: `${percentage}%` }]} />
                  </View>
                  <Text style={styles.countLabel}>{count}</Text>
                </View>
              );
            })}
          </View>

          {/* Rate Button */}
          <TouchableOpacity
            style={styles.rateButton}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setShowRatingModal(true);
            }}
          >
            <Star size={18} color="#fff" fill={userRating ? '#fff' : 'transparent'} />
            <Text style={styles.rateButtonText}>
              {userRating ? `Your rating: ${userRating.rating}★ (Tap to edit)` : 'Rate This Recipe'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* All Reviews */}
        <View style={styles.reviewsSection}>
          <Text style={styles.sectionTitle}>All Reviews</Text>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#0ea5e9" />
            </View>
          ) : ratings.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Star size={48} color="#cbd5e1" />
              <Text style={styles.emptyTitle}>No Reviews Yet</Text>
              <Text style={styles.emptySubtitle}>Be the first to share your experience!</Text>
            </View>
          ) : (
            ratings.map((rating) => (
              <View key={rating.id} style={styles.reviewCard}>
                <View style={styles.reviewHeader}>
                  <View style={styles.userInfo}>
                    {rating.userProfilePicture ? (
                      <Image
                        source={{ uri: rating.userProfilePicture }}
                        style={styles.avatar}
                      />
                    ) : (
                      <View style={[styles.avatar, styles.avatarPlaceholder]}>
                        <Text style={styles.avatarText}>
                          {rating.userName?.charAt(0).toUpperCase() || 'U'}
                        </Text>
                      </View>
                    )}
                    <View style={styles.userDetails}>
                      <View style={styles.nameRow}>
                        <Text style={styles.userName}>{rating.userName || 'Anonymous'}</Text>
                        {rating.verified && (
                          <View style={styles.verifiedBadge}>
                            <Text style={styles.verifiedText}>✓ Cooked</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.reviewDate}>{formatDate(rating.createdAt)}</Text>
                    </View>
                  </View>
                  <StarRating rating={rating.rating} size={16} />
                </View>

                {rating.review && (
                  <Text style={styles.reviewText}>{rating.review}</Text>
                )}
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* Rating Modal */}
      <RatingModal
        visible={showRatingModal}
        onClose={handleRatingSubmitted}
        sharedRecipeId={String(id)}
        recipeName={String(title)}
        existingRating={userRating?.rating || 0}
        existingReview={userRating?.review || ''}
        existingVerified={userRating?.verified || false}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  backButton: {
    padding: 8,
    marginLeft: -8,
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
    textAlign: 'center',
    marginHorizontal: 16,
  },
  headerSpacer: {
    width: 40,
  },
  content: {
    flex: 1,
  },
  overviewCard: {
    backgroundColor: '#fff',
    padding: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  averageSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  averageNumber: {
    fontSize: 56,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 8,
  },
  totalCount: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 8,
  },
  distributionSection: {
    marginBottom: 24,
  },
  distributionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  starLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
    width: 32,
  },
  barContainer: {
    flex: 1,
    height: 8,
    backgroundColor: '#e2e8f0',
    borderRadius: 4,
    marginHorizontal: 12,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    backgroundColor: '#FFD700',
    borderRadius: 4,
  },
  countLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
    width: 32,
    textAlign: 'right',
  },
  rateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0ea5e9',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    gap: 8,
  },
  rateButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  reviewsSection: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 16,
  },
  loadingContainer: {
    paddingVertical: 48,
    alignItems: 'center',
  },
  emptyContainer: {
    paddingVertical: 48,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#0f172a',
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 4,
  },
  reviewCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  avatarPlaceholder: {
    backgroundColor: '#0ea5e9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  userDetails: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  userName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0f172a',
  },
  verifiedBadge: {
    backgroundColor: '#dcfce7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  verifiedText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#16a34a',
  },
  reviewDate: {
    fontSize: 12,
    color: '#64748b',
  },
  reviewText: {
    fontSize: 14,
    lineHeight: 20,
    color: '#475569',
  },
});
