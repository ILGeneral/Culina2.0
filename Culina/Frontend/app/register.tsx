import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, Alert, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { auth, db } from "@/lib/firebaseConfig";
import { doc, setDoc } from "firebase/firestore";

export default function RegisterScreen() {
  const router = useRouter();

  // Step 1 fields
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  // Step 2 fields
  const [diet, setDiet] = useState("");
  const [religion, setReligion] = useState("");
  const [calories, setCalories] = useState("");

  const handleRegister = async () => {
    if (!email || !username || !password || !confirm || !diet || !religion || !calories)
      return Alert.alert("Please fill in all fields");

    if (password !== confirm)
      return Alert.alert("Passwords do not match");

    try {
      // 1️⃣ Create Firebase Auth account
      const userCred = await createUserWithEmailAndPassword(auth, email.trim(), password);
      await updateProfile(userCred.user, { displayName: username.trim() });

      // 2️⃣ Create Firestore document for user
      await setDoc(doc(db, "users", userCred.user.uid), {
        username: username.trim(),
        email: email.trim(),
        preferences: {
          diet,
          religion,
          caloriePlan: calories,
        },
        createdAt: new Date(),
      });

      Alert.alert("Success", "Account created successfully!");
      router.replace("/onboarding");
    } catch (err: any) {
      console.error(err);
      Alert.alert("Registration failed", err.message);
    }
  };

  return (
    <ScrollView className="flex-1 bg-white px-6 py-10">
      <Text className="text-3xl font-bold text-center mb-6 text-green-700">
        Create your Culina account 🍳
      </Text>

      {/* Step 1: Account Info */}
      <View className="mb-6">
        <Text className="text-lg font-semibold mb-2">Account Information</Text>

        <TextInput
          placeholder="Email"
          value={email}
          onChangeText={setEmail}
          className="border border-gray-300 rounded-lg px-4 py-2 mb-3"
        />

        <TextInput
          placeholder="Username"
          value={username}
          onChangeText={setUsername}
          className="border border-gray-300 rounded-lg px-4 py-2 mb-3"
        />

        <TextInput
          placeholder="Password"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          className="border border-gray-300 rounded-lg px-4 py-2 mb-3"
        />

        <TextInput
          placeholder="Confirm Password"
          secureTextEntry
          value={confirm}
          onChangeText={setConfirm}
          className="border border-gray-300 rounded-lg px-4 py-2"
        />
      </View>

      {/* Step 2: Preferences */}
      <View className="mb-6">
        <Text className="text-lg font-semibold mb-2">Preferences</Text>

        <TextInput
          placeholder="Dietary Preference (e.g. Vegan, Keto)"
          value={diet}
          onChangeText={setDiet}
          className="border border-gray-300 rounded-lg px-4 py-2 mb-3"
        />

        <TextInput
          placeholder="Religious Preference (e.g. Halal, Kosher)"
          value={religion}
          onChangeText={setReligion}
          className="border border-gray-300 rounded-lg px-4 py-2 mb-3"
        />

        <TextInput
          placeholder="Calorie Plan (e.g. 2000 kcal/day)"
          value={calories}
          onChangeText={setCalories}
          className="border border-gray-300 rounded-lg px-4 py-2"
        />
      </View>

      <TouchableOpacity
        onPress={handleRegister}
        className="bg-green-600 py-4 rounded-lg"
      >
        <Text className="text-white text-center font-semibold text-lg">Register</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => router.push("/login")}>
        <Text className="text-center text-gray-600 mt-4">
          Already have an account?{" "}
          <Text className="text-green-700 font-semibold">Log in</Text>
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}
