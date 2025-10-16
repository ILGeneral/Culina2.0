import React, { useCallback, useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  ActivityIndicator,
} from "react-native";

import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import {
  LogOut,
  AlertTriangle,
  Edit3,
  ChevronRight,
  Heart,
  Flame,
  WheatOff,
} from "lucide-react-native";
import { auth, db } from "@/lib/firebaseConfig";
import { signOut, onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { useRouter, useFocusEffect, useLocalSearchParams } from "expo-router";
import Animated, {
  FadeInUp,
  useSharedValue,
  useAnimatedStyle,
  useAnimatedScrollHandler,
  interpolate,
  withTiming,
  withDelay,
  Extrapolate,
} from "react-native-reanimated";
import styles, {
  HEADER_MAX_HEIGHT,
  HEADER_MIN_HEIGHT,
  AVATAR_MAX_SIZE,
  AVATAR_MIN_SIZE,
} from "@/styles/profile/styles";

type MenuItemProps = {
  icon: React.ReactNode;
  text: string;
  onPress: () => void;
  isDestructive?: boolean;
};

const MenuItem = ({ icon, text, onPress, isDestructive = false }: MenuItemProps) => (
  <TouchableOpacity style={styles.menuItem} onPress={onPress}>
    <View style={styles.menuItemIcon}>{icon}</View>
    <Text style={[styles.menuItemText, isDestructive && { color: "#ef4444" }]}>
      {text}
    </Text>
    <ChevronRight color={isDestructive ? "#ef4444" : "#9ca3af"} size={20} />
  </TouchableOpacity>
);

export default function ProfileScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [user, setUser] = useState<any>(null);
  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState("");

  // Animation values
  const scrollY = useSharedValue(0);
  const toastTranslateY = useSharedValue(100);

  const scrollHandler = useAnimatedScrollHandler((event) => {
    scrollY.value = event.contentOffset.y;
  });

  const showToast = (message: string) => {
    setToastMessage(message);
    toastTranslateY.value = withTiming(0, { duration: 300 });
    toastTranslateY.value = withDelay(2500, withTiming(100, { duration: 300 }));
  };

  useFocusEffect(
    useCallback(() => {
      const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
        setLoading(true);
        setUser(currentUser);
        if (currentUser) {
          await fetchUserData(currentUser.uid);
        } else {
          setLoading(false);
        }
      });

      if (params.toastMessage) {
        showToast(String(params.toastMessage));
        router.setParams({ toastMessage: "" }); // Clear param
      }

      return () => unsubscribe();
    }, [params])
  );

  const animatedHeaderStyle = useAnimatedStyle(() => {
    const height = interpolate(
      scrollY.value,
      [0, HEADER_MAX_HEIGHT - HEADER_MIN_HEIGHT],
      [HEADER_MAX_HEIGHT, HEADER_MIN_HEIGHT],
      Extrapolate.CLAMP
    );
    return { height };
  });

  const animatedAvatarContainerStyle = useAnimatedStyle(() => {
    const scale = interpolate(
      scrollY.value,
      [0, HEADER_MAX_HEIGHT - HEADER_MIN_HEIGHT],
      [1, 0],
      Extrapolate.CLAMP
    );
    const top = interpolate(
      scrollY.value,
      [0, HEADER_MAX_HEIGHT - HEADER_MIN_HEIGHT],
      [HEADER_MAX_HEIGHT - AVATAR_MAX_SIZE / 2 - 20, 10],
      Extrapolate.CLAMP
    );
    return { transform: [{ scale }], top };
  });

  const animatedUserInfoStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      scrollY.value,
      [0, (HEADER_MAX_HEIGHT - HEADER_MIN_HEIGHT) / 2],
      [1, 0],
      Extrapolate.CLAMP
    );
    return { opacity };
  });

  const animatedToastStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateY: toastTranslateY.value }],
    };
  });

  const fetchUserData = async (uid: string) => { /* ... (same as before) */ };
  const handleLogout = async () => { /* ... (same as before) */ };

  if (loading) { /* ... (same as before) */ }

  return (
    <SafeAreaView style={styles.container}>
      {/* Parallax Header */}
      <Animated.View style={[styles.header, animatedHeaderStyle]}>
        <LinearGradient
          colors={["#38bdf8", "#0ea5e9"]}
          style={styles.gradientFill}
        />
      </Animated.View>

      {/* Parallax Avatar */}
      <Animated.View style={[styles.avatarContainer, animatedAvatarContainerStyle]}>
        <Image
          source={{ uri: user?.photoURL || "https://avatar.iran.liara.run/public" }}
          style={styles.avatar}
        />
      </Animated.View>

      <Animated.ScrollView
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.content}>
          <Animated.View style={[styles.userInfo, animatedUserInfoStyle]}>
            <Text style={styles.username}>
              {userData?.username || user?.displayName || "Culina User"}
            </Text>
            <Text style={styles.email}>
              {userData?.email || user?.email || "No email provided"}
            </Text>
          </Animated.View>

          {/* Preferences Section */}
          <Animated.View style={styles.section} entering={FadeInUp.delay(400).duration(500)}>
            <Text style={styles.sectionTitle}>Your Preferences</Text>
            <View style={styles.prefsGrid}>
              {/* PrefPill components here */}
            </View>
          </Animated.View>

          {/* Action Menu */}
          <Animated.View style={styles.section} entering={FadeInUp.delay(500).duration(500)}>
            <View style={styles.menu}>
              {/* MenuItem components here */}
            </View>
          </Animated.View>
        </View>
      </Animated.ScrollView>

      {/* Toast Notification */}
      <Animated.View style={[styles.toast, animatedToastStyle]}>
        <Text style={styles.toastText}>{toastMessage}</Text>
      </Animated.View>
    </SafeAreaView>
  );
}