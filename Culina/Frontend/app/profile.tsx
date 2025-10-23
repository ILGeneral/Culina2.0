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

type PrefPillProps = {
  icon: React.ReactNode;
  label: string;
  value: string;
};

const PrefPill = ({ icon, label, value }: PrefPillProps) => (
  <View style={styles.prefPill}>
    <View style={styles.prefIcon}>{icon}</View>
    <Text style={styles.prefLabel}>{label}</Text>
    <Text style={styles.prefText}>{value}</Text>
  </View>
);

const formatPreferenceValue = (value?: string) => {
  if (!value) {
    return "Not set";
  }
  return value
    .toString()
    .split(/[\s_-]+/)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
};

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

  const toastParam = typeof params.toastMessage === "string" ? params.toastMessage : undefined;

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        setLoading(true);
        await fetchUserData(currentUser.uid);
      } else {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  useFocusEffect(
    useCallback(() => {
      const currentUser = auth.currentUser;
      if (currentUser) {
        setLoading(true);
        fetchUserData(currentUser.uid);
      } else {
        setLoading(false);
      }
      return () => {};
    }, [])
  );

  useEffect(() => {
    if (toastParam) {
      showToast(String(toastParam));
      router.setParams({ toastMessage: "" });
    }
  }, [router, showToast, toastParam]);

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

  const preferences = userData?.preferences ?? {};
  const allergiesList = Array.isArray(preferences.allergies) ? preferences.allergies : [];
  const preferenceSummary = [
    preferences.diet ? `Diet: ${formatPreferenceValue(preferences.diet)}` : null,
    preferences.religiousPreference ? `Religious: ${formatPreferenceValue(preferences.religiousPreference)}` : null,
  ]
    .filter(Boolean)
    .join("\n");
  const preferenceValue = preferenceSummary || "Not set";
  const allergiesText = allergiesList.length ? allergiesList.join(", ") : "None reported";
  const caloriePlanText = preferences.caloriePlan ? `${preferences.caloriePlan} kcal/day` : "Not set";

  const handleEditProfile = () => {
    router.push("/editProfile");
  };

  const handleReportIssue = () => {
    router.push("/report");
  };

  const fetchUserData = async (uid: string) => {
    /* ... (same as before) */
    try {
      const docRef = doc(db, "users", uid);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setUserData(docSnap.data());
      } else {
        setUserData(null);
      }
    } catch (error) {
      console.error("Error fetching user data:", error);
      showToast("Failed to load profile.");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    /* ... (same as before) */
    try {
      await signOut(auth);
      router.replace("/login");
    } catch (error) {
      console.error("Error signing out:", error);
      showToast("Failed to log out. Please try again.");
    }
  };

  if (loading) {
    /* ... (same as before) */
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0ea5e9" />
        <Text style={styles.loadingText}>Loading your profile...</Text>
      </SafeAreaView>
    );
  }

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
              <PrefPill
                icon={<Heart color="#0ea5e9" size={20} />}
                label="Preferences"
                value={preferenceValue}
              />
              <PrefPill
                icon={<WheatOff color="#0ea5e9" size={20} />}
                label="Allergies"
                value={allergiesText}
              />
              <PrefPill
                icon={<Flame color="#fb923c" size={20} />}
                label="Target Calories"
                value={caloriePlanText}
              />
            </View>
          </Animated.View>

          {/* Action Menu */}
          <Animated.View style={styles.section} entering={FadeInUp.delay(500).duration(500)}>
            <View style={styles.menu}>
              {/* MenuItem components here */}
              <MenuItem
                icon={<Edit3 color="#0f172a" size={20} />}
                text="Edit Profile"
                onPress={handleEditProfile}
              />
              <MenuItem
                icon={<AlertTriangle color="#f97316" size={20} />}
                text="Report an Issue"
                onPress={handleReportIssue}
              />
              <MenuItem
                icon={<LogOut color="#ef4444" size={20} />}
                text="Log Out"
                onPress={handleLogout}
                isDestructive
              />
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