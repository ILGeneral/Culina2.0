import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth, db } from "@/lib/firebaseConfig";
import { doc, getDoc } from "firebase/firestore";
import { Mail, Lock, Eye, EyeOff } from "lucide-react-native";
import Background from "@/components/Background";
import { loginStyles as styles } from "@/styles/auth/loginStyles";

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async () => {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      const userDocRef = doc(db, "users", user.uid);
      const userDoc = await getDoc(userDocRef);

      if (userDoc.exists()) {
        const userData = userDoc.data();
        const hasCompletedOnboarding = userData?.hasCompletedOnboarding ?? false;

        if (hasCompletedOnboarding) {
          router.replace("/(tabs)/home");
        } else {
          router.replace("/(auth)/onboarding");
        }
      } else {
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

      <View style={styles.inputContainer}>
        <Mail size={20} color="#6b7280" style={styles.inputIcon} />
        <TextInput
          placeholder="Email"
          value={email}
          onChangeText={setEmail}
          style={styles.inputWithIcon}
          autoCapitalize="none"
          keyboardType="email-address"
        />
      </View>

      <View style={styles.inputContainer}>
        <Lock size={20} color="#6b7280" style={styles.inputIcon} />
        <TextInput
          placeholder="Password"
          secureTextEntry={!showPassword}
          value={password}
          onChangeText={setPassword}
          style={styles.inputWithIcon}
        />
        <TouchableOpacity
          onPress={() => setShowPassword(!showPassword)}
          style={styles.eyeIcon}
        >
          {showPassword ? (
            <EyeOff size={20} color="#6b7280" />
          ) : (
            <Eye size={20} color="#6b7280" />
          )}
        </TouchableOpacity>
      </View>

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
