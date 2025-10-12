import { useEffect } from "react";
import { useRouter } from "expo-router";
import { View, Text, ActivityIndicator, StyleSheet } from "react-native";
import { auth } from "@/lib/firebaseConfig";
import { onAuthStateChanged, type User } from "firebase/auth";

export default function Index() {
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user: User | null) => {
      if (user) {
        // ✅ Redirect authenticated users to tabs/home
        router.replace("/(tabs)/home");
      } else {
        // ✅ Redirect unauthenticated users to login
        router.replace("/(auth)/login");
      }
    });
    return () => unsubscribe();
  }, [router]);

  return (
    <View className="flex-1 justify-center items-center bg-white">
      <ActivityIndicator size="large" color="#16a34a" />
      <Text className="mt-3 text-gray-600 text-base">Loading your session...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
  },
  text: {
    marginTop: 12,
    fontSize: 16,
    color: "#6b7280",
  },
});
