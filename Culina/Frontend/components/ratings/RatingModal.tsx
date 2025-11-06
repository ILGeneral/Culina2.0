import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
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

interface RatingModalProps {
  visible: boolean;
  onClose: () => void;
  sharedRecipeId: string;
  recipeName: string;
  existingRating?: number;
  existingReview?: string;
  existingVerified?: boolean;
}

export function RatingModal({
  visible,
  onClose,
  sharedRecipeId,
  recipeName,
  existingRating = 0,
  existingReview = '',
  existingVerified = false,
}: RatingModalProps) {
  const [rating, setRating] = useState(existingRating);
  const [review, setReview] = useState(existingReview);
  const [verified, setVerified] = useState(existingVerified);
  const [submitting, setSubmitting] = useState(false);

  // Reset state when modal opens with new data
  useEffect(() => {
    if (visible) {
      setRating(existingRating);
      setReview(existingReview);
      setVerified(existingVerified);
    }
  }, [visible, existingRating, existingReview, existingVerified]);

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
      review.trim() || undefined,
      verified
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

              {/* Verified Checkbox */}
              <TouchableOpacity
                style={styles.verifiedCheckbox}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setVerified(!verified);
                }}
                disabled={submitting}
              >
                <View style={[styles.checkbox, verified && styles.checkboxChecked]}>
                  {verified && <Text style={styles.checkmark}>✓</Text>}
                </View>
                <Text style={styles.checkboxLabel}>
                  I actually cooked this recipe
                </Text>
              </TouchableOpacity>
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

const styles = StyleSheet.create({
  keyboardAvoid: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0f172a',
  },
  closeButton: {
    padding: 4,
  },
  scrollContent: {
    padding: 24,
  },
  recipeName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 24,
    textAlign: 'center',
  },
  ratingSection: {
    alignItems: 'center',
    marginBottom: 28,
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0f172a',
    marginBottom: 16,
  },
  optional: {
    fontSize: 13,
    fontWeight: '400',
    color: '#94a3af',
  },
  starsContainer: {
    paddingVertical: 8,
  },
  ratingText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0ea5e9',
    marginTop: 12,
  },
  reviewSection: {
    marginBottom: 24,
  },
  reviewInput: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    color: '#0f172a',
    minHeight: 100,
    textAlignVertical: 'top',
    backgroundColor: '#f8fafc',
  },
  characterCount: {
    fontSize: 12,
    color: '#94a3af',
    textAlign: 'right',
    marginTop: 6,
  },
  verifiedCheckbox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderColor: '#cbd5e1',
    borderRadius: 6,
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#0ea5e9',
    borderColor: '#0ea5e9',
  },
  checkmark: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  checkboxLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    color: '#475569',
  },
  buttons: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 24,
    paddingBottom: 24,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#64748b',
  },
  submitButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#0ea5e9',
    alignItems: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});
