import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import Animated, { FadeIn, SlideInDown } from 'react-native-reanimated';
import { StarRating } from './StarRating';
import { submitRating } from '../../lib/utils/rateRecipe';
import * as Haptics from 'expo-haptics';
import { X } from 'lucide-react-native';
import { styles } from '@/styles/components/ratings/ratingModalStyles';

interface RatingModalProps {
  visible: boolean;
  onClose: () => void;
  sharedRecipeId: string;
  recipeName: string;
  existingRating?: number;
  existingReview?: string;
}

export function RatingModal({
  visible,
  onClose,
  sharedRecipeId,
  recipeName,
  existingRating = 0,
  existingReview = '',
}: RatingModalProps) {
  const [rating, setRating] = useState(existingRating);
  const [review, setReview] = useState(existingReview);
  const [submitting, setSubmitting] = useState(false);

  // Reset state when modal opens with new data
  useEffect(() => {
    if (visible) {
      setRating(existingRating);
      setReview(existingReview);
    }
  }, [visible, existingRating, existingReview]);

  const handleSubmit = async () => {
    if (rating === 0) {
      Alert.alert('Please select a rating', 'Tap the stars to rate this recipe');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }

    setSubmitting(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const result = await submitRating(
      sharedRecipeId,
      rating,
      review.trim() || undefined
    );

    setSubmitting(false);

    if (result.success) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        'Success!',
        existingRating > 0
          ? 'Your rating has been updated!'
          : 'Thank you for rating this recipe!'
      );
      onClose();
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', result.error || 'Failed to submit rating. Please try again.');
    }
  };

  const handleClose = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoid}
      >
        <View style={styles.overlay}>
          <Animated.View
            entering={SlideInDown.duration(300).springify()}
            style={styles.modalContent}
          >
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.title}>
                {existingRating > 0 ? 'Update Rating' : 'Rate This Recipe'}
              </Text>
              <TouchableOpacity
                onPress={handleClose}
                style={styles.closeButton}
                disabled={submitting}
              >
                <X size={24} color="#64748b" />
              </TouchableOpacity>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.scrollContent}
            >
              {/* Recipe Name */}
              <Text style={styles.recipeName} numberOfLines={2}>
                {recipeName}
              </Text>

              {/* Star Rating */}
              <View style={styles.ratingSection}>
                <Text style={styles.label}>How would you rate this recipe?</Text>
                <View style={styles.starsContainer}>
                  <StarRating
                    rating={rating}
                    onRatingChange={setRating}
                    size={44}
                    interactive
                  />
                </View>
                {rating > 0 && (
                  <Animated.Text
                    entering={FadeIn.duration(200)}
                    style={styles.ratingText}
                  >
                    {getRatingText(rating)}
                  </Animated.Text>
                )}
              </View>

              {/* Review Input */}
              <View style={styles.reviewSection}>
                <Text style={styles.label}>
                  Share your experience <Text style={styles.optional}>(optional)</Text>
                </Text>
                <TextInput
                  style={styles.reviewInput}
                  placeholder="What did you think of this recipe? Any tips or modifications?"
                  placeholderTextColor="#9ca3af"
                  multiline
                  numberOfLines={4}
                  value={review}
                  onChangeText={setReview}
                  maxLength={500}
                  editable={!submitting}
                />
                <Text style={styles.characterCount}>{review.length}/500</Text>
              </View>
            </ScrollView>

            {/* Action Buttons */}
            <View style={styles.buttons}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={handleClose}
                disabled={submitting}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.submitButton,
                  (submitting || rating === 0) && styles.submitButtonDisabled,
                ]}
                onPress={handleSubmit}
                disabled={submitting || rating === 0}
              >
                <Text style={styles.submitButtonText}>
                  {submitting ? 'Submitting...' : existingRating > 0 ? 'Update' : 'Submit'}
                </Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function getRatingText(rating: number): string {
  switch (rating) {
    case 1:
      return 'Poor';
    case 2:
      return 'Fair';
    case 3:
      return 'Good';
    case 4:
      return 'Very Good';
    case 5:
      return 'Excellent';
    default:
      return '';
  }
}