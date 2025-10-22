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
  StyleSheet,
  SafeAreaView,
} from "react-native";
import { useRouter } from "expo-router";
import { ArrowLeft, Send } from "lucide-react-native";
import { httpsCallable } from "firebase/functions";
import { functions, auth } from "@/lib/firebaseConfig";
import Constants from "expo-constants";
import DropDownPicker from "react-native-dropdown-picker";
import AnimatedPageWrapper from "../components/AnimatedPageWrapper";
import { reportStyles } from "@/styles/report/styles";

const styles = StyleSheet.create({
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoContainer: {
    backgroundColor: "#f1f5f9",
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  infoLabel: {
    fontSize: 14,
    color: "#475569",
    marginBottom: 8,
  },
  infoLabelText: {
    fontWeight: '600',
    color: "#334155",
  },
});

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
      
      // Log the function call
      console.log("Attempting to call submitReport function...");
      
      // Get the functions instance with the correct region if needed
      const functionsInstance = functions;
      // If your functions are in a specific region, use:
      // const functionsInstance = getFunctions(app, 'your-region');
      
      // Call the Firebase Cloud Function
      const submitReport = httpsCallable(functionsInstance, "submitReport");
      console.log("Function reference created, calling...");
      
      const result = await submitReport({
        type: reportType,
        description,
        appVersion,
        device: deviceInfo,
        userEmail,
        timestamp: new Date().toISOString()
      });
      
      // Log success and show confirmation
      console.log("Report submitted successfully:", result);
      Alert.alert("Report Sent!", "Thank you for your feedback! We'll review it soon.");
      
      // Reset form and navigate back
      setDescription('');
      setReportType(null);
      router.back();
    } catch (error: any) {
      console.error("Error details:", {
        code: error.code,
        message: error.message,
        details: error.details,
        stack: error.stack
      });
      
      // Handle specific error cases
      if (error.code === 'unauthenticated') {
        Alert.alert("Authentication Error", "Please log in to submit a report.");
      } else if (error.code === 'not-found') {
        Alert.alert("Service Unavailable", "The report service is currently unavailable. Please try again later.");
      } else if (error.code === 'invalid-argument') {
        Alert.alert("Invalid Input", error.message || "Please check your input and try again.");
      } else {
        Alert.alert("Error", `Failed to submit report: ${error.message || 'Please try again later.'}`);
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

            <View style={styles.infoContainer}>
              <Text style={styles.infoLabel}>
                <Text style={styles.infoLabelText}>User: </Text>{userEmail}
              </Text>
              <Text style={styles.infoLabel}>
                <Text style={styles.infoLabelText}>Device: </Text>{deviceInfo}
              </Text>
              <Text style={styles.infoLabel}>
                <Text style={styles.infoLabelText}>App Version: </Text>{appVersion}
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
                <View style={styles.buttonContent}>
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
