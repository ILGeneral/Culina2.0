import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  StyleSheet,
  Image,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth, db } from "@/lib/firebaseConfig";
import { doc, getDoc } from "firebase/firestore";
import Background from "@/components/Background";

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = async () => {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Check if user has completed onboarding
      const userDocRef = doc(db, "users", user.uid);
      const userDoc = await getDoc(userDocRef);

      if (userDoc.exists()) {
        const userData = userDoc.data();
        const hasCompletedOnboarding = userData?.hasCompletedOnboarding ?? false;

        if (hasCompletedOnboarding) {
          // Returning user - go to main app
          router.replace("/(tabs)");
        } else {
          // First-time user - show onboarding
          router.replace("/(auth)/onboarding");
        }
      } else {
        // No user document (shouldn't happen, but handle gracefully)
        router.replace("/(auth)/onboarding");
      }
    } catch (err: any) {
      Alert.alert("Login failed", err.message);
    }
  };

  return (
    <Background>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.container}
        keyboardVerticalOffset={Platform.OS === "ios" ? 80 : 0}
      >
      <View style={styles.inner}>
      <Image
        source={require("@/assets/login/culinalogo.png")}
        style={styles.logo}
        resizeMode="contain"
      />
      <Text style={styles.title}>Welcome to Culina!</Text>

      <TextInput
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        style={styles.input}
        autoCapitalize="none"
        keyboardType="email-address"
      />
      <TextInput
        placeholder="Password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
        style={styles.input}
      />

      <TouchableOpacity onPress={handleLogin} style={styles.button}>
        <Text style={styles.buttonText}>Login</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => router.push("/(auth)/register" as unknown as never)}>
        <Text style={styles.linkText}>
          Don't have an account? <Text style={styles.linkHighlight}>Sign up!</Text>
        </Text>
      </TouchableOpacity>
      </View>
      </KeyboardAvoidingView>
    </Background>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  inner: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    marginBottom: 24,
    textAlign: "center",
    color: "#128AFA",
  },
  logo: {
    width: 260,
    height: 260,
    alignSelf: "center",
    marginBottom: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 12,
    fontSize: 16,
  },
  button: {
    backgroundColor: "#128AFA",
    paddingVertical: 14,
    borderRadius: 8,
    marginTop: 8,
  },
  buttonText: {
    color: "#fff",
    textAlign: "center",
    fontWeight: "600",
    fontSize: 16,
  },
  linkText: {
    textAlign: "center",
    color: "#6b7280",
    marginTop: 16,
  },
  linkHighlight: {
    color: "#128AFA",
    fontWeight: "600",
  },
});
