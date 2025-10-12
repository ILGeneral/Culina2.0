import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { ArrowLeft, Send } from "lucide-react-native";
import { httpsCallable } from "firebase/functions";
import { functions, auth } from "@/lib/firebaseConfig";
import Constants from "expo-constants";
import DropDownPicker from "react-native-dropdown-picker";
import AnimatedPageWrapper from "../components/AnimatedPageWrapper";

export default function ReportIssueScreen() {
  const router = useRouter();
  const [reportType, setReportType] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [open, setOpen] = useState(false);

  const [items, setItems] = useState([
    { label: "Recipe Generation Issue", value: "recipe_generation_issue" },
    { label: "AI Companion Bug", value: "ai_companion_bug" },
    { label: "Visual or UI Bug", value: "visual_bug" },
    { label: "Inventory Issue", value: "inventory_issue" },
    { label: "App Crash or Error", value: "crash_error" },
    { label: "Other", value: "other" },
  ]);

  const user = auth.currentUser;
  const appVersion = Constants.expoConfig?.version ?? "1.0.0";
  const deviceInfo = `${Platform.OS} ${Platform.Version}`;
  const userEmail = user?.email ?? "Unknown User";

  const handleSubmit = async () => {
    if (!reportType || !description.trim()) {
      Alert.alert("Missing Fields", "Please fill in all fields.");
      return;
    }
    if (!user) {
      Alert.alert("Error", "Please log in before submitting a report.");
      return;
    }

    try {
      setSubmitting(true);
      const submitReport = httpsCallable(functions, "submitReport");
      await submitReport({
        type: reportType,
        description,
        appVersion,
        device: deviceInfo,
        userEmail,
      });
      Alert.alert("✅ Report Sent", "Thank you for your feedback!");
      router.back();
    } catch (err: any) {
      console.error("Submit report error:", err);
      Alert.alert("⚠️ Error", "Failed to send report. Please try again later.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AnimatedPageWrapper>
      <SafeAreaView className="flex-1 bg-white">
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          className="flex-1"
        >
          <ScrollView className="px-5 pt-5">
            <View className="flex-row items-center mb-6">
              <TouchableOpacity onPress={() => router.back()}>
                <ArrowLeft color="#16a34a" size={24} />
              </TouchableOpacity>
              <Text className="text-2xl font-bold text-green-700 ml-3">
                Report an Issue
              </Text>
            </View>

            <Text className="text-gray-700 mb-4">
              Please describe the issue you encountered in the app.
            </Text>

            <Text className="text-sm font-semibold text-gray-700 mb-2">
              Report Type
            </Text>
            <DropDownPicker
              open={open}
              value={reportType}
              items={items}
              setOpen={setOpen}
              setValue={setReportType}
              setItems={setItems}
              placeholder="Select a category..."
              style={{
                borderColor: "#d1d5db",
                minHeight: 50,
                borderRadius: 10,
                marginBottom: open ? 150 : 10,
              }}
              dropDownContainerStyle={{
                borderColor: "#d1d5db",
                borderRadius: 10,
              }}
              textStyle={{ fontSize: 16 }}
            />

            <Text className="text-sm font-semibold text-gray-700 mt-4 mb-2">
              Description
            </Text>
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="Describe what happened..."
              multiline
              numberOfLines={6}
              textAlignVertical="top"
              className="border border-gray-300 rounded-lg p-3 text-base"
            />

            <View className="bg-green-50 p-3 rounded-lg mt-6">
              <Text className="text-gray-700 text-sm">
                <Text className="font-semibold">User:</Text> {userEmail}
              </Text>
              <Text className="text-gray-700 text-sm">
                <Text className="font-semibold">Device:</Text> {deviceInfo}
              </Text>
              <Text className="text-gray-700 text-sm">
                <Text className="font-semibold">App Version:</Text> {appVersion}
              </Text>
            </View>

            <TouchableOpacity
              disabled={submitting}
              onPress={handleSubmit}
              className="mt-8 mb-10 bg-orange-500 rounded-xl py-4 flex-row justify-center items-center"
            >
              {submitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Send color="#fff" size={20} />
                  <Text className="text-white font-semibold text-lg ml-2">
                    Submit Report
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </AnimatedPageWrapper>
  );
}
