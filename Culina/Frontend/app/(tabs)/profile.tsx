import React from "react";
import { View, Text, TouchableOpacity, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LogOut, AlertTriangle } from "lucide-react-native";
import { auth } from "@/lib/firebaseConfig";
import { signOut } from "firebase/auth";
import { useRouter } from "expo-router";

export default function ProfileScreen() {
  const router = useRouter();

  const handleLogout = async () => {
    await signOut(auth);
    router.replace("/login");
  };

  const handleReportIssue = () => {
    router.push("/report" as any);
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <ScrollView className="px-6 pt-6">
        <Text className="text-3xl font-bold text-green-700 mb-6">Profile</Text>

        {/* User Info */}
        <View className="bg-green-50 p-4 rounded-2xl mb-6">
          <Text className="text-lg font-semibold text-green-800">User Information</Text>
          <Text className="text-gray-700 mt-2">
            (This section will later display your username, email, and preferences.)
          </Text>
        </View>

        {/* Report Issue */}
        <TouchableOpacity
          onPress={handleReportIssue}
          className="bg-orange-500 py-4 px-5 rounded-xl mb-4 flex-row items-center justify-center"
        >
          <AlertTriangle color="#fff" size={20} />
          <Text className="text-white text-lg font-semibold ml-2">
            Report an Issue
          </Text>
        </TouchableOpacity>

        {/* Logout */}
        <TouchableOpacity
          onPress={handleLogout}
          className="bg-gray-600 py-4 px-5 rounded-xl flex-row items-center justify-center"
        >
          <LogOut color="#fff" size={20} />
          <Text className="text-white text-lg font-semibold ml-2">Logout</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
