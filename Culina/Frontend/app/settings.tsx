import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ArrowLeft, Clock, Timer, Check } from "lucide-react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Animated, { FadeInDown } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { styles } from "@/styles/settingsStyles";

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
                placeholder="Input preffered time"
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
                placeholder="Input preferred time"
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
