import React, { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, Alert, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebaseConfig";
import { ArrowLeft, LogOut, User } from "lucide-react-native";

export default function ProfileScreen() {
  const router = useRouter();
  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUserData = async () => {
      const user = auth.currentUser;
      if (!user) return;

      try {
        const docRef = doc(db, "users", user.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setUserData(docSnap.data());
        }
      } catch (err) {
        console.error("Error fetching user data:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
  }, []);

  const handleLogout = async () => {
    Alert.alert("Logout", "Are you sure you want to logout?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Logout",
        style: "destructive",
        onPress: async () => {
          try {
            await signOut(auth);
            router.replace("/login");
          } catch (err) {
            Alert.alert("Error", "Failed to logout");
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="flex-row items-center px-5 pt-5 pb-3 border-b border-gray-200">
        <TouchableOpacity onPress={() => router.back()} className="mr-3">
          <ArrowLeft color="#16a34a" size={24} />
        </TouchableOpacity>
        <Text className="text-2xl font-bold text-green-700">Profile</Text>
      </View>

      <ScrollView className="flex-1 px-5 pt-5">
        {/* User Info */}
        <View className="items-center mb-6">
          <View className="bg-green-100 rounded-full p-6 mb-3">
            <User color="#16a34a" size={48} />
          </View>
          <Text className="text-2xl font-bold text-gray-800">
            {userData?.username || auth.currentUser?.displayName || "User"}
          </Text>
          <Text className="text-gray-500">{auth.currentUser?.email}</Text>
        </View>

        {/* Preferences */}
        {userData?.preferences && (
          <View className="bg-gray-50 rounded-2xl p-5 mb-5">
            <Text className="text-lg font-semibold text-green-700 mb-3">
              Preferences
            </Text>

            <View className="mb-3">
              <Text className="text-gray-500 text-sm">Dietary Preference</Text>
              <Text className="text-gray-800 font-medium">
                {userData.preferences.diet || "Not set"}
              </Text>
            </View>

            <View className="mb-3">
              <Text className="text-gray-500 text-sm">Religious Preference</Text>
              <Text className="text-gray-800 font-medium">
                {userData.preferences.religion || "Not set"}
              </Text>
            </View>

            <View>
              <Text className="text-gray-500 text-sm">Calorie Plan</Text>
              <Text className="text-gray-800 font-medium">
                {userData.preferences.caloriePlan || "Not set"}
              </Text>
            </View>
          </View>
        )}

        {/* Logout Button */}
        <TouchableOpacity
          onPress={handleLogout}
          className="bg-red-500 py-4 rounded-lg flex-row items-center justify-center"
        >
          <LogOut color="#fff" size={20} />
          <Text className="text-white font-semibold text-lg ml-2">Logout</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
