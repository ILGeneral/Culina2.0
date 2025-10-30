import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  useWindowDimensions,
  TextInput,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X, ChevronLeft, ChevronRight, Check, Timer, Play, Pause, RotateCcw, Package, Plus, Trash2, StickyNote, Scale } from 'lucide-react-native';
import Animated, { FadeInDown, FadeOutUp, FadeIn, ZoomIn, BounceIn } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';

type IngredientEntry = string | { name: string; qty?: string; unit?: string };

type CustomTimer = {
  id: string;
  label: string;
  totalSeconds: number;
  remainingSeconds: number;
  isRunning: boolean;
  stepNumber: number;
};

type CookingModeProps = {
  instructions: string[];
  onClose: () => void;
  recipeTitle: string;
  ingredients?: IngredientEntry[];
  inventory?: Array<{ id?: string; name: string; quantity: number; unit: string }>;
  onDeductIngredients?: (ingredients: IngredientEntry[]) => Promise<void>;
};

// Parse time from instruction text (e.g., "10 minutes", "1 hour", "30 seconds")
function parseTimeFromText(text: string): number | null {
  const timePattern = /(\d+(?:\.\d+)?)\s*(minute|min|hour|hr|second|sec)s?/i;
  const match = text.match(timePattern);

  if (!match) return null;

  const value = parseFloat(match[1]);
  const unit = match[2].toLowerCase();

  // Convert everything to seconds
  if (unit.startsWith('hour') || unit === 'hr') {
    return Math.round(value * 3600);
  } else if (unit.startsWith('min')) {
    return Math.round(value * 60);
  } else if (unit.startsWith('sec')) {
    return Math.round(value);
  }

  return null;
}

// Format seconds into human-readable time (e.g., "5:30", "1:05:30")
function formatTime(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export default function CookingMode({
  instructions,
  onClose,
  recipeTitle,
  ingredients,
  inventory,
  onDeductIngredients
}: CookingModeProps) {
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;

  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());

  // Multiple timers state
  const [customTimers, setCustomTimers] = useState<CustomTimer[]>([]);
  const [showAddTimerModal, setShowAddTimerModal] = useState(false);
  const [newTimerMinutes, setNewTimerMinutes] = useState('');
  const [newTimerLabel, setNewTimerLabel] = useState('');

  // Legacy single timer state (for backward compatibility with auto-detected timers)
  const [timerSeconds, setTimerSeconds] = useState<number | null>(null);
  const [timerRemaining, setTimerRemaining] = useState<number | null>(null);
  const [timerRunning, setTimerRunning] = useState(false);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Step notes state
  const [stepNotes, setStepNotes] = useState<{ [stepIndex: number]: string }>({});
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [currentNoteText, setCurrentNoteText] = useState('');

  // Recipe scaling state
  const [servingMultiplier, setServingMultiplier] = useState(1);
  const [showScalingModal, setShowScalingModal] = useState(false);

  // Inventory deduction state
  const [isDeducting, setIsDeducting] = useState(false);
  const [hasDeducted, setHasDeducted] = useState(false);

  const progress = instructions.length > 0 ? (completedSteps.size / instructions.length) * 100 : 0;
  const isFullyComplete = progress === 100;

  // Clean up timer on unmount or when step changes
  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    };
  }, []);

  // Detect time in current instruction and reset timer
  useEffect(() => {
    const detectedTime = parseTimeFromText(instructions[currentStep]);
    setTimerSeconds(detectedTime);
    setTimerRemaining(detectedTime);
    setTimerRunning(false);

    // Stop any running timer
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
  }, [currentStep]);

  // Timer countdown logic
  useEffect(() => {
    if (timerRunning && timerRemaining !== null && timerRemaining > 0) {
      timerIntervalRef.current = setInterval(() => {
        setTimerRemaining((prev) => {
          if (prev === null || prev <= 1) {
            // Timer finished
            if (timerIntervalRef.current) {
              clearInterval(timerIntervalRef.current);
              timerIntervalRef.current = null;
            }
            setTimerRunning(false);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            Alert.alert('Timer Complete!', 'Your timer has finished.', [
              { text: 'OK', onPress: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light) }
            ]);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => {
        if (timerIntervalRef.current) {
          clearInterval(timerIntervalRef.current);
        }
      };
    } else {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    }
  }, [timerRunning, timerRemaining]);

  const handleStartTimer = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setTimerRunning(true);
  };

  const handlePauseTimer = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setTimerRunning(false);
  };

  const handleResetTimer = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setTimerRunning(false);
    setTimerRemaining(timerSeconds);
  };

  const handleNext = () => {
    if (currentStep < instructions.length - 1) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setCurrentStep(currentStep - 1);
    }
  };

  const handleToggleComplete = () => {
    const newCompleted = new Set(completedSteps);
    if (completedSteps.has(currentStep)) {
      newCompleted.delete(currentStep);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } else {
      newCompleted.add(currentStep);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      // Auto-advance to next step when marking as complete
      if (currentStep < instructions.length - 1) {
        setCurrentStep(currentStep + 1);
      }
    }
    setCompletedSteps(newCompleted);
  };

  const handleClose = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onClose();
  };

  // ========== MULTIPLE TIMERS MANAGEMENT ==========
  useEffect(() => {
    const interval = setInterval(() => {
      setCustomTimers((prevTimers) =>
        prevTimers.map((timer) => {
          if (!timer.isRunning || timer.remainingSeconds <= 0) return timer;

          const newRemaining = timer.remainingSeconds - 1;

          if (newRemaining === 0) {
            // Timer finished
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            Alert.alert('Timer Complete!', `${timer.label} has finished!`, [
              { text: 'OK', onPress: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light) }
            ]);
            return { ...timer, remainingSeconds: 0, isRunning: false };
          }

          return { ...timer, remainingSeconds: newRemaining };
        })
      );
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const handleAddCustomTimer = () => {
    const minutes = parseInt(newTimerMinutes);
    if (isNaN(minutes) || minutes <= 0) {
      Alert.alert('Invalid Time', 'Please enter a valid number of minutes.');
      return;
    }

    const newTimer: CustomTimer = {
      id: Date.now().toString(),
      label: newTimerLabel.trim() || `Timer ${customTimers.length + 1}`,
      totalSeconds: minutes * 60,
      remainingSeconds: minutes * 60,
      isRunning: false,
      stepNumber: currentStep + 1,
    };

    setCustomTimers([...customTimers, newTimer]);
    setNewTimerMinutes('');
    setNewTimerLabel('');
    setShowAddTimerModal(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleToggleTimer = (timerId: string) => {
    setCustomTimers((prevTimers) =>
      prevTimers.map((timer) =>
        timer.id === timerId ? { ...timer, isRunning: !timer.isRunning } : timer
      )
    );
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const handleResetCustomTimer = (timerId: string) => {
    setCustomTimers((prevTimers) =>
      prevTimers.map((timer) =>
        timer.id === timerId
          ? { ...timer, remainingSeconds: timer.totalSeconds, isRunning: false }
          : timer
      )
    );
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const handleDeleteTimer = (timerId: string) => {
    setCustomTimers((prevTimers) => prevTimers.filter((timer) => timer.id !== timerId));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  // ========== STEP NOTES MANAGEMENT ==========
  const handleOpenNotes = () => {
    setCurrentNoteText(stepNotes[currentStep] || '');
    setShowNotesModal(true);
  };

  const handleSaveNote = () => {
    setStepNotes({ ...stepNotes, [currentStep]: currentNoteText });
    setShowNotesModal(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  // ========== RECIPE SCALING MANAGEMENT ==========
  const scaleQuantity = (originalQty: string | undefined): string => {
    if (!originalQty) return '';
    const num = parseFloat(originalQty);
    if (isNaN(num)) return originalQty;
    const scaled = num * servingMultiplier;
    return scaled % 1 === 0 ? scaled.toString() : scaled.toFixed(1);
  };

  const handleScaleRecipe = (multiplier: number) => {
    setServingMultiplier(multiplier);
    setShowScalingModal(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleDeductIngredients = async () => {
    if (!onDeductIngredients || !ingredients || ingredients.length === 0) {
      Alert.alert('No Ingredients', 'No ingredients available to deduct.');
      return;
    }

    if (hasDeducted) {
      Alert.alert(
        'Already Deducted',
        'Ingredients have already been deducted. Would you like to deduct again?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Deduct Again',
            onPress: async () => {
              await performDeduction();
            },
          },
        ]
      );
      return;
    }

    await performDeduction();
  };

  const performDeduction = async () => {
    setIsDeducting(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      if (onDeductIngredients && ingredients) {
        await onDeductIngredients(ingredients);
        setHasDeducted(true);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (error) {
      console.error('Error deducting ingredients:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', 'Failed to deduct ingredients from pantry.');
    } finally {
      setIsDeducting(false);
    }
  };

  const isStepComplete = completedSteps.has(currentStep);
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === instructions.length - 1;

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={['#f0f9ff', '#e0f2fe', '#ffffff']}
        style={styles.gradient}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
            <X size={28} color="#0f172a" />
          </TouchableOpacity>
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>Cooking Mode</Text>
            <Text style={styles.recipeTitle} numberOfLines={1}>
              {recipeTitle}
            </Text>
          </View>
        </View>

        {/* Progress Bar */}
        <View style={styles.progressSection}>
          <View style={styles.progressHeader}>
            <Text style={styles.progressText}>{Math.round(progress)}% Complete</Text>
            <Text style={styles.stepCounter}>
              Step {currentStep + 1} of {instructions.length}
            </Text>
          </View>
          <View style={styles.progressBarContainer}>
            <Animated.View
              style={[styles.progressBar, { width: `${progress}%` }]}
              entering={FadeIn.duration(500)}
            />
          </View>
        </View>

        {/* Quick Action Buttons */}
        <View style={styles.quickActions}>
          <TouchableOpacity
            style={[styles.quickActionButton, styles.timerActionButton]}
            onPress={() => setShowAddTimerModal(true)}
          >
            <Plus size={18} color="#f97316" />
            <Text style={styles.quickActionText}>Timer</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.quickActionButton, styles.noteActionButton]}
            onPress={handleOpenNotes}
          >
            <StickyNote size={18} color="#10b981" />
            <Text style={styles.quickActionText}>
              {stepNotes[currentStep] ? 'Edit Note' : 'Add Note'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.quickActionButton, styles.scaleActionButton]}
            onPress={() => setShowScalingModal(true)}
          >
            <Scale size={18} color="#0284c7" />
            <Text style={styles.quickActionText}>
              {servingMultiplier === 1 ? 'Scale' : `${servingMultiplier}x`}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Active Custom Timers */}
        {customTimers.length > 0 && (
          <ScrollView
            horizontal
            style={styles.timersScrollView}
            contentContainerStyle={styles.timersContainer}
            showsHorizontalScrollIndicator={false}
          >
            {customTimers.map((timer) => (
              <Animated.View
                key={timer.id}
                entering={ZoomIn.duration(300)}
                style={[
                  styles.customTimerCard,
                  timer.remainingSeconds === 0 && styles.customTimerCardComplete,
                  timer.isRunning && styles.customTimerCardRunning,
                ]}
              >
                <View style={styles.customTimerHeader}>
                  <Text style={styles.customTimerLabel} numberOfLines={1}>
                    {timer.label}
                  </Text>
                  <TouchableOpacity onPress={() => handleDeleteTimer(timer.id)}>
                    <Trash2 size={16} color="#ef4444" />
                  </TouchableOpacity>
                </View>
                <Text style={styles.customTimerTime}>
                  {formatTime(timer.remainingSeconds)}
                </Text>
                <View style={styles.customTimerControls}>
                  <TouchableOpacity
                    style={styles.customTimerButton}
                    onPress={() => handleToggleTimer(timer.id)}
                  >
                    {timer.isRunning ? (
                      <Pause size={16} color="#fff" fill="#fff" />
                    ) : (
                      <Play size={16} color="#fff" fill="#fff" />
                    )}
                  </TouchableOpacity>
                  {!timer.isRunning && timer.remainingSeconds !== timer.totalSeconds && (
                    <TouchableOpacity
                      style={[styles.customTimerButton, styles.customTimerButtonSecondary]}
                      onPress={() => handleResetCustomTimer(timer.id)}
                    >
                      <RotateCcw size={14} color="#64748b" />
                    </TouchableOpacity>
                  )}
                </View>
              </Animated.View>
            ))}
          </ScrollView>
        )}

        {/* Main Content Area */}
        <View style={[styles.mainContent, isLandscape && styles.mainContentLandscape]}>
          {/* Current Step */}
          <ScrollView
            style={[styles.stepContainer, isLandscape && styles.stepContainerLandscape]}
            contentContainerStyle={[styles.stepContent, isLandscape && styles.stepContentLandscape]}
            showsVerticalScrollIndicator={false}
          >
          <Animated.View
            key={currentStep}
            entering={FadeInDown.duration(300).springify()}
            exiting={FadeOutUp.duration(200)}
          >
            <View style={styles.stepNumberBadge}>
              <Text style={styles.stepNumberText}>Step {currentStep + 1}</Text>
            </View>

            <Text style={[styles.instructionText, isLandscape && styles.instructionTextLandscape]}>
              {instructions[currentStep]}
            </Text>

            {/* Step Notes Display */}
            {stepNotes[currentStep] && (
              <Animated.View
                style={styles.stepNoteDisplay}
                entering={FadeIn.duration(400)}
              >
                <View style={styles.stepNoteHeader}>
                  <StickyNote size={16} color="#10b981" />
                  <Text style={styles.stepNoteTitle}>Your Note</Text>
                </View>
                <Text style={styles.stepNoteText}>{stepNotes[currentStep]}</Text>
              </Animated.View>
            )}

            <TouchableOpacity
              style={[
                styles.completeButton,
                isStepComplete && styles.completeButtonActive,
              ]}
              onPress={handleToggleComplete}
              activeOpacity={0.8}
            >
              <Check
                size={24}
                color={isStepComplete ? '#fff' : '#0284c7'}
                strokeWidth={3}
              />
              <Text
                style={[
                  styles.completeButtonText,
                  isStepComplete && styles.completeButtonTextActive,
                ]}
              >
                {isStepComplete ? 'Step Completed!' : 'Mark as Complete'}
              </Text>
            </TouchableOpacity>
          </Animated.View>

          {/* Built-in Timer (if instruction mentions time) */}
          {timerSeconds !== null && (
            <Animated.View
              style={styles.timerContainer}
              entering={FadeIn.delay(300).duration(500)}
            >
              <View style={styles.timerHeader}>
                <Timer size={20} color="#f97316" />
                <Text style={styles.timerHeaderText}>Timer Detected</Text>
              </View>

              <View style={styles.timerDisplay}>
                <Text style={styles.timerTime}>
                  {timerRemaining !== null ? formatTime(timerRemaining) : '--:--'}
                </Text>
                <Text style={styles.timerLabel}>
                  {timerRunning
                    ? 'Running...'
                    : timerRemaining === 0
                    ? 'Complete!'
                    : `Total: ${formatTime(timerSeconds)}`}
                </Text>
              </View>

              <View style={styles.timerControls}>
                {!timerRunning && timerRemaining !== 0 && (
                  <TouchableOpacity
                    style={styles.timerButtonPrimary}
                    onPress={handleStartTimer}
                    activeOpacity={0.8}
                  >
                    <Play size={20} color="#fff" fill="#fff" />
                    <Text style={styles.timerButtonPrimaryText}>Start</Text>
                  </TouchableOpacity>
                )}

                {timerRunning && (
                  <TouchableOpacity
                    style={styles.timerButtonPause}
                    onPress={handlePauseTimer}
                    activeOpacity={0.8}
                  >
                    <Pause size={20} color="#fff" fill="#fff" />
                    <Text style={styles.timerButtonPrimaryText}>Pause</Text>
                  </TouchableOpacity>
                )}

                {!timerRunning && timerRemaining !== timerSeconds && (
                  <TouchableOpacity
                    style={styles.timerButtonSecondary}
                    onPress={handleResetTimer}
                    activeOpacity={0.8}
                  >
                    <RotateCcw size={18} color="#f97316" />
                    <Text style={styles.timerButtonSecondaryText}>Reset</Text>
                  </TouchableOpacity>
                )}
              </View>
            </Animated.View>
          )}
          </ScrollView>

          {/* Navigation Controls - Move inside main content for landscape */}
          {isLandscape && (
            <View style={[styles.navigation, styles.navigationLandscape]}>
              <TouchableOpacity
                style={[styles.navButton, styles.prevButton, isFirstStep && styles.navButtonDisabled]}
                onPress={handlePrevious}
                disabled={isFirstStep}
                activeOpacity={0.8}
              >
                <ChevronLeft size={24} color={isFirstStep ? '#94a3b8' : '#0f172a'} />
                <Text style={[styles.navButtonText, isFirstStep && styles.navButtonTextDisabled]}>
                  Previous
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.navButton, styles.nextButton, isLastStep && styles.navButtonDisabled]}
                onPress={handleNext}
                disabled={isLastStep}
                activeOpacity={0.8}
              >
                <Text style={[styles.navButtonText, isLastStep && styles.navButtonTextDisabled]}>
                  Next
                </Text>
                <ChevronRight size={24} color={isLastStep ? '#94a3b8' : '#0f172a'} />
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Navigation Controls - Portrait Mode */}
        {!isLandscape && (
          <View style={styles.navigation}>
            <TouchableOpacity
              style={[styles.navButton, styles.prevButton, isFirstStep && styles.navButtonDisabled]}
              onPress={handlePrevious}
              disabled={isFirstStep}
              activeOpacity={0.8}
            >
              <ChevronLeft size={24} color={isFirstStep ? '#94a3b8' : '#0f172a'} />
              <Text style={[styles.navButtonText, isFirstStep && styles.navButtonTextDisabled]}>
                Previous
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.navButton, styles.nextButton, isLastStep && styles.navButtonDisabled]}
              onPress={handleNext}
              disabled={isLastStep}
              activeOpacity={0.8}
            >
              <Text style={[styles.navButtonText, isLastStep && styles.navButtonTextDisabled]}>
                Next
              </Text>
              <ChevronRight size={24} color={isLastStep ? '#94a3b8' : '#0f172a'} />
            </TouchableOpacity>
          </View>
        )}

        {/* Completion Message */}
        {completedSteps.size === instructions.length && (
          <Animated.View
            style={styles.completionBanner}
            entering={FadeInDown.duration(500).springify()}
          >
            <Text style={styles.completionText}>🎉 All steps completed!</Text>
          </Animated.View>
        )}

        {/* Deduct Ingredients Button - Show when 100% complete and on last step */}
        {isFullyComplete && isLastStep && onDeductIngredients && ingredients && (
          <Animated.View
            style={styles.deductButtonContainer}
            entering={FadeInDown.delay(300).duration(500).springify()}
          >
            <TouchableOpacity
              style={[
                styles.deductButton,
                hasDeducted && styles.deductButtonSuccess,
                isDeducting && styles.deductButtonDisabled,
              ]}
              onPress={handleDeductIngredients}
              disabled={isDeducting}
              activeOpacity={0.8}
            >
              {isDeducting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Package size={22} color="#fff" />
                  <Text style={styles.deductButtonText}>
                    {hasDeducted ? '✓ Ingredients Deducted' : 'Deduct from Pantry'}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* Add Timer Modal */}
        <Modal
          visible={showAddTimerModal}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowAddTimerModal(false)}
        >
          <View style={styles.modalOverlay}>
            <Animated.View
              entering={BounceIn.duration(400)}
              style={styles.modalContent}
            >
              <Text style={styles.modalTitle}>Add Custom Timer</Text>

              <TextInput
                style={styles.modalInput}
                placeholder="Timer label (optional)"
                placeholderTextColor="#94a3b8"
                value={newTimerLabel}
                onChangeText={setNewTimerLabel}
              />

              <TextInput
                style={styles.modalInput}
                placeholder="Minutes"
                placeholderTextColor="#94a3b8"
                keyboardType="numeric"
                value={newTimerMinutes}
                onChangeText={setNewTimerMinutes}
              />

              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalButtonCancel]}
                  onPress={() => setShowAddTimerModal(false)}
                >
                  <Text style={styles.modalButtonTextCancel}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalButtonConfirm]}
                  onPress={handleAddCustomTimer}
                >
                  <Text style={styles.modalButtonTextConfirm}>Add Timer</Text>
                </TouchableOpacity>
              </View>
            </Animated.View>
          </View>
        </Modal>

        {/* Notes Modal */}
        <Modal
          visible={showNotesModal}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowNotesModal(false)}
        >
          <View style={styles.modalOverlay}>
            <Animated.View
              entering={BounceIn.duration(400)}
              style={styles.modalContent}
            >
              <Text style={styles.modalTitle}>Step {currentStep + 1} Note</Text>

              <TextInput
                style={[styles.modalInput, styles.modalInputMultiline]}
                placeholder="Add your notes here..."
                placeholderTextColor="#94a3b8"
                value={currentNoteText}
                onChangeText={setCurrentNoteText}
                multiline
                numberOfLines={6}
                textAlignVertical="top"
              />

              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalButtonCancel]}
                  onPress={() => setShowNotesModal(false)}
                >
                  <Text style={styles.modalButtonTextCancel}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalButtonConfirm]}
                  onPress={handleSaveNote}
                >
                  <Text style={styles.modalButtonTextConfirm}>Save Note</Text>
                </TouchableOpacity>
              </View>
            </Animated.View>
          </View>
        </Modal>

        {/* Scaling Modal */}
        <Modal
          visible={showScalingModal}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowScalingModal(false)}
        >
          <View style={styles.modalOverlay}>
            <Animated.View
              entering={BounceIn.duration(400)}
              style={styles.modalContent}
            >
              <Text style={styles.modalTitle}>Scale Recipe</Text>
              <Text style={styles.modalSubtitle}>Adjust serving size</Text>

              <View style={styles.scaleOptions}>
                {[0.5, 1, 1.5, 2, 3].map((multiplier) => (
                  <TouchableOpacity
                    key={multiplier}
                    style={[
                      styles.scaleOption,
                      servingMultiplier === multiplier && styles.scaleOptionActive,
                    ]}
                    onPress={() => handleScaleRecipe(multiplier)}
                  >
                    <Text
                      style={[
                        styles.scaleOptionText,
                        servingMultiplier === multiplier && styles.scaleOptionTextActive,
                      ]}
                    >
                      {multiplier}x
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel, { width: '100%' }]}
                onPress={() => setShowScalingModal(false)}
              >
                <Text style={styles.modalButtonTextCancel}>Close</Text>
              </TouchableOpacity>
            </Animated.View>
          </View>
        </Modal>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f9ff',
  },
  gradient: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    backgroundColor: '#fff',
  },
  closeButton: {
    padding: 8,
    marginRight: 12,
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#64748b',
    marginBottom: 2,
  },
  recipeTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0f172a',
  },
  progressSection: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  progressText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0284c7',
  },
  stepCounter: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
  },
  progressBarContainer: {
    height: 8,
    backgroundColor: '#e0f2fe',
    borderRadius: 999,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#0284c7',
    borderRadius: 999,
  },
  mainContent: {
    flex: 1,
  },
  mainContentLandscape: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 16,
  },
  stepContainer: {
    flex: 1,
  },
  stepContainerLandscape: {
    flex: 2,
  },
  stepContent: {
    padding: 24,
    paddingBottom: 40,
  },
  stepContentLandscape: {
    padding: 16,
  },
  stepNumberBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#0ea5e9',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    marginBottom: 20,
  },
  stepNumberText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  instructionText: {
    fontSize: 24,
    lineHeight: 36,
    color: '#0f172a',
    fontWeight: '500',
    marginBottom: 32,
  },
  instructionTextLandscape: {
    fontSize: 20,
    lineHeight: 30,
    marginBottom: 24,
  },
  completeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e0f2fe',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#0284c7',
    gap: 10,
  },
  completeButtonActive: {
    backgroundColor: '#0284c7',
    borderColor: '#0284c7',
  },
  completeButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0284c7',
  },
  completeButtonTextActive: {
    color: '#fff',
  },
  timerContainer: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 16,
    marginTop: 24,
    borderWidth: 2,
    borderColor: '#fed7aa',
    shadowColor: '#f97316',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  timerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  timerHeaderText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ea580c',
  },
  timerDisplay: {
    alignItems: 'center',
    paddingVertical: 20,
    backgroundColor: '#fff7ed',
    borderRadius: 12,
    marginBottom: 16,
  },
  timerTime: {
    fontSize: 48,
    fontWeight: '700',
    color: '#0f172a',
    fontVariant: ['tabular-nums'],
  },
  timerLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#f97316',
    marginTop: 4,
  },
  timerControls: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'center',
  },
  timerButtonPrimary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10b981',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    gap: 8,
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  timerButtonPause: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f59e0b',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    gap: 8,
    shadowColor: '#f59e0b',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  timerButtonSecondary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    gap: 8,
    borderWidth: 2,
    borderColor: '#fed7aa',
  },
  timerButtonPrimaryText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  timerButtonSecondaryText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#f97316',
  },
  navigation: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 20,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    gap: 12,
  },
  navigationLandscape: {
    flex: 1,
    flexDirection: 'column',
    borderTopWidth: 0,
    borderLeftWidth: 1,
    borderLeftColor: '#e2e8f0',
    paddingHorizontal: 12,
    paddingVertical: 16,
    justifyContent: 'center',
  },
  navButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
    gap: 8,
  },
  prevButton: {},
  nextButton: {},
  navButtonDisabled: {
    opacity: 0.4,
  },
  navButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  navButtonTextDisabled: {
    color: '#94a3b8',
  },
  completionBanner: {
    position: 'absolute',
    bottom: 100,
    left: 20,
    right: 20,
    backgroundColor: '#10b981',
    padding: 20,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  completionText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  deductButtonContainer: {
    position: 'absolute',
    bottom: 180,
    left: 20,
    right: 20,
  },
  deductButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0284c7',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 16,
    gap: 10,
    shadowColor: '#0284c7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  deductButtonSuccess: {
    backgroundColor: '#10b981',
    shadowColor: '#10b981',
  },
  deductButtonDisabled: {
    opacity: 0.6,
  },
  deductButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#fff',
  },
  // Quick Actions Styles
  quickActions: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 10,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  quickActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    gap: 6,
    borderWidth: 2,
  },
  timerActionButton: {
    backgroundColor: '#fff7ed',
    borderColor: '#fed7aa',
  },
  noteActionButton: {
    backgroundColor: '#f0fdf4',
    borderColor: '#bbf7d0',
  },
  scaleActionButton: {
    backgroundColor: '#eff6ff',
    borderColor: '#bfdbfe',
  },
  quickActionText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  },
  // Custom Timers Styles
  timersScrollView: {
    maxHeight: 140,
    backgroundColor: '#f8fafc',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  timersContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  customTimerCard: {
    width: 140,
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  customTimerCardRunning: {
    borderColor: '#f97316',
    backgroundColor: '#fff7ed',
  },
  customTimerCardComplete: {
    borderColor: '#10b981',
    backgroundColor: '#f0fdf4',
  },
  customTimerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  customTimerLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
    flex: 1,
  },
  customTimerTime: {
    fontSize: 24,
    fontWeight: '700',
    color: '#0f172a',
    textAlign: 'center',
    marginBottom: 8,
    fontVariant: ['tabular-nums'],
  },
  customTimerControls: {
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
  },
  customTimerButton: {
    backgroundColor: '#0284c7',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  customTimerButtonSecondary: {
    backgroundColor: '#f1f5f9',
  },
  // Step Notes Styles
  stepNoteDisplay: {
    backgroundColor: '#f0fdf4',
    padding: 14,
    borderRadius: 12,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#10b981',
  },
  stepNoteHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  stepNoteTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#10b981',
  },
  stepNoteText: {
    fontSize: 15,
    lineHeight: 22,
    color: '#334155',
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 8,
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 15,
    color: '#64748b',
    marginBottom: 20,
    textAlign: 'center',
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#0f172a',
    backgroundColor: '#f8fafc',
    marginBottom: 16,
  },
  modalInputMultiline: {
    minHeight: 120,
    textAlignVertical: 'top',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalButtonCancel: {
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  modalButtonConfirm: {
    backgroundColor: '#0284c7',
  },
  modalButtonTextCancel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#64748b',
  },
  modalButtonTextConfirm: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  // Scaling Styles
  scaleOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
    justifyContent: 'center',
  },
  scaleOption: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
    minWidth: 70,
    alignItems: 'center',
  },
  scaleOptionActive: {
    borderColor: '#0284c7',
    backgroundColor: '#eff6ff',
  },
  scaleOptionText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#64748b',
  },
  scaleOptionTextActive: {
    color: '#0284c7',
  },
});
