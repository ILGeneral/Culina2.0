import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, Alert } from "react-native";
import { useRouter } from "expo-router";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebaseConfig";

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = async () => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
      router.replace("/onboarding");
    } catch (err: any) {
      Alert.alert("Login failed", err.message);
    }
  };

  return (
    <View className="flex-1 justify-center px-6 bg-white">
      <Text className="text-2xl font-bold mb-6 text-center">Welcome back</Text>

      <TextInput
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        className="border border-gray-300 rounded-lg px-4 py-2 mb-3"
      />
      <TextInput
        placeholder="Password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
        className="border border-gray-300 rounded-lg px-4 py-2 mb-5"
      />

      <TouchableOpacity onPress={handleLogin} className="bg-green-600 py-3 rounded-lg">
        <Text className="text-white text-center font-semibold">Login</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => router.push("/register")}>
        <Text className="text-center text-gray-600 mt-4">
          Don't have an account? <Text className="text-green-600">Sign up</Text>
        </Text>
      </TouchableOpacity>
    </View>
  );
}
