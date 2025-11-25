import { ActivityIndicator, View } from "react-native";
import { Stack, useRouter, useSegments } from "expo-router";
import { useEffect, useState } from "react";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth, db } from "@/lib/firebaseConfig";
import { doc, getDoc } from "firebase/firestore";
import { RecipeDatabaseProvider } from "@/contexts/RecipeDatabaseContext";
import { GestureHandlerRootView } from "react-native-gesture-handler";

export default function RootLayout() {
  const router = useRouter();
  const segments = useSegments();
  const [user, loading] = useAuthState(auth);
  const [checkingOnboarding, setCheckingOnboarding] = useState(false);
  const [hasChecked, setHasChecked] = useState(false);

  useEffect(() => {
    if (loading) {
      return;
    }

    const inAuthGroup = segments[0] === "(auth)";
    const onOnboardingScreen = segments[1] === "onboarding";

    // Not logged in - redirect to login
    if (!user && !inAuthGroup) {
      router.replace("/(auth)/login");
      return;
    }

    // Logged in and in auth group - check onboarding status
    if (user && inAuthGroup && !onOnboardingScreen && !checkingOnboarding && !hasChecked) {
      // If user is on login/register, check if they need onboarding
      const checkOnboarding = async () => {
        setCheckingOnboarding(true);
        try {
          const userDoc = await getDoc(doc(db, "users", user.uid));
          const hasCompletedOnboarding = userDoc.data()?.hasCompletedOnboarding ?? false;

          setHasChecked(true);

          if (hasCompletedOnboarding) {
            router.replace("/(tabs)/home");
          } else {
            router.replace("/(auth)/onboarding");
          }
        } catch (error) {
          console.error("Error checking onboarding:", error);
          setHasChecked(true);
          router.replace("/(auth)/onboarding");
        } finally {
          setCheckingOnboarding(false);
        }
      };

      checkOnboarding();
    }

    // User completed onboarding and is on onboarding screen - should not happen but handle it
    if (user && onOnboardingScreen) {
      // Let them stay on onboarding screen to complete it
      return;
    }
  }, [loading, user, segments, router, checkingOnboarding, hasChecked]);

  if (loading || checkingOnboarding) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color="#128AFAFF" />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <RecipeDatabaseProvider>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="(auth)" />
        </Stack>
      </RecipeDatabaseProvider>
    </GestureHandlerRootView>
  );
}
