import { useEffect } from "react";
import { useRouter } from "expo-router";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebaseConfig";
import { View, ActivityIndicator } from "react-native";

export default function Index() {
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        router.replace("/home");
      } else {
        router.replace("/login");
      }
    });

    return () => unsubscribe();
  }, []);

  return (
    <View className="flex-1 justify-center items-center bg-white">
      <ActivityIndicator size="large" color="#16a34a" />
    </View>
  );
}
