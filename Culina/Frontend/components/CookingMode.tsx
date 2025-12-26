import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  useWindowDimensions,
  TextInput,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X, ChevronLeft, ChevronRight, Check, Timer, Play, Pause, RotateCcw, Package, Plus, Minus, Trash2, StickyNote, Mic, MicOff, Volume2, Bell, BellOff, Calculator, ArrowRightLeft, Edit3, PlayCircle } from 'lucide-react-native';
import Animated, { FadeInDown, FadeOutUp, FadeIn, ZoomIn, BounceIn } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import * as Speech from 'expo-speech';
import * as ScreenOrientation from 'expo-screen-orientation';
import { detectTechniques, type TechniqueGuide } from '@/lib/cookingTechniques';
import TechniqueGuideModal from './TechniqueGuideModal';
import { detectEquipment, groupEquipmentByCategory, type Equipment } from '@/lib/equipmentDetector';
import { styles } from '@/styles/components/cookingModeStyles';

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

// Detect if a step is critical based on keywords
function isCriticalStep(instruction: string): boolean {
  const criticalKeywords = [
    'don\'t', 'do not', 'must', 'important', 'critical', 'careful', 'watch',
    'constantly', 'continuously', 'immediately', 'quickly', 'careful not to',
    'make sure', 'ensure', 'be careful', 'attention', 'warning', 'caution',
    'stir frequently', 'stir constantly', 'keep stirring', 'never', 'avoid',
    'do not overcook', 'do not burn', 'watch closely', 'monitor'
  ];

  const lowerInstruction = instruction.toLowerCase();
  return criticalKeywords.some(keyword => lowerInstruction.includes(keyword));
}

// Get reminder type and message for a step
function getStepReminder(instruction: string): { type: 'warning' | 'info' | 'timer', message: string } | null {
  const lowerInstruction = instruction.toLowerCase();

  // Temperature warnings
  if (lowerInstruction.includes('preheat') || lowerInstruction.includes('heat oven')) {
    return { type: 'warning', message: 'Remember to preheat your oven before starting!' };
  }

  // Timing reminders
  if (lowerInstruction.includes('rest') || lowerInstruction.includes('cool')) {
    return { type: 'info', message: 'This step requires resting time. Use the timer!' };
  }

  // Continuous attention needed
  if (lowerInstruction.includes('stir frequently') || lowerInstruction.includes('stir constantly')) {
    return { type: 'warning', message: 'This step needs continuous attention. Stay nearby!' };
  }

  // Critical temperature steps
  if (lowerInstruction.includes('boil') || lowerInstruction.includes('simmer')) {
    return { type: 'warning', message: 'Watch the temperature carefully to avoid burning!' };
  }

  // Time-sensitive steps
  const hasTime = parseTimeFromText(instruction);
  if (hasTime && hasTime > 0) {
    return { type: 'timer', message: 'Timer detected! Start the timer to track this step.' };
  }

  return null;
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
  const [currentOrientation, setCurrentOrientation] = useState<ScreenOrientation.Orientation>();

  // Equipment state
  const [requiredEquipment, setRequiredEquipment] = useState<Equipment[]>([]);
  const [showEquipmentModal, setShowEquipmentModal] = useState(false);

  // Automatic Next Step mode state
  const [autoModeActive, setAutoModeActive] = useState(false);
  const [autoModeTimer, setAutoModeTimer] = useState(60);
  const [autoModePaused, setAutoModePaused] = useState(false);
  const autoModeIntervalRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reading preparation countdown state
  const [showReadingOverlay, setShowReadingOverlay] = useState(false);
  const [readingCountdown, setReadingCountdown] = useState(5);
  const readingIntervalRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Multiple timers state
  const [customTimers, setCustomTimers] = useState<CustomTimer[]>([]);
  const [showAddTimerModal, setShowAddTimerModal] = useState(false);
  const [newTimerMinutes, setNewTimerMinutes] = useState('');
  const [newTimerLabel, setNewTimerLabel] = useState('');

  // Legacy single timer state (for backward compatibility with auto-detected timers)
  const [timerSeconds, setTimerSeconds] = useState<number | null>(null);
  const [timerRemaining, setTimerRemaining] = useState<number | null>(null);
  const [timerRunning, setTimerRunning] = useState(false);
  const timerIntervalRef = useRef<number | null>(null);
  const [showEditTimerModal, setShowEditTimerModal] = useState(false);
  const [editTimerHours, setEditTimerHours] = useState('0');
  const [editTimerMinutes, setEditTimerMinutes] = useState('0');
  const [editTimerSeconds, setEditTimerSeconds] = useState('0');
  const hoursScrollRef = useRef<ScrollView>(null);
  const minutesScrollRef = useRef<ScrollView>(null);
  const secondsScrollRef = useRef<ScrollView>(null);

  // Step notes state
  const [stepNotes, setStepNotes] = useState<{ [stepIndex: number]: string }>({});
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [currentNoteText, setCurrentNoteText] = useState('');

  // Recipe scaling state
  const [servingMultiplier, setServingMultiplier] = useState(1);

  // Voice command state
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [voiceFeedbackEnabled, setVoiceFeedbackEnabled] = useState(true);
  const recognitionRef = useRef<any>(null);

  // Smart reminders state
  const [remindersEnabled, setRemindersEnabled] = useState(true);
  const [criticalSteps, setCriticalSteps] = useState<Set<number>>(new Set());
  const [shownReminders, setShownReminders] = useState<Set<number>>(new Set());

  // Measurement converter state
  const [showConverter, setShowConverter] = useState(false);
  const [converterInput, setConverterInput] = useState('');
  const [converterFromUnit, setConverterFromUnit] = useState('cup');
  const [converterToUnit, setConverterToUnit] = useState('ml');

  // Gamification state
  const [showAchievement, setShowAchievement] = useState(false);
  const [currentAchievement, setCurrentAchievement] = useState<{ title: string; message: string; icon: string } | null>(null);

  // Completion alert state
  const [showCompletionAlert, setShowCompletionAlert] = useState(false);

  // Inventory deduction state
  const [isDeducting, setIsDeducting] = useState(false);
  const [hasDeducted, setHasDeducted] = useState(false);

  // Technique guide state
  const [showTechniqueModal, setShowTechniqueModal] = useState(false);
  const [selectedTechnique, setSelectedTechnique] = useState<TechniqueGuide | null>(null);

  // Photo capture state
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [showPhotoPreview, setShowPhotoPreview] = useState(false);

  // Plating mode state
  const [showPlatingMode, setShowPlatingMode] = useState(false);

  const progress = instructions.length > 0 ? (completedSteps.size / instructions.length) * 100 : 0;
  const isFullyComplete = progress === 100;

  // ========== DETECT CRITICAL STEPS ON MOUNT ==========
  useEffect(() => {
    const critical = new Set<number>();
    instructions.forEach((instruction, index) => {
      if (isCriticalStep(instruction)) {
        critical.add(index);
      }
    });
    setCriticalSteps(critical);
  }, [instructions]);

  // ========== DETECT EQUIPMENT ON MOUNT ==========
  useEffect(() => {
    // Detect required equipment
    const equipment = detectEquipment(instructions, ingredients);
    setRequiredEquipment(equipment);
  }, [instructions, ingredients]);

  // ========== SHOW REMINDERS FOR CURRENT STEP ==========
  useEffect(() => {
    if (!remindersEnabled) return;
    if (shownReminders.has(currentStep)) return;

    const reminder = getStepReminder(instructions[currentStep]);
    if (reminder) {
      // Small delay to allow step transition animation
      const timeoutId = setTimeout(() => {
        Haptics.notificationAsync(
          reminder.type === 'warning'
            ? Haptics.NotificationFeedbackType.Warning
            : Haptics.NotificationFeedbackType.Success
        );

        const icon = reminder.type === 'warning' ? '⚠️' : reminder.type === 'timer' ? '⏱️' : 'ℹ️';
        Alert.alert(
          `${icon} Step ${currentStep + 1} Reminder`,
          reminder.message,
          [
            {
              text: 'Got it',
              onPress: () => {
                setShownReminders(prev => new Set(prev).add(currentStep));
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }
            }
          ]
        );
      }, 500);

      return () => clearTimeout(timeoutId);
    }
  }, [currentStep, remindersEnabled, shownReminders, instructions]);

  // ========== AUTO-FADE COMPLETION ALERT ==========
  useEffect(() => {
    // Skip completion alert in auto mode
    if (autoModeActive) return;

    if (isFullyComplete && !showCompletionAlert) {
      // Show the alert
      setShowCompletionAlert(true);

      // Auto-hide after 2 seconds
      const fadeTimeout = setTimeout(() => {
        setShowCompletionAlert(false);
      }, 2000);

      return () => clearTimeout(fadeTimeout);
    }
  }, [isFullyComplete, autoModeActive]);

  // ========== SCREEN ORIENTATION MANAGEMENT ==========
  useEffect(() => {
    // Force portrait mode on mount
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);

    // Get initial orientation
    ScreenOrientation.getOrientationAsync().then(orientation => {
      setCurrentOrientation(orientation);
    });

    // Listen for orientation changes
    const subscription = ScreenOrientation.addOrientationChangeListener(event => {
      setCurrentOrientation(event.orientationInfo.orientation);
    });

    return () => {
      ScreenOrientation.removeOrientationChangeListener(subscription);
      // Unlock orientation when leaving Cooking Mode
      ScreenOrientation.unlockAsync();
    };
  }, []);

  const handleRotateScreen = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      // Toggle between portrait and landscape
      if (isLandscape) {
        // Switch to portrait
        await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
        // Disable auto mode when returning to portrait
        setAutoModeActive(false);
      } else {
        // Switch to landscape and enable auto mode
        await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
        setAutoModeActive(true);
        setAutoModeTimer(60); // Reset timer
        setAutoModePaused(false);
      }
    } catch (error) {
      console.error('Error rotating screen:', error);
      Alert.alert('Rotation Error', 'Could not rotate screen. Please check your device rotation settings.');
    }
  };

  // ========== AUTOMATIC NEXT STEP MODE ==========
  useEffect(() => {
    // Enable auto mode when landscape is detected
    if (isLandscape && !autoModeActive) {
      setAutoModeActive(true);
      setAutoModeTimer(10);
      setAutoModePaused(false);
    } else if (!isLandscape && autoModeActive) {
      // Disable auto mode when returning to portrait
      setAutoModeActive(false);
    }
  }, [isLandscape]);

  // ========== READING PREPARATION COUNTDOWN ==========
  // Show reading overlay when step changes in auto mode
  useEffect(() => {
    if (autoModeActive && !autoModePaused) {
      setShowReadingOverlay(true);
      setReadingCountdown(5);
      setAutoModePaused(true); // Pause auto timer during reading
    }
  }, [currentStep, autoModeActive]);

  // Reading countdown logic
  useEffect(() => {
    if (!showReadingOverlay || readingCountdown <= 0) {
      return;
    }

    readingIntervalRef.current = setTimeout(() => {
      setReadingCountdown(prev => {
        if (prev <= 1) {
          // Countdown finished, hide overlay and start auto timer
          setShowReadingOverlay(false);
          setAutoModePaused(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (readingIntervalRef.current) {
        clearTimeout(readingIntervalRef.current);
      }
    };
  }, [showReadingOverlay, readingCountdown]);

  const handleSkipReading = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowReadingOverlay(false);
    setReadingCountdown(0);
    setAutoModePaused(false);
    // Clean up reading interval
    if (readingIntervalRef.current) {
      clearTimeout(readingIntervalRef.current);
      readingIntervalRef.current = null;
    }
  };

  // Auto-mode timer countdown
  useEffect(() => {
    // Pause auto-mode if there's a detected timer in the current step or reading overlay is shown
    if (!autoModeActive || autoModePaused || currentStep >= instructions.length - 1 || timerSeconds !== null || showReadingOverlay) {
      return;
    }

    if (autoModeTimer > 0) {
      autoModeIntervalRef.current = setTimeout(() => {
        setAutoModeTimer(prev => prev - 1);
      }, 1000);
    } else {
      // Timer reached 0, move to next step
      handleNext();
      setAutoModeTimer(60); // Reset for next step
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    return () => {
      if (autoModeIntervalRef.current) {
        clearTimeout(autoModeIntervalRef.current);
      }
    };
  }, [autoModeActive, autoModePaused, autoModeTimer, currentStep, instructions.length, timerSeconds, showReadingOverlay]);

  // Handle tap to pause/resume auto mode
  const handleAutoModeTap = () => {
    if (!autoModeActive) return;

    setAutoModePaused(!autoModePaused);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

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

            // If auto-cook mode is active, auto-advance to next step
            if (autoModeActive) {
              handleNext();
              setAutoModeTimer(60); // Reset timer for next step
            } else {
              Alert.alert('Timer Complete!', 'Your timer has finished.', [
                { text: 'OK', onPress: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light) }
              ]);
            }
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

  const handleOpenEditTimer = () => {
    if (timerSeconds !== null) {
      const hours = Math.floor(timerSeconds / 3600);
      const minutes = Math.floor((timerSeconds % 3600) / 60);
      const seconds = timerSeconds % 60;
      setEditTimerHours(hours.toString());
      setEditTimerMinutes(minutes.toString());
      setEditTimerSeconds(seconds.toString());
      setShowEditTimerModal(true);

      // Scroll to the correct positions after modal opens
      setTimeout(() => {
        hoursScrollRef.current?.scrollTo({ y: hours * 60, animated: false });
        minutesScrollRef.current?.scrollTo({ y: minutes * 60, animated: false });
        secondsScrollRef.current?.scrollTo({ y: seconds * 60, animated: false });
      }, 100);
    }
  };

  const handleSaveEditedTimer = () => {
    const hours = parseInt(editTimerHours) || 0;
    const minutes = parseInt(editTimerMinutes) || 0;
    const seconds = parseInt(editTimerSeconds) || 0;

    const totalSeconds = (hours * 3600) + (minutes * 60) + seconds;

    if (totalSeconds <= 0) {
      Alert.alert('Invalid Time', 'Please set a time greater than 0.');
      return;
    }

    setTimerSeconds(totalSeconds);
    setTimerRemaining(totalSeconds);
    setTimerRunning(false);
    setShowEditTimerModal(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleNext = () => {
    if (currentStep < instructions.length - 1) {
      // Mark current step as complete before moving to next
      const newCompleted = new Set(completedSteps);
      if (!completedSteps.has(currentStep)) {
        newCompleted.add(currentStep);
        setCompletedSteps(newCompleted);
        checkAchievements(newCompleted);
      }

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

      // Check for achievements
      checkAchievements(newCompleted);

      // Reset auto-mode timer when manually marking as complete
      if (autoModeActive) {
        setAutoModeTimer(60);
      }

      // Auto-advance to next step when marking as complete
      if (currentStep < instructions.length - 1) {
        setCurrentStep(currentStep + 1);
      }
    }
    setCompletedSteps(newCompleted);
  };

  // ========== GAMIFICATION SYSTEM ==========
  const checkAchievements = (completed: Set<number>) => {
    const completedCount = completed.size;
    const totalSteps = instructions.length;
    const progressPercent = (completedCount / totalSteps) * 100;

    // First step achievement
    if (completedCount === 1) {
      showAchievementNotification({
        title: 'First Step!',
        message: 'Great start! Keep the momentum going!',
        icon: ''
      });
    }
    // Halfway achievement
    else if (completedCount === Math.floor(totalSteps / 2) && completedCount > 1) {
      showAchievementNotification({
        title: 'Halfway There!',
        message: 'You\'re doing amazing! Keep it up!',
        icon: ''
      });
    }
    // Almost done achievement
    else if (progressPercent >= 75 && progressPercent < 100) {
      showAchievementNotification({
        title: 'Almost Done!',
        message: 'The finish line is in sight!',
        icon: ''
      });
    }
    // Perfect completion - Skip showing achievement banner, the completion banner will show instead
    else if (completedCount === totalSteps) {
      // Don't show achievement notification, let the static completion banner handle it
      return;
    }
    // Streak achievements (every 3 steps)
    else if (completedCount % 3 === 0 && completedCount > 0) {
      showAchievementNotification({
        title: `${completedCount} Steps!`,
        message: 'You\'re on fire! Keep cooking!',
        icon: ''
      });
    }
  };

  const showAchievementNotification = (achievement: { title: string; message: string; icon: string }) => {
    // Skip notifications in auto mode
    if (autoModeActive) return;

    setCurrentAchievement(achievement);
    setShowAchievement(true);

    // Auto-hide after 3 seconds
    setTimeout(() => {
      setShowAchievement(false);
    }, 3000);
  };

  // ========== AUTO MODE TIMER COLOR CODING ==========
  const getAutoModeTimerColors = () => {
    const maxTime = 60; // Auto mode timer starts at 60 seconds
    const timePercentage = (autoModeTimer / maxTime) * 100;

    if (timePercentage > 50) {
      // Blue: More than 50% time remaining
      return {
        backgroundColor: '#0ea5e9',
        borderColor: '#38bdf8',
        shadowColor: '#0ea5e9',
      };
    } else if (timePercentage > 25) {
      // Orange: 25-50% time remaining
      return {
        backgroundColor: '#f97316',
        borderColor: '#fb923c',
        shadowColor: '#f97316',
      };
    } else {
      // Red: Less than 25% time remaining
      return {
        backgroundColor: '#ef4444',
        borderColor: '#f87171',
        shadowColor: '#ef4444',
      };
    }
  };

  const handleClose = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // Always revert to portrait mode before closing
    if (isLandscape) {
      await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
    }

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

  // ========== VOICE COMMAND MANAGEMENT ==========
  const speakFeedback = async (text: string) => {
    if (!voiceFeedbackEnabled) return;
    try {
      await Speech.speak(text, {
        language: 'en-US',
        pitch: 1.0,
        rate: 0.9,
      });
    } catch (error) {
      console.error('Speech error:', error);
    }
  };

  const processVoiceCommand = (command: string) => {
    const lowerCommand = command.toLowerCase().trim();

    // Navigation commands
    if (lowerCommand.includes('next') || lowerCommand.includes('forward')) {
      if (currentStep < instructions.length - 1) {
        handleNext();
        speakFeedback(`Moving to step ${currentStep + 2}`);
      } else {
        speakFeedback('You are on the last step');
      }
      return true;
    }

    if (lowerCommand.includes('previous') || lowerCommand.includes('back') || lowerCommand.includes('go back')) {
      if (currentStep > 0) {
        handlePrevious();
        speakFeedback(`Moving to step ${currentStep}`);
      } else {
        speakFeedback('You are on the first step');
      }
      return true;
    }

    // Step completion commands
    if (lowerCommand.includes('complete') || lowerCommand.includes('done') || lowerCommand.includes('finished')) {
      handleToggleComplete();
      speakFeedback('Step marked as complete');
      return true;
    }

    // Timer commands
    if (lowerCommand.includes('start timer') || lowerCommand.includes('begin timer')) {
      if (timerSeconds !== null) {
        handleStartTimer();
        speakFeedback('Timer started');
      } else {
        speakFeedback('No timer detected for this step');
      }
      return true;
    }

    if (lowerCommand.includes('pause timer') || lowerCommand.includes('stop timer')) {
      handlePauseTimer();
      speakFeedback('Timer paused');
      return true;
    }

    if (lowerCommand.includes('reset timer')) {
      handleResetTimer();
      speakFeedback('Timer reset');
      return true;
    }

    // Read current step
    if (lowerCommand.includes('read') || lowerCommand.includes('repeat') || lowerCommand.includes('what')) {
      speakFeedback(`Step ${currentStep + 1}: ${instructions[currentStep]}`);
      return true;
    }

    // Jump to specific step
    const stepMatch = lowerCommand.match(/(?:go to|jump to|step)\s*(\d+)/);
    if (stepMatch) {
      const targetStep = parseInt(stepMatch[1]) - 1;
      if (targetStep >= 0 && targetStep < instructions.length) {
        setCurrentStep(targetStep);
        speakFeedback(`Moving to step ${targetStep + 1}`);
      } else {
        speakFeedback('Invalid step number');
      }
      return true;
    }

    // Help command
    if (lowerCommand.includes('help') || lowerCommand.includes('commands')) {
      speakFeedback('Say next, previous, complete, start timer, pause timer, reset timer, or read step');
      return true;
    }

    return false;
  };

  const startVoiceRecognition = async () => {
    try {
      setIsListening(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      speakFeedback('Listening');

      // Note: Web Speech API for voice recognition
      Alert.alert(
        'Voice Command',
        'Say a command:\n\n' +
        '• "Next" - Next step\n' +
        '• "Previous" - Previous step\n' +
        '• "Complete" - Mark step done\n' +
        '• "Start timer" - Start timer\n' +
        '• "Pause timer" - Pause timer\n' +
        '• "Read step" - Repeat current step\n' +
        '• "Help" - List commands',
        [
          { text: 'Cancel', style: 'cancel', onPress: () => setIsListening(false) },
          {
            text: 'Test: Next',
            onPress: () => {
              processVoiceCommand('next');
              setIsListening(false);
            }
          },
        ]
      );
    } catch (error) {
      console.error('Voice recognition error:', error);
      setIsListening(false);
      Alert.alert('Error', 'Voice recognition not available');
    }
  };

  const toggleVoice = () => {
    const newState = !voiceEnabled;
    setVoiceEnabled(newState);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    if (newState) {
      speakFeedback('Voice commands enabled. Say help for available commands.');
    } else {
      Speech.stop();
    }
  };

  const toggleVoiceFeedback = () => {
    setVoiceFeedbackEnabled(!voiceFeedbackEnabled);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  // Cleanup speech on unmount
  useEffect(() => {
    return () => {
      Speech.stop();
    };
  }, []);

  // ========== MEASUREMENT CONVERTER ==========
  const conversionTable: { [key: string]: number } = {
    // Volume conversions (all to ml)
    'ml': 1,
    'l': 1000,
    'cup': 236.588,
    'tbsp': 14.787,
    'tsp': 4.929,
    'fl oz': 29.574,
    'pint': 473.176,
    'quart': 946.353,
    'gallon': 3785.41,
    // Weight conversions (all to grams)
    'g': 1,
    'kg': 1000,
    'oz': 28.3495,
    'lb': 453.592,
    // Temperature (handled separately)
  };

  const convertMeasurement = (value: number, fromUnit: string, toUnit: string): number => {
    // Handle temperature separately
    if (fromUnit === '°F' && toUnit === '°C') {
      return (value - 32) * 5 / 9;
    }
    if (fromUnit === '°C' && toUnit === '°F') {
      return (value * 9 / 5) + 32;
    }

    // Check if units are compatible (both volume or both weight)
    const volumeUnits = ['ml', 'l', 'cup', 'tbsp', 'tsp', 'fl oz', 'pint', 'quart', 'gallon'];
    const weightUnits = ['g', 'kg', 'oz', 'lb'];

    const fromIsVolume = volumeUnits.includes(fromUnit);
    const toIsVolume = volumeUnits.includes(toUnit);
    const fromIsWeight = weightUnits.includes(fromUnit);
    const toIsWeight = weightUnits.includes(toUnit);

    if ((fromIsVolume && !toIsVolume) || (fromIsWeight && !toIsWeight)) {
      return 0; // Incompatible units
    }

    // Convert to base unit then to target unit
    const baseValue = value * conversionTable[fromUnit];
    return baseValue / conversionTable[toUnit];
  };

  const handleConvert = () => {
    const inputValue = parseFloat(converterInput);
    if (isNaN(inputValue)) {
      Alert.alert('Invalid Input', 'Please enter a valid number');
      return;
    }

    const result = convertMeasurement(inputValue, converterFromUnit, converterToUnit);
    if (result === 0 && inputValue !== 0) {
      Alert.alert('Conversion Error', 'These units cannot be converted to each other');
      return;
    }

    Alert.alert(
      'Conversion Result',
      `${inputValue} ${converterFromUnit} = ${result.toFixed(2)} ${converterToUnit}`,
      [{ text: 'OK', onPress: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light) }]
    );
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
          <TouchableOpacity style={styles.rotateButton} onPress={handleRotateScreen}>
            <PlayCircle size={24} color="#0f172a" />
          </TouchableOpacity>
        </View>

        {/* Progress Bar - Only show in portrait */}
        {!isLandscape && (
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
        )}

        {/* Voice Control Bar - Only show in portrait */}
        {!isLandscape && (
          <View style={styles.voiceControlBar}>
          <TouchableOpacity
            style={[styles.voiceButton, voiceEnabled && styles.voiceButtonActive]}
            onPress={toggleVoice}
          >
            {voiceEnabled ? (
              <Mic size={20} color="#fff" />
            ) : (
              <MicOff size={20} color="#64748b" />
            )}
            <Text style={[styles.voiceButtonText, voiceEnabled && styles.voiceButtonTextActive]}>
              {voiceEnabled ? 'Voice On' : 'Voice Off'}
            </Text>
          </TouchableOpacity>

          {voiceEnabled && (
            <>
              <TouchableOpacity
                style={[styles.voiceListenButton, isListening && styles.voiceListenButtonActive]}
                onPress={startVoiceRecognition}
                disabled={isListening}
              >
                <Mic size={24} color={isListening ? '#ef4444' : '#fff'} />
                <Text style={styles.voiceListenButtonText}>
                  {isListening ? 'Listening...' : 'Press to Speak'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.voiceFeedbackButton}
                onPress={toggleVoiceFeedback}
              >
                <Volume2 size={18} color={voiceFeedbackEnabled ? '#10b981' : '#94a3b8'} />
              </TouchableOpacity>
            </>
          )}
          </View>
        )}

        {/* Quick Action Buttons - Only show in portrait */}
        {!isLandscape && (
          <View style={styles.quickActions}>
          <View style={styles.quickActionWrapper}>
            <TouchableOpacity
              style={[styles.quickActionButton, styles.timerActionButton]}
              onPress={() => setShowAddTimerModal(true)}
            >
              <Plus size={22} color="#f97316" />
            </TouchableOpacity>
            <Text style={styles.quickActionLabel}>Timer</Text>
          </View>

          <View style={styles.quickActionWrapper}>
            <TouchableOpacity
              style={[styles.quickActionButton, styles.noteActionButton]}
              onPress={handleOpenNotes}
            >
              <StickyNote size={22} color="#10b981" />
            </TouchableOpacity>
            <Text style={styles.quickActionLabel}>Notes</Text>
          </View>

          <View style={styles.quickActionWrapper}>
            <TouchableOpacity
              style={[
                styles.quickActionButton,
                remindersEnabled ? styles.reminderActionButtonActive : styles.reminderActionButton
              ]}
              onPress={() => {
                setRemindersEnabled(!remindersEnabled);
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
            >
              {remindersEnabled ? (
                <Bell size={22} color="#8b5cf6" />
              ) : (
                <BellOff size={22} color="#94a3b8" />
              )}
            </TouchableOpacity>
            <Text style={styles.quickActionLabel}>Alerts</Text>
          </View>

          <View style={styles.quickActionWrapper}>
            <TouchableOpacity
              style={[styles.quickActionButton, styles.equipmentActionButton]}
              onPress={() => {
                setShowEquipmentModal(true);
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
            >
              <Package size={22} color="#f59e0b" />
            </TouchableOpacity>
            <Text style={styles.quickActionLabel}>Tools</Text>
          </View>
          </View>
        )}

        {/* Active Custom Timers - Only show in portrait */}
        {!isLandscape && customTimers.length > 0 && (
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
          {/* Left Column: Current Step Instructions */}
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
              {criticalSteps.has(currentStep) && (
                <View style={styles.criticalBadge}>
                  <Text style={styles.criticalBadgeText}>⚠️ Critical</Text>
                </View>
              )}
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
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Timer size={20} color="#f97316" />
                  <Text style={styles.timerHeaderText}>Timer Detected</Text>
                </View>
                <TouchableOpacity
                  onPress={handleOpenEditTimer}
                  style={{ padding: 4 }}
                >
                  <Edit3 size={18} color="#f97316" />
                </TouchableOpacity>
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

          {/* Automatic Mode Overlay - Tap to Pause/Resume */}
          {isLandscape && autoModeActive && !showReadingOverlay && (
            <TouchableOpacity
              style={styles.autoModeOverlay}
              onPress={handleAutoModeTap}
              activeOpacity={1}
            >
              <Animated.View
                entering={FadeIn.duration(300)}
              >
                {autoModePaused ? (
                  <View style={[styles.autoModeTimerCircle, getAutoModeTimerColors()]}>
                    <Pause size={24} color="#fff" fill="#fff" />
                  </View>
                ) : (
                  <View style={[styles.autoModeTimerCircle, getAutoModeTimerColors()]}>
                    <Text style={styles.autoModeTimerText}>{autoModeTimer}</Text>
                  </View>
                )}
              </Animated.View>
            </TouchableOpacity>
          )}

          {/* Reading Preparation Overlay - Tap anywhere to skip */}
          {isLandscape && autoModeActive && showReadingOverlay && (
            <TouchableOpacity
              style={styles.readingOverlay}
              onPress={handleSkipReading}
              activeOpacity={1}
            >
              <Animated.View
                style={styles.readingCountdownCircle}
                entering={FadeIn.duration(300)}
              >
                <Text style={styles.readingCountdownNumber}>{readingCountdown}</Text>
              </Animated.View>
            </TouchableOpacity>
          )}

          {/* Old Sidebar - Removed for Auto Mode */}
          {false && isLandscape && (
            <ScrollView
              style={styles.landscapeControlsSidebar}
              showsVerticalScrollIndicator={false}
            >
              {/* Progress Section */}
              <View style={styles.sidebarSection}>
                <Text style={styles.sidebarSectionTitle}>Progress</Text>
                <View style={styles.sidebarProgressInfo}>
                  <Text style={styles.sidebarProgressText}>{Math.round(progress)}%</Text>
                  <Text style={styles.sidebarStepText}>
                    Step {currentStep + 1}/{instructions.length}
                  </Text>
                </View>
                <View style={styles.progressBarContainer}>
                  <Animated.View
                    style={[styles.progressBar, { width: `${progress}%` }]}
                  />
                </View>
              </View>

              {/* Navigation Controls */}
              <View style={styles.sidebarSection}>
                <TouchableOpacity
                  style={[styles.sidebarNavButton, isFirstStep && styles.navButtonDisabled]}
                  onPress={handlePrevious}
                  disabled={isFirstStep}
                  activeOpacity={0.8}
                >
                  <ChevronLeft size={20} color={isFirstStep ? '#94a3b8' : '#0f172a'} />
                  <Text style={[styles.sidebarNavButtonText, isFirstStep && styles.navButtonTextDisabled]}>
                    Previous Step
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.sidebarNavButton, isLastStep && styles.navButtonDisabled]}
                  onPress={handleNext}
                  disabled={isLastStep}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.sidebarNavButtonText, isLastStep && styles.navButtonTextDisabled]}>
                    Next Step
                  </Text>
                  <ChevronRight size={20} color={isLastStep ? '#94a3b8' : '#0f172a'} />
                </TouchableOpacity>
              </View>

              {/* Quick Actions */}
              <View style={styles.sidebarSection}>
                <Text style={styles.sidebarSectionTitle}>Quick Actions</Text>
                <View style={styles.sidebarQuickActions}>
                  <TouchableOpacity
                    style={styles.sidebarActionButton}
                    onPress={() => setShowAddTimerModal(true)}
                  >
                    <Plus size={16} color="#f97316" />
                    <Text style={styles.sidebarActionText}>Timer</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.sidebarActionButton}
                    onPress={handleOpenNotes}
                  >
                    <StickyNote size={16} color="#10b981" />
                    <Text style={styles.sidebarActionText}>
                      {stepNotes[currentStep] ? 'Edit Note' : 'Note'}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.sidebarActionButton,
                      remindersEnabled && styles.sidebarActionButtonActive
                    ]}
                    onPress={() => {
                      setRemindersEnabled(!remindersEnabled);
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }}
                  >
                    {remindersEnabled ? (
                      <Bell size={16} color="#8b5cf6" />
                    ) : (
                      <BellOff size={16} color="#94a3b8" />
                    )}
                    <Text style={styles.sidebarActionText}>Alerts</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Voice Control */}
              <View style={styles.sidebarSection}>
                <Text style={styles.sidebarSectionTitle}>Voice Control</Text>
                <TouchableOpacity
                  style={[styles.sidebarVoiceToggle, voiceEnabled && styles.sidebarVoiceToggleActive]}
                  onPress={toggleVoice}
                >
                  {voiceEnabled ? (
                    <Mic size={18} color="#fff" />
                  ) : (
                    <MicOff size={18} color="#64748b" />
                  )}
                  <Text style={[styles.sidebarVoiceText, voiceEnabled && styles.sidebarVoiceTextActive]}>
                    {voiceEnabled ? 'Voice On' : 'Voice Off'}
                  </Text>
                </TouchableOpacity>

                {voiceEnabled && (
                  <View style={styles.sidebarVoiceControls}>
                    <TouchableOpacity
                      style={[styles.sidebarVoiceButton, isListening && styles.sidebarVoiceButtonActive]}
                      onPress={startVoiceRecognition}
                      disabled={isListening}
                    >
                      <Mic size={20} color={isListening ? '#ef4444' : '#fff'} />
                      <Text style={styles.sidebarVoiceButtonText}>
                        {isListening ? 'Listening...' : 'Speak'}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.sidebarVoiceFeedbackButton}
                      onPress={toggleVoiceFeedback}
                    >
                      <Volume2 size={16} color={voiceFeedbackEnabled ? '#10b981' : '#94a3b8'} />
                    </TouchableOpacity>
                  </View>
                )}
              </View>

              {/* Active Custom Timers */}
              {customTimers.length > 0 && (
                <View style={styles.sidebarSection}>
                  <Text style={styles.sidebarSectionTitle}>Active Timers</Text>
                  {customTimers.map((timer) => (
                    <Animated.View
                      key={timer.id}
                      entering={ZoomIn.duration(300)}
                      style={[
                        styles.sidebarTimerCard,
                        timer.remainingSeconds === 0 && styles.sidebarTimerCardComplete,
                        timer.isRunning && styles.sidebarTimerCardRunning,
                      ]}
                    >
                      <View style={styles.sidebarTimerHeader}>
                        <Text style={styles.sidebarTimerLabel} numberOfLines={1}>
                          {timer.label}
                        </Text>
                        <TouchableOpacity onPress={() => handleDeleteTimer(timer.id)}>
                          <Trash2 size={14} color="#ef4444" />
                        </TouchableOpacity>
                      </View>
                      <Text style={styles.sidebarTimerTime}>
                        {formatTime(timer.remainingSeconds)}
                      </Text>
                      <View style={styles.sidebarTimerControls}>
                        <TouchableOpacity
                          style={styles.sidebarTimerButton}
                          onPress={() => handleToggleTimer(timer.id)}
                        >
                          {timer.isRunning ? (
                            <Pause size={14} color="#fff" fill="#fff" />
                          ) : (
                            <Play size={14} color="#fff" fill="#fff" />
                          )}
                        </TouchableOpacity>
                        {!timer.isRunning && timer.remainingSeconds !== timer.totalSeconds && (
                          <TouchableOpacity
                            style={styles.sidebarTimerButton}
                            onPress={() => handleResetCustomTimer(timer.id)}
                          >
                            <RotateCcw size={12} color="#fff" />
                          </TouchableOpacity>
                        )}
                      </View>
                    </Animated.View>
                  ))}
                </View>
              )}
            </ScrollView>
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
        {showCompletionAlert && (
          <Animated.View
            style={styles.completionBanner}
            entering={FadeInDown.duration(300)}
            exiting={FadeOutUp.duration(300)}
          >
            <Text style={styles.completionText}>All steps completed!</Text>
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
                <Text style={styles.deductButtonText}>
                  {hasDeducted ? 'Ingredients Deducted' : 'Deduct from Pantry'}
                </Text>
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

        {/* Edit Detected Timer Modal */}
        <Modal
          visible={showEditTimerModal}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowEditTimerModal(false)}
        >
          <View style={styles.modalOverlay}>
            <Animated.View
              entering={BounceIn.duration(400)}
              style={styles.timerEditModalContent}
            >
              {/* Header */}
              <Text style={styles.timerEditTitle}>Adjust Timer</Text>

              {/* Labels Row */}
              <View style={styles.pickerLabelsRow}>
                <Text style={styles.pickerLabelText}>Hours</Text>
                <Text style={styles.pickerLabelText}>Minutes</Text>
                <Text style={styles.pickerLabelText}>Seconds</Text>
              </View>

              {/* Three-Column Picker */}
              <View style={styles.pickerContainer}>
                {/* Hours Column */}
                <View style={styles.pickerColumn}>
                  <ScrollView
                    ref={hoursScrollRef}
                    style={styles.pickerScroll}
                    contentContainerStyle={styles.pickerScrollContent}
                    showsVerticalScrollIndicator={false}
                    snapToInterval={60}
                    decelerationRate="fast"
                    onScroll={(event) => {
                      const yOffset = event.nativeEvent.contentOffset.y;
                      const index = Math.round(yOffset / 60);
                      setEditTimerHours(index.toString());
                    }}
                    scrollEventThrottle={16}
                    onMomentumScrollEnd={(event) => {
                      const yOffset = event.nativeEvent.contentOffset.y;
                      const index = Math.round(yOffset / 60);
                      setEditTimerHours(index.toString());
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }}
                  >
                    {Array.from({ length: 100 }, (_, i) => (
                      <View key={i} style={styles.pickerItem}>
                        <Text
                          style={[
                            styles.pickerItemText,
                            editTimerHours === i.toString() && styles.pickerItemTextSelected
                          ]}
                        >
                          {i.toString().padStart(2, '0')}
                        </Text>
                      </View>
                    ))}
                  </ScrollView>
                </View>

                {/* Colon Separator */}
                <Text style={styles.colonSeparator}>:</Text>

                {/* Minutes Column */}
                <View style={styles.pickerColumn}>
                  <ScrollView
                    ref={minutesScrollRef}
                    style={styles.pickerScroll}
                    contentContainerStyle={styles.pickerScrollContent}
                    showsVerticalScrollIndicator={false}
                    snapToInterval={60}
                    decelerationRate="fast"
                    onScroll={(event) => {
                      const yOffset = event.nativeEvent.contentOffset.y;
                      const index = Math.round(yOffset / 60);
                      setEditTimerMinutes(index.toString());
                    }}
                    scrollEventThrottle={16}
                    onMomentumScrollEnd={(event) => {
                      const yOffset = event.nativeEvent.contentOffset.y;
                      const index = Math.round(yOffset / 60);
                      setEditTimerMinutes(index.toString());
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }}
                  >
                    {Array.from({ length: 60 }, (_, i) => (
                      <View key={i} style={styles.pickerItem}>
                        <Text
                          style={[
                            styles.pickerItemText,
                            editTimerMinutes === i.toString() && styles.pickerItemTextSelected
                          ]}
                        >
                          {i.toString().padStart(2, '0')}
                        </Text>
                      </View>
                    ))}
                  </ScrollView>
                </View>

                {/* Colon Separator */}
                <Text style={styles.colonSeparator}>:</Text>

                {/* Seconds Column */}
                <View style={styles.pickerColumn}>
                  <ScrollView
                    ref={secondsScrollRef}
                    style={styles.pickerScroll}
                    contentContainerStyle={styles.pickerScrollContent}
                    showsVerticalScrollIndicator={false}
                    snapToInterval={60}
                    decelerationRate="fast"
                    onScroll={(event) => {
                      const yOffset = event.nativeEvent.contentOffset.y;
                      const index = Math.round(yOffset / 60);
                      setEditTimerSeconds(index.toString());
                    }}
                    scrollEventThrottle={16}
                    onMomentumScrollEnd={(event) => {
                      const yOffset = event.nativeEvent.contentOffset.y;
                      const index = Math.round(yOffset / 60);
                      setEditTimerSeconds(index.toString());
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }}
                  >
                    {Array.from({ length: 60 }, (_, i) => (
                      <View key={i} style={styles.pickerItem}>
                        <Text
                          style={[
                            styles.pickerItemText,
                            editTimerSeconds === i.toString() && styles.pickerItemTextSelected
                          ]}
                        >
                          {i.toString().padStart(2, '0')}
                        </Text>
                      </View>
                    ))}
                  </ScrollView>
                </View>

                {/* Top Border Line */}
                <View style={styles.pickerBorderTop} />
                {/* Bottom Border Line */}
                <View style={styles.pickerBorderBottom} />
              </View>

              {/* Action Buttons */}
              <View style={styles.timerEditButtons}>
                <TouchableOpacity
                  style={styles.timerEditButtonStop}
                  onPress={() => setShowEditTimerModal(false)}
                >
                  <Text style={styles.timerEditButtonStopText}>Stop</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.timerEditButtonStart}
                  onPress={handleSaveEditedTimer}
                >
                  <Text style={styles.timerEditButtonStartText}>Start</Text>
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

        {/* Measurement Converter Modal */}
        <Modal
          visible={showConverter}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowConverter(false)}
        >
          <View style={styles.modalOverlay}>
            <Animated.View
              entering={BounceIn.duration(400)}
              style={styles.modalContent}
            >
              <Text style={styles.modalTitle}>Measurement Converter</Text>
              <Text style={styles.modalSubtitle}>Convert between units</Text>

              <TextInput
                style={styles.modalInput}
                placeholder="Enter value"
                placeholderTextColor="#94a3b8"
                keyboardType="numeric"
                value={converterInput}
                onChangeText={setConverterInput}
              />

              <View style={styles.converterRow}>
                <View style={styles.converterUnitContainer}>
                  <Text style={styles.converterLabel}>From:</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.unitScroll}>
                    {['cup', 'ml', 'l', 'tbsp', 'tsp', 'fl oz', 'g', 'kg', 'oz', 'lb', '°F', '°C'].map((unit) => (
                      <TouchableOpacity
                        key={unit}
                        style={[
                          styles.unitButton,
                          converterFromUnit === unit && styles.unitButtonActive
                        ]}
                        onPress={() => setConverterFromUnit(unit)}
                      >
                        <Text style={[
                          styles.unitButtonText,
                          converterFromUnit === unit && styles.unitButtonTextActive
                        ]}>
                          {unit}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              </View>

              <View style={styles.converterArrow}>
                <ArrowRightLeft size={24} color="#64748b" />
              </View>

              <View style={styles.converterRow}>
                <View style={styles.converterUnitContainer}>
                  <Text style={styles.converterLabel}>To:</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.unitScroll}>
                    {['cup', 'ml', 'l', 'tbsp', 'tsp', 'fl oz', 'g', 'kg', 'oz', 'lb', '°F', '°C'].map((unit) => (
                      <TouchableOpacity
                        key={unit}
                        style={[
                          styles.unitButton,
                          converterToUnit === unit && styles.unitButtonActive
                        ]}
                        onPress={() => setConverterToUnit(unit)}
                      >
                        <Text style={[
                          styles.unitButtonText,
                          converterToUnit === unit && styles.unitButtonTextActive
                        ]}>
                          {unit}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              </View>

              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalButtonCancel]}
                  onPress={() => setShowConverter(false)}
                >
                  <Text style={styles.modalButtonTextCancel}>Close</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalButtonConfirm]}
                  onPress={handleConvert}
                >
                  <Text style={styles.modalButtonTextConfirm}>Convert</Text>
                </TouchableOpacity>
              </View>
            </Animated.View>
          </View>
        </Modal>

        {/* Floating Converter Button */}
        <TouchableOpacity
          style={styles.floatingConverterButton}
          onPress={() => {
            setShowConverter(true);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          }}
        >
          <Calculator size={24} color="#fff" />
        </TouchableOpacity>

        {/* Achievement Notification */}
        {showAchievement && currentAchievement && (
          <Animated.View
            style={styles.achievementBanner}
            entering={ZoomIn.duration(400).springify()}
            exiting={FadeOutUp.duration(300)}
          >
            <Text style={styles.achievementIcon}>{currentAchievement.icon}</Text>
            <View style={styles.achievementTextContainer}>
              <Text style={styles.achievementTitle}>{currentAchievement.title}</Text>
              <Text style={styles.achievementMessage}>{currentAchievement.message}</Text>
            </View>
          </Animated.View>
        )}

        {/* Equipment List Modal */}
        <Modal
          visible={showEquipmentModal}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowEquipmentModal(false)}
        >
          <View style={styles.modalOverlay}>
            <Animated.View
              entering={BounceIn.duration(400)}
              style={[styles.modalContent, { maxHeight: '80%' }]}
            >
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Required Equipment</Text>
                <TouchableOpacity onPress={() => setShowEquipmentModal(false)}>
                  <X size={24} color="#64748b" />
                </TouchableOpacity>
              </View>

              <Text style={styles.modalSubtitle}>
                {requiredEquipment.length} items detected from recipe
              </Text>

              <ScrollView style={styles.equipmentList} showsVerticalScrollIndicator={false}>
                {groupEquipmentByCategory(requiredEquipment).cookware.length > 0 && (
                  <>
                    <Text style={styles.equipmentCategoryTitle}>🍳 Cookware</Text>
                    {groupEquipmentByCategory(requiredEquipment).cookware.map((item, index) => (
                      <View key={index} style={styles.equipmentItem}>
                        <Text style={styles.equipmentIcon}>{item.icon}</Text>
                        <Text style={styles.equipmentName}>{item.name}</Text>
                        {item.isEssential && (
                          <View style={styles.essentialBadge}>
                            <Text style={styles.essentialText}>Essential</Text>
                          </View>
                        )}
                      </View>
                    ))}
                  </>
                )}

                {groupEquipmentByCategory(requiredEquipment).utensil.length > 0 && (
                  <>
                    <Text style={styles.equipmentCategoryTitle}>🔪 Utensils</Text>
                    {groupEquipmentByCategory(requiredEquipment).utensil.map((item, index) => (
                      <View key={index} style={styles.equipmentItem}>
                        <Text style={styles.equipmentIcon}>{item.icon}</Text>
                        <Text style={styles.equipmentName}>{item.name}</Text>
                        {item.isEssential && (
                          <View style={styles.essentialBadge}>
                            <Text style={styles.essentialText}>Essential</Text>
                          </View>
                        )}
                      </View>
                    ))}
                  </>
                )}

                {groupEquipmentByCategory(requiredEquipment).appliance.length > 0 && (
                  <>
                    <Text style={styles.equipmentCategoryTitle}>⚡ Appliances</Text>
                    {groupEquipmentByCategory(requiredEquipment).appliance.map((item, index) => (
                      <View key={index} style={styles.equipmentItem}>
                        <Text style={styles.equipmentIcon}>{item.icon}</Text>
                        <Text style={styles.equipmentName}>{item.name}</Text>
                        {item.isEssential && (
                          <View style={styles.essentialBadge}>
                            <Text style={styles.essentialText}>Essential</Text>
                          </View>
                        )}
                      </View>
                    ))}
                  </>
                )}

                {groupEquipmentByCategory(requiredEquipment).tool.length > 0 && (
                  <>
                    <Text style={styles.equipmentCategoryTitle}>🛠️ Tools</Text>
                    {groupEquipmentByCategory(requiredEquipment).tool.map((item, index) => (
                      <View key={index} style={styles.equipmentItem}>
                        <Text style={styles.equipmentIcon}>{item.icon}</Text>
                        <Text style={styles.equipmentName}>{item.name}</Text>
                      </View>
                    ))}
                  </>
                )}
              </ScrollView>

              <TouchableOpacity
                style={styles.modalPrimaryButton}
                onPress={() => setShowEquipmentModal(false)}
              >
                <Text style={styles.modalPrimaryButtonText}>Got It!</Text>
              </TouchableOpacity>
            </Animated.View>
          </View>
        </Modal>

      </LinearGradient>
    </SafeAreaView>
  );
}
