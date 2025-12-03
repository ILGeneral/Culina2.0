import React from 'react';
import { View, TouchableOpacity, Text } from 'react-native';
import { Star } from 'lucide-react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { styles } from '@/styles/components/ratings/starRatingStyles';

interface StarRatingProps {
  rating: number;
  onRatingChange?: (rating: number) => void;
  size?: number;
  interactive?: boolean;
  showCount?: boolean;
  count?: number;
  showLabel?: boolean;
}

export function StarRating({
  rating,
  onRatingChange,
  size = 20,
  interactive = false,
  showCount = false,
  count = 0,
  showLabel = false,
}: StarRatingProps) {
  const renderStars = () => {
    return [1, 2, 3, 4, 5].map((star) => {
      const filled = star <= Math.round(rating);

      if (interactive && onRatingChange) {
        return (
          <AnimatedStar
            key={star}
            star={star}
            filled={filled}
            size={size}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onRatingChange(star);
            }}
          />
        );
      }

      return (
        <Star
          key={star}
          size={size}
          fill={filled ? '#FFD700' : 'transparent'}
          color={filled ? '#FFD700' : '#E5E7EB'}
          strokeWidth={1.5}
        />
      );
    });
  };

  return (
    <View style={styles.container}>
      <View style={[styles.starsRow, interactive && styles.interactive]}>
        {renderStars()}
      </View>
      {showLabel && rating > 0 && (
        <Text style={styles.ratingLabel}>{rating.toFixed(1)}</Text>
      )}
      {showCount && count > 0 && (
        <Text style={styles.countText}>({count})</Text>
      )}
    </View>
  );
}

// Animated star for interactive mode
function AnimatedStar({
  star,
  filled,
  size,
  onPress,
}: {
  star: number;
  filled: boolean;
  size: number;
  onPress: () => void;
}) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePress = () => {
    scale.value = withSpring(1.2, { damping: 10 }, () => {
      scale.value = withSpring(1);
    });
    onPress();
  };

  return (
    <TouchableOpacity onPress={handlePress} style={styles.starButton}>
      <Animated.View style={animatedStyle}>
        <Star
          size={size}
          fill={filled ? '#FFD700' : 'transparent'}
          color={filled ? '#FFD700' : '#E5E7EB'}
          strokeWidth={1.5}
        />
      </Animated.View>
    </TouchableOpacity>
  );
}