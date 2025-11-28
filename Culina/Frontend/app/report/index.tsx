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
  SafeAreaView,
} from "react-native";
import { useRouter } from "expo-router";
import { ArrowLeft, Send } from "lucide-react-native";
import { auth as firebaseAuth } from "@/lib/firebaseConfig";
import Constants from "expo-constants";
import DropDownPicker from "react-native-dropdown-picker";
import AnimatedPageWrapper from "../components/AnimatedPageWrapper";
import { reportStyles } from "@/styles/report/styles";

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

  const user = firebaseAuth.currentUser;
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

      // Write directly to Firestore (works on free Spark plan)
      const { db } = await import("@/lib/firebaseConfig");
      const { collection, addDoc, serverTimestamp } = await import("firebase/firestore");

      console.log("Submitting report directly to Firestore...");

      const reportsCollection = collection(db, "reports");
      const docRef = await addDoc(reportsCollection, {
        reporterId: user.uid,
        type: reportType,
        description: description.trim(),
        appVersion,
        device: deviceInfo,
        userEmail,
        emailSent: false,
        createdAt: serverTimestamp(),
      });

      // Log success and show confirmation
      console.log("Report submitted successfully with ID:", docRef.id);
      Alert.alert("Report Sent!", "Thank you for your feedback! We'll review it soon.");

      // Reset form and navigate back
      setDescription('');
      setReportType(null);
      router.back();
    } catch (error: any) {
      console.error("Error submitting report:", {
        code: error.code,
        message: error.message,
        stack: error.stack
      });

      // Handle specific error cases
      if (error.code === 'permission-denied') {
        Alert.alert("Permission Error", "You don't have permission to submit reports. Please contact support.");
      } else if (error.code === 'unauthenticated') {
        Alert.alert("Authentication Error", "Please log in to submit a report.");
      } else {
        // Generic error fallback - show actual error message
        Alert.alert(
          "Submission Error",
          error.message || "An unexpected error occurred. Please try again."
        );
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AnimatedPageWrapper>
      <SafeAreaView style={{ flex: 1, backgroundColor: '#f8fafc' }}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={{ flex: 1 }}
        >
          <View style={reportStyles.header}>
            <TouchableOpacity onPress={() => router.back()}>
              <ArrowLeft color="#128AFA" size={24} />
            </TouchableOpacity>
            <Text style={reportStyles.headerTitle}>Report an Issue</Text>
          </View>

          <ScrollView 
            style={{ flex: 1 }}
            contentContainerStyle={reportStyles.content}
          >
            <Text style={reportStyles.description}>
              Please describe the issue you encountered in the app.
            </Text>

            <Text style={reportStyles.label}>Report Type</Text>
            <View style={reportStyles.dropdownContainer}>
              <DropDownPicker
                open={open}
                value={reportType}
                items={items}
                setOpen={setOpen}
                setValue={setReportType}
                setItems={setItems}
                placeholder="Select an issue type"
                style={reportStyles.dropdown}
                textStyle={reportStyles.dropdownText}
                placeholderStyle={[reportStyles.dropdownText, reportStyles.dropdownPlaceholder]}
                dropDownContainerStyle={reportStyles.dropdownList}
                listMode="SCROLLVIEW"
                scrollViewProps={{
                  nestedScrollEnabled: true,
                }}
              />
            </View>

            <Text style={reportStyles.label}>Description</Text>
            <TextInput
              style={reportStyles.input}
              placeholder="Please provide details about the issue..."
              placeholderTextColor="#94a3b8"
              multiline
              value={description}
              onChangeText={setDescription}
              textAlignVertical="top"
            />

            <View style={reportStyles.infoContainer}>
              <Text style={reportStyles.infoLabel}>
                <Text style={reportStyles.infoLabelText}>User: </Text>{userEmail}
              </Text>
              <Text style={reportStyles.infoLabel}>
                <Text style={reportStyles.infoLabelText}>Device: </Text>{deviceInfo}
              </Text>
              <Text style={reportStyles.infoLabel}>
                <Text style={reportStyles.infoLabelText}>App Version: </Text>{appVersion}
              </Text>
            </View>

            <TouchableOpacity
              style={[
                reportStyles.submitButton,
                (!reportType || !description.trim() || submitting) && reportStyles.submitButtonDisabled
              ]}
              onPress={handleSubmit}
              disabled={!reportType || !description.trim() || submitting}
              activeOpacity={0.9}
            >
              {submitting ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <View style={reportStyles.buttonContent}>
                  <Text style={reportStyles.submitButtonText}>
                    Submit Report
                  </Text>
                  <Send size={18} color="#ffffff" style={{ marginLeft: 8 }} />
                </View>
              )}
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
      
      {Platform.OS === 'web' && (
        <style type="text/css">
          {`
            /* Fix for DropDownPicker z-index issues on web */
            .css-view-1dbjc4n {
              z-index: 1000 !important;
            }
            .css-1dbjc4n {
              z-index: 1000 !important;
            }
          `}
        </style>
      )}
    </AnimatedPageWrapper>
  );
}
