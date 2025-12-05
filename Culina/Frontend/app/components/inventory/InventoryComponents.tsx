import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withSequence,
  interpolate,
  Extrapolate,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { skeletonStyles, toastStyles, sectionHeaderStyles } from '@/styles/inventory/inventoryComponentStyles';

// ========== SKELETON LOADER ==========
export const SkeletonCard = () => {
  const shimmer = useSharedValue(0);

  useEffect(() => {
    shimmer.value = withSequence(
      withTiming(1, { duration: 1000 }),
      withTiming(0, { duration: 1000 })
    );
    const interval = setInterval(() => {
      shimmer.value = withSequence(
        withTiming(1, { duration: 1000 }),
        withTiming(0, { duration: 1000 })
      );
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(shimmer.value, [0, 1], [0.3, 0.7]),
  }));

  return (
    <View style={skeletonStyles.card}>
      <Animated.View style={[skeletonStyles.image, animatedStyle]} />
      <View style={skeletonStyles.content}>
        <Animated.View style={[skeletonStyles.titleBar, animatedStyle]} />
        <Animated.View style={[skeletonStyles.subtitleBar, animatedStyle]} />
        <Animated.View style={[skeletonStyles.smallBar, animatedStyle]} />
      </View>
    </View>
  );
};

// ========== TOAST NOTIFICATION ==========
interface ToastProps {
  visible: boolean;
  message: string;
  type: 'success' | 'error' | 'info';
  onHide: () => void;
}

export const Toast: React.FC<ToastProps> = ({ visible, message, type, onHide }) => {
  const translateY = useSharedValue(-100);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      translateY.value = withSpring(0, { damping: 15 });
      opacity.value = withTiming(1, { duration: 200 });

      const timeout = setTimeout(() => {
        translateY.value = withTiming(-100, { duration: 300 });
        opacity.value = withTiming(0, { duration: 300 });
        setTimeout(onHide, 300);
      }, 3000);

      return () => clearTimeout(timeout);
    }
  }, [visible]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  const getIconAndColor = () => {
    switch (type) {
      case 'success':
        return { icon: 'checkmark-circle', color: '#10b981' };
      case 'error':
        return { icon: 'alert-circle', color: '#ef4444' };
      case 'info':
        return { icon: 'information-circle', color: '#128AFA' };
    }
  };

  const { icon, color } = getIconAndColor();

  if (!visible) return null;

  return (
    <Animated.View style={[toastStyles.container, animatedStyle]}>
      <Ionicons name={icon as any} size={22} color={color} />
      <Text style={toastStyles.message}>{message}</Text>
    </Animated.View>
  );
};

// ========== SECTION HEADER ==========
interface SectionHeaderProps {
  title: string;
  count: number;
}

export const SectionHeader: React.FC<SectionHeaderProps> = ({ title, count }) => {
  return (
    <View style={sectionHeaderStyles.container}>
      <Text style={sectionHeaderStyles.title}>{title}</Text>
      <View style={sectionHeaderStyles.badge}>
        <Text style={sectionHeaderStyles.count}>{count}</Text>
      </View>
    </View>
  );
};

// ========== PRESSABLE CARD WRAPPER ==========
interface PressableCardProps {
  onPress: () => void;
  onLongPress?: () => void;
  delayLongPress?: number;
  children: React.ReactNode;
}

export const PressableCard: React.FC<PressableCardProps> = ({ onPress, onLongPress, delayLongPress, children }) => {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.97, { damping: 10 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 10 });
  };

  return (
    <Animated.View style={animatedStyle}>
      <TouchableOpacity
        activeOpacity={0.9}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={onPress}
        onLongPress={onLongPress}
        delayLongPress={delayLongPress}
      >
        {children}
      </TouchableOpacity>
    </Animated.View>
  );
};

// Default export to satisfy routing requirements
export default {
  SkeletonCard,
  Toast,
  SectionHeader,
  PressableCard,
};
