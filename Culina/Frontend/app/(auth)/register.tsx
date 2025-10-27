import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  ScrollView,
  Platform,
  KeyboardAvoidingView,
} from "react-native";
import { Picker } from "@react-native-picker/picker";
import { useRouter } from "expo-router";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { auth, db } from "@/lib/firebaseConfig";
import { doc, setDoc } from "firebase/firestore";
import { Mail, User, Lock, Eye, EyeOff } from "lucide-react-native";
import Background from "@/components/Background";
import { registerStyles as styles } from "@/styles/auth/registerStyles";

const ALLERGY_OPTIONS = [
  "Peanuts",
  "Tree Nuts",
  "Shellfish",
  "Fish",
  "Eggs",
  "Milk",
  "Soy",
  "Wheat",
  "Sesame",
  "Gluten",
];

export default function RegisterScreen() {
  const router = useRouter();

  // Account fields
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Preferences fields
  const [diet, setDiet] = useState("");
  const [religiousPreference, setReligiousPreference] = useState("");
  const [calories, setCalories] = useState("");
  const [allergies, setAllergies] = useState<string[]>([]);

  const toggleAllergy = (value: string) => {
    setAllergies((prev) =>
      prev.includes(value) ? prev.filter((item) => item !== value) : [...prev, value]
    );
  };

  const handleRegister = async () => {
    if (!email || !username || !password || !confirm || !diet || !religiousPreference || !calories)
      return Alert.alert("Please fill in all fields");

    if (password !== confirm)
      return Alert.alert("Passwords do not match");

    try {
      const userCred = await createUserWithEmailAndPassword(auth, email.trim(), password);
      await updateProfile(userCred.user, { displayName: username.trim() });

      await setDoc(doc(db, "users", userCred.user.uid), {
        username: username.trim(),
        email: email.trim(),
        preferences: {
          diet,
          religiousPreference,
          caloriePlan: calories,
          allergies,
        },
        createdAt: new Date(),
        hasCompletedOnboarding: false,
      });

      Alert.alert("Success", "Account created successfully!");
      router.replace("/(auth)/onboarding");
    } catch (err: any) {
      console.error(err);
      Alert.alert("Registration failed", err.message);
    }
  };

  return (
    <Background>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 80 : 0}
      >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
      <Text style={styles.title}>Create your account!</Text>

      {/* Account Information */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account Information</Text>

        {/* Email Input with Icon */}
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

        {/* Username Input with Icon */}
        <View style={styles.inputContainer}>
          <User size={20} color="#6b7280" style={styles.inputIcon} />
          <TextInput
            placeholder="Username"
            value={username}
            onChangeText={setUsername}
            style={styles.inputWithIcon}
          />
        </View>

        {/* Password Input with Icon and Toggle */}
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

        {/* Confirm Password Input with Icon and Toggle */}
        <View style={styles.inputContainer}>
          <Lock size={20} color="#6b7280" style={styles.inputIcon} />
          <TextInput
            placeholder="Confirm Password"
            secureTextEntry={!showConfirmPassword}
            value={confirm}
            onChangeText={setConfirm}
            style={styles.inputWithIcon}
          />
          <TouchableOpacity
            onPress={() => setShowConfirmPassword(!showConfirmPassword)}
            style={styles.eyeIcon}
          >
            {showConfirmPassword ? (
              <EyeOff size={20} color="#6b7280" />
            ) : (
              <Eye size={20} color="#6b7280" />
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Allergies */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Allergies</Text>
        <Text style={styles.helperText}>Tap to select or deselect.</Text>
        <View style={styles.checkboxList}>
          {ALLERGY_OPTIONS.map((option) => {
            const checked = allergies.includes(option);
            return (
              <TouchableOpacity
                key={option}
                onPress={() => toggleAllergy(option)}
                style={styles.checkboxRow}
              >
                <View style={[styles.checkboxBox, checked && styles.checkboxBoxChecked]}>
                  {checked && <Text style={styles.checkboxMark}>✓</Text>}
                </View>
                <Text style={styles.checkboxLabel}>{option}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Preferences */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Preferences</Text>

        <View style={styles.pickerContainer}>
          <Text style={styles.pickerLabel}>Dietary Preference</Text>
          <View style={styles.pickerWrapper}>
            <Picker
              selectedValue={diet}
              onValueChange={(itemValue) => setDiet(itemValue)}
              style={styles.picker}
            >
              <Picker.Item label="Select dietary preference..." value="" />
              <Picker.Item label="No Restriction" value="none" />
              <Picker.Item label="Vegetarian" value="vegetarian" />
              <Picker.Item label="Vegan" value="vegan" />
              <Picker.Item label="Pescatarian" value="pescatarian" />
              <Picker.Item label="Keto" value="keto" />
              <Picker.Item label="Paleo" value="paleo" />
              <Picker.Item label="Low Carb" value="low-carb" />
              <Picker.Item label="Gluten Free" value="gluten-free" />
            </Picker>
          </View>
        </View>

        <View style={styles.pickerContainer}>
          <Text style={styles.pickerLabel}>Religious Preference</Text>
          <View style={styles.pickerWrapper}>
            <Picker
              selectedValue={religiousPreference}
              onValueChange={(itemValue) => setReligiousPreference(itemValue)}
              style={styles.picker}
            >
              <Picker.Item label="Select religious preference..." value="" />
              <Picker.Item label="None" value="none" />
              <Picker.Item label="Halal" value="halal" />
              <Picker.Item label="Kosher" value="kosher" />
              <Picker.Item label="Hindu" value="hindu" />
              <Picker.Item label="Buddhist" value="buddhist" />
            </Picker>
          </View>
        </View>

        <View style={styles.pickerContainer}>
          <Text style={styles.pickerLabel}>Daily Calorie Goal</Text>
          <View style={styles.pickerWrapper}>
            <Picker
              selectedValue={calories}
              onValueChange={(itemValue) => setCalories(itemValue)}
              style={styles.picker}
            >
              <Picker.Item label="Select calorie goal..." value="" />
              <Picker.Item label="1200 kcal/day (Weight Loss)" value="1200" />
              <Picker.Item label="1500 kcal/day (Light Loss)" value="1500" />
              <Picker.Item label="1800 kcal/day (Maintenance)" value="1800" />
              <Picker.Item label="2000 kcal/day (Moderate)" value="2000" />
              <Picker.Item label="2200 kcal/day (Active)" value="2200" />
              <Picker.Item label="2500 kcal/day (Very Active)" value="2500" />
              <Picker.Item label="3000 kcal/day (Athlete)" value="3000" />
            </Picker>
          </View>
        </View>
      </View>

      <TouchableOpacity onPress={handleRegister} style={styles.button}>
        <Text style={styles.buttonText}>Register</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => router.push("/login")}>
        <Text style={styles.linkText}>
          Already have an account?{" "}
          <Text style={styles.linkHighlight}>Log in</Text>
        </Text>
      </TouchableOpacity>
      </ScrollView>
      </KeyboardAvoidingView>
    </Background>
  );
}
