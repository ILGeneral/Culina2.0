import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ArrowLeft, Clock, Timer, Check } from "lucide-react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Animated, { FadeInDown } from "react-native-reanimated";
import * as Haptics from "expo-haptics";

const HEADSTART_OPTIONS = [3, 5, 10, 15, 20, 30, 60];
const AUTO_TIMER_OPTIONS = [60, 80, 120, 180];

export default function SettingsScreen() {
  const router = useRouter();
  const [headstartTimer, setHeadstartTimer] = useState(5);
  const [autoTimer, setAutoTimer] = useState(60);
  const [customHeadstart, setCustomHeadstart] = useState("");
  const [customAutoTimer, setCustomAutoTimer] = useState("");
  const [showCustomHeadstart, setShowCustomHeadstart] = useState(false);
  const [showCustomAutoTimer, setShowCustomAutoTimer] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const savedHeadstart = await AsyncStorage.getItem("@headstart_timer");
      const savedAutoTimer = await AsyncStorage.getItem("@auto_timer");

      if (savedHeadstart) {
        const value = parseInt(savedHeadstart);
        setHeadstartTimer(value);
        if (!HEADSTART_OPTIONS.includes(value)) {
          setShowCustomHeadstart(true);
          setCustomHeadstart(savedHeadstart);
        }
      }

      if (savedAutoTimer) {
        const value = parseInt(savedAutoTimer);
        setAutoTimer(value);
        if (!AUTO_TIMER_OPTIONS.includes(value)) {
          setShowCustomAutoTimer(true);
          setCustomAutoTimer(savedAutoTimer);
        }
      }
    } catch (error) {
      console.error("Error loading settings:", error);
    }
  };

  const saveSettings = async () => {
    try {
      await AsyncStorage.setItem("@headstart_timer", headstartTimer.toString());
      await AsyncStorage.setItem("@auto_timer", autoTimer.toString());
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Success", "Settings saved successfully!");
    } catch (error) {
      console.error("Error saving settings:", error);
      Alert.alert("Error", "Failed to save settings");
    }
  };

  const handleHeadstartSelect = (value: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setHeadstartTimer(value);
    setShowCustomHeadstart(false);
    setCustomHeadstart("");
  };

  const handleAutoTimerSelect = (value: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setAutoTimer(value);
    setShowCustomAutoTimer(false);
    setCustomAutoTimer("");
  };

  const handleCustomHeadstart = () => {
    const value = parseInt(customHeadstart);
    if (isNaN(value) || value < 1 || value > 300) {
      Alert.alert("Invalid Input", "Please enter a value between 1 and 300 seconds");
      return;
    }
    setHeadstartTimer(value);
    setShowCustomHeadstart(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleCustomAutoTimer = () => {
    const value = parseInt(customAutoTimer);
    if (isNaN(value) || value < 10 || value > 600) {
      Alert.alert("Invalid Input", "Please enter a value between 10 and 600 seconds");
      return;
    }
    setAutoTimer(value);
    setShowCustomAutoTimer(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header with Gradient */}
      <LinearGradient
        colors={["#0ea5e9", "#06b6d4"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <View style={styles.headerContent}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backButton}
            activeOpacity={0.7}
          >
            <ArrowLeft color="#fff" size={24} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Cooking Timer Settings</Text>
        </View>
      </LinearGradient>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Headstart Timer Card */}
        <Animated.View
          entering={FadeInDown.duration(500)}
          style={styles.card}
        >
          <View style={styles.cardHeader}>
            <View style={styles.iconContainer}>
              <Clock color="#0ea5e9" size={24} />
            </View>
            <View style={styles.cardHeaderText}>
              <Text style={styles.cardTitle}>Headstart Timer</Text>
              <Text style={styles.cardSubtitle}>
                Reading time before auto-timer starts
              </Text>
            </View>
          </View>

          <View style={styles.optionsGrid}>
            {HEADSTART_OPTIONS.map((option) => (
              <TouchableOpacity
                key={option}
                onPress={() => handleHeadstartSelect(option)}
                style={[
                  styles.optionButton,
                  headstartTimer === option && !showCustomHeadstart && styles.optionButtonActive,
                ]}
                activeOpacity={0.7}
              >
                {headstartTimer === option && !showCustomHeadstart && (
                  <View style={styles.checkBadge}>
                    <Check color="#fff" size={12} />
                  </View>
                )}
                <Text
                  style={[
                    styles.optionText,
                    headstartTimer === option && !showCustomHeadstart && styles.optionTextActive,
                  ]}
                >
                  {option}s
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.divider} />

          <View style={styles.customSection}>
            <Text style={styles.customLabel}>Custom Duration</Text>
            <View style={styles.customInputContainer}>
              <TextInput
                style={styles.customInput}
                placeholder="1-300 seconds"
                placeholderTextColor="#94a3b8"
                keyboardType="numeric"
                value={customHeadstart}
                onChangeText={setCustomHeadstart}
              />
              <TouchableOpacity
                onPress={handleCustomHeadstart}
                style={styles.customButton}
                activeOpacity={0.7}
              >
                <Text style={styles.customButtonText}>Set</Text>
              </TouchableOpacity>
            </View>
            {showCustomHeadstart && (
              <View style={styles.currentBadge}>
                <Check color="#0ea5e9" size={14} />
                <Text style={styles.currentBadgeText}>
                  Current: {headstartTimer}s (Custom)
                </Text>
              </View>
            )}
          </View>
        </Animated.View>

        {/* Auto Timer Card */}
        <Animated.View
          entering={FadeInDown.delay(100).duration(500)}
          style={styles.card}
        >
          <View style={styles.cardHeader}>
            <View style={[styles.iconContainer, { backgroundColor: "#dcfce7" }]}>
              <Timer color="#10b981" size={24} />
            </View>
            <View style={styles.cardHeaderText}>
              <Text style={styles.cardTitle}>Auto Timer</Text>
              <Text style={styles.cardSubtitle}>
                Time before moving to next step
              </Text>
            </View>
          </View>

          <View style={styles.optionsGrid}>
            {AUTO_TIMER_OPTIONS.map((option) => (
              <TouchableOpacity
                key={option}
                onPress={() => handleAutoTimerSelect(option)}
                style={[
                  styles.optionButton,
                  autoTimer === option && !showCustomAutoTimer && styles.optionButtonActiveGreen,
                ]}
                activeOpacity={0.7}
              >
                {autoTimer === option && !showCustomAutoTimer && (
                  <View style={[styles.checkBadge, { backgroundColor: "#10b981" }]}>
                    <Check color="#fff" size={12} />
                  </View>
                )}
                <Text
                  style={[
                    styles.optionText,
                    autoTimer === option && !showCustomAutoTimer && styles.optionTextActive,
                  ]}
                >
                  {option}s
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.divider} />

          <View style={styles.customSection}>
            <Text style={styles.customLabel}>Custom Duration</Text>
            <View style={styles.customInputContainer}>
              <TextInput
                style={styles.customInput}
                placeholder="10-600 seconds"
                placeholderTextColor="#94a3b8"
                keyboardType="numeric"
                value={customAutoTimer}
                onChangeText={setCustomAutoTimer}
              />
              <TouchableOpacity
                onPress={handleCustomAutoTimer}
                style={[styles.customButton, { backgroundColor: "#10b981" }]}
                activeOpacity={0.7}
              >
                <Text style={styles.customButtonText}>Set</Text>
              </TouchableOpacity>
            </View>
            {showCustomAutoTimer && (
              <View style={[styles.currentBadge, { borderColor: "#10b981" }]}>
                <Check color="#10b981" size={14} />
                <Text style={[styles.currentBadgeText, { color: "#10b981" }]}>
                  Current: {autoTimer}s (Custom)
                </Text>
              </View>
            )}
          </View>
        </Animated.View>

        {/* Save Button */}
        <TouchableOpacity
          onPress={saveSettings}
          style={styles.saveButton}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={["#0ea5e9", "#06b6d4"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.saveButtonGradient}
          >
            <Text style={styles.saveButtonText}>Save Settings</Text>
          </LinearGradient>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  header: {
    paddingTop: 8,
    paddingBottom: 20,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
  },
  headerContent: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#fff",
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: "#dbeafe",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  cardHeaderText: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1e293b",
    marginBottom: 2,
  },
  cardSubtitle: {
    fontSize: 13,
    color: "#64748b",
  },
  optionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  optionButton: {
    backgroundColor: "#f1f5f9",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "transparent",
    position: "relative",
    minWidth: 70,
    alignItems: "center",
  },
  optionButtonActive: {
    backgroundColor: "#dbeafe",
    borderColor: "#0ea5e9",
  },
  optionButtonActiveGreen: {
    backgroundColor: "#dcfce7",
    borderColor: "#10b981",
  },
  checkBadge: {
    position: "absolute",
    top: -6,
    right: -6,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#0ea5e9",
    alignItems: "center",
    justifyContent: "center",
  },
  optionText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#475569",
  },
  optionTextActive: {
    color: "#1e293b",
    fontWeight: "700",
  },
  divider: {
    height: 1,
    backgroundColor: "#e2e8f0",
    marginVertical: 20,
  },
  customSection: {
    gap: 10,
  },
  customLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#475569",
    marginBottom: 4,
  },
  customInputContainer: {
    flexDirection: "row",
    gap: 10,
  },
  customInput: {
    flex: 1,
    backgroundColor: "#f1f5f9",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    fontSize: 15,
    color: "#1e293b",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  customButton: {
    backgroundColor: "#0ea5e9",
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 70,
  },
  customButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
  },
  currentBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#f0f9ff",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#0ea5e9",
    alignSelf: "flex-start",
  },
  currentBadgeText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#0ea5e9",
  },
  saveButton: {
    marginTop: 8,
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#0ea5e9",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  saveButtonGradient: {
    paddingVertical: 18,
    alignItems: "center",
  },
  saveButtonText: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
});
