import { useEffect } from "react";
import { useRouter } from "expo-router";
import { View, Text, ActivityIndicator } from "react-native";
import { auth } from "@/lib/firebaseConfig";
import { onAuthStateChanged, type User } from "firebase/auth";
import Background from "@/components/Background";

export default function Index() {
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user: User | null) => {
      if (user) {
        // Redirect authenticated users to tabs/home
        router.replace("/(tabs)/home");
      } else {
        // Redirect unauthenticated users to login
        router.replace("/(auth)/login");
      }
    });
    return () => unsubscribe();
  }, [router]);

  return (
    <Background>
      <View className="flex-1 justify-center items-center">
        <ActivityIndicator size="large" color="#128AFAFF" />
        <Text className="mt-3 text-gray-600 text-base">Loading your session...</Text>
      </View>
    </Background>
  );
}
