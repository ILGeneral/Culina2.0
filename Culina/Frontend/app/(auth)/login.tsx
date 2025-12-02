import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableWithoutFeedback,
  Keyboard,
} from "react-native";
import { useRouter } from "expo-router";
import { signInWithEmailAndPassword, onAuthStateChanged } from "firebase/auth";
import { auth, db } from "@/lib/firebaseConfig";
import { doc, getDoc } from "firebase/firestore";
import { Mail, Lock, Eye, EyeOff, CheckSquare, Square } from "lucide-react-native";
import Background from "@/components/Background";
import { loginStyles as styles } from "@/styles/auth/loginStyles";
import AsyncStorage from "@react-native-async-storage/async-storage";

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  // Check if user is already logged in on mount and load saved credentials if Remember Me was checked
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    const checkLoginStatus = async () => {
      try {
        // Use onAuthStateChanged to properly wait for Firebase Auth to initialize
        unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
          if (currentUser) {
            // User is signed in, redirect appropriately
            try {
              const userDocRef = doc(db, "users", currentUser.uid);
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
            } catch (error) {
              console.error("Error fetching user data:", error);
            }
          } else {
            // User is signed out, load saved credentials if Remember Me was checked
            const savedEmail = await AsyncStorage.getItem("@saved_email");
            const savedPassword = await AsyncStorage.getItem("@saved_password");
            const rememberMeStatus = await AsyncStorage.getItem("@remember_me");

            if (savedEmail && savedPassword && rememberMeStatus === "true") {
              setEmail(savedEmail);
              setPassword(savedPassword);
              setRememberMe(true);
            }
          }
        });
      } catch (error) {
        console.error("Error checking login status:", error);
      }
    };

    checkLoginStatus();

    // Cleanup subscription on unmount
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, []);

  const handleLogin = async () => {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Save email and password ONLY if "Remember Me" is checked (for auto-fill)
      if (rememberMe) {
        await AsyncStorage.setItem("@saved_email", email);
        await AsyncStorage.setItem("@saved_password", password);
        await AsyncStorage.setItem("@remember_me", "true");
      } else {
        // Clear saved credentials if Remember Me is not checked
        await AsyncStorage.removeItem("@saved_email");
        await AsyncStorage.removeItem("@saved_password");
        await AsyncStorage.removeItem("@remember_me");
      }

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
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <ScrollView
            contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
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

              <TouchableOpacity
                onPress={() => setRememberMe(!rememberMe)}
                style={styles.rememberMeContainer}
              >
                {rememberMe ? (
                  <CheckSquare size={20} color="#128AFA" />
                ) : (
                  <Square size={20} color="#6b7280" />
                )}
                <Text style={styles.rememberMeText}>Remember Me</Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={handleLogin} style={styles.button}>
                <Text style={styles.buttonText}>Login</Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={() => router.push("/(auth)/register" as unknown as never)}>
                <Text style={styles.linkText}>
                  Don't have an account? <Text style={styles.linkHighlight}>Sign up!</Text>
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </Background>
  );
}