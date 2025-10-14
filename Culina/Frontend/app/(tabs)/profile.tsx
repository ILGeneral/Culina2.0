import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LogOut, AlertTriangle, Edit3, Settings } from "lucide-react-native";
import { auth, db } from "@/lib/firebaseConfig";
import { signOut, onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { useRouter } from "expo-router";

export default function ProfileScreen() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [profileDetails, setProfileDetails] = useState<{ displayName?: string; email?: string } | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);

  useEffect(() => {
    // Listen for the current user state
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser?.uid) {
        setLoadingProfile(true);
        getDoc(doc(db, "users", currentUser.uid))
          .then((snapshot) => {
            if (snapshot.exists()) {
              const data = snapshot.data() as { username?: string; email?: string; displayName?: string };
              setProfileDetails({
                displayName: data.username || data.displayName,
                email: data.email,
              });
            } else {
              setProfileDetails(null);
            }
          })
          .catch((err) => {
            console.error("Failed to load profile details", err);
            setProfileDetails(null);
          })
          .finally(() => setLoadingProfile(false));
      } else {
        setProfileDetails(null);
      }
    });

    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    await signOut(auth);
    router.replace("/login");
  };

  const handleReportIssue = () => router.push("/report" as any);
  const handleEditProfile = () => router.push("/edit-profile" as any);
  const handlePreferences = () => router.push("/preferences" as any);

  return (
    <SafeAreaView className="flex-1 bg-white">
      <ScrollView showsVerticalScrollIndicator={false} className="px-6 pt-6">
        {/* Header */}
        <View className="items-center mb-8">
          <Image
            source={{
              uri:
                user?.photoURL ||
                "https://cdn-icons-png.flaticon.com/512/847/847969.png",
            }}
            className="w-28 h-28 rounded-full mb-3"
          />
          <Text className="text-2xl font-bold text-green-700">
            {profileDetails?.displayName || user?.displayName || user?.email?.split("@")[0] || "Guest User"}
          </Text>
          <Text className="text-gray-500">
            {profileDetails?.email || user?.email || (loadingProfile ? "Loading email..." : "No email")}
          </Text>
        </View>

        {/* Info Card */}
        <View className="bg-green-50 p-5 rounded-2xl mb-6 shadow-sm">
          <Text className="text-lg font-semibold text-green-800 mb-2">
            Account Details
          </Text>
          <Text className="text-gray-700">
            UID: {user?.uid || "Unavailable"}
          </Text>
          <Text className="text-gray-700 mt-1">
            Preferences: (To be displayed here)
          </Text>
        </View>

        {/* Quick Actions */}
        <View className="space-y-4 mb-8">
          <TouchableOpacity
            onPress={handleEditProfile}
            className="flex-row items-center justify-between bg-green-100 p-4 rounded-xl"
          >
            <View className="flex-row items-center">
              <Edit3 color="#166534" size={22} />
              <Text className="ml-3 text-green-800 font-semibold text-lg">
                Edit Profile
              </Text>
            </View>
            <Text className="text-green-700">{">"}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handlePreferences}
            className="flex-row items-center justify-between bg-green-100 p-4 rounded-xl"
          >
            <View className="flex-row items-center">
              <Settings color="#166534" size={22} />
              <Text className="ml-3 text-green-800 font-semibold text-lg">
                Preferences
              </Text>
            </View>
            <Text className="text-green-700">{">"}</Text>
          </TouchableOpacity>
        </View>

        {/* Support Section */}
        <TouchableOpacity
          onPress={handleReportIssue}
          className="bg-orange-500 py-4 px-5 rounded-xl mb-4 flex-row items-center justify-center shadow-md"
        >
          <AlertTriangle color="#fff" size={20} />
          <Text className="text-white text-lg font-semibold ml-2">
            Report an Issue
          </Text>
        </TouchableOpacity>

        {/* Logout */}
        <TouchableOpacity
          onPress={handleLogout}
          className="bg-gray-700 py-4 px-5 rounded-xl flex-row items-center justify-center"
        >
          <LogOut color="#fff" size={20} />
          <Text className="text-white text-lg font-semibold ml-2">
            Logout
          </Text>
        </TouchableOpacity>

        {/* Footer */}
        <Text className="text-center text-gray-400 text-sm mt-8 mb-4">
          Culina 2.0 © 2025
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
