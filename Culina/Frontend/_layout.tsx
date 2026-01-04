import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { SplashScreen, Stack, useRouter } from "expo-router";
import {
  useFonts,
  Baloo2_400Regular,
  Baloo2_500Medium,
  Baloo2_600SemiBold,
  Baloo2_700Bold,
  Baloo2_800ExtraBold,
} from "@expo-google-fonts/baloo-2";
import { auth } from "@/lib/firebaseConfig";
import { useAuthState } from "react-firebase-hooks/auth";
import { styles } from "@/styles/layoutStyles";

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const router = useRouter();
  const [fontsLoaded, fontError] = useFonts({
    Baloo2_400Regular,
    Baloo2_500Medium,
    Baloo2_600SemiBold,
    Baloo2_700Bold,
    Baloo2_800ExtraBold,
  });
  const [user, authLoading] = useAuthState(auth);

  useEffect(() => {
    if (fontsLoaded && !authLoading) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded, authLoading]);

  useEffect(() => {
    if (authLoading) {
      return;
    }
    if (user) {
      router.replace("/(tabs)/home");
    } else {
      router.replace("/(auth)/login");
    }
  }, [user, authLoading, router]);

  if ((!fontsLoaded && !fontError) || authLoading) {
    return (
      <View style={styles.splash}>
        <ActivityIndicator size="large" color="#128AFA" />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="recipe/[id]" />
      <Stack.Screen name="recipe/generated" />
      <Stack.Screen name="editProfile" />
    </Stack>
  );
}
