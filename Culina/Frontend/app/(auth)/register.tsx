import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  ScrollView,
  StyleSheet,
  Platform,
} from "react-native";
import { Picker } from "@react-native-picker/picker";
import { useRouter } from "expo-router";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { auth, db } from "@/lib/firebaseConfig";
import { doc, setDoc } from "firebase/firestore";
import Background from "@/components/Background";

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

  // Step 1 fields
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  // Step 2 fields
  const [diet, setDiet] = useState("");
  const [religion, setReligion] = useState("");
  const [calories, setCalories] = useState("");
  const [allergies, setAllergies] = useState<string[]>([]);

  const toggleAllergy = (value: string) => {
    setAllergies((prev) =>
      prev.includes(value) ? prev.filter((item) => item !== value) : [...prev, value]
    );
  };

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
          allergies,
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
    <Background>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
      <Text style={styles.title}>Create your account!</Text>

      {/* Step 1: Account Info */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account Information</Text>

        <TextInput
          placeholder="Email"
          value={email}
          onChangeText={setEmail}
          style={styles.input}
          autoCapitalize="none"
          keyboardType="email-address"
        />

        <TextInput
          placeholder="Username"
          value={username}
          onChangeText={setUsername}
          style={styles.input}
        />

        <TextInput
          placeholder="Password"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          style={styles.input}
        />

        <TextInput
          placeholder="Confirm Password"
          secureTextEntry
          value={confirm}
          onChangeText={setConfirm}
          style={styles.input}
        />
      </View>

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

      {/* Step 2: Preferences */}
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
              selectedValue={religion}
              onValueChange={(itemValue) => setReligion(itemValue)}
              style={styles.picker}
            >
              <Picker.Item label="Select religious preference..." value="" />
              <Picker.Item label="No Restriction" value="none" />
              <Picker.Item label="Halal" value="halal" />
              <Picker.Item label="Kosher" value="kosher" />
              <Picker.Item label="Hindu (No Beef)" value="hindu" />
              <Picker.Item label="Buddhist (Vegetarian)" value="buddhist" />
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
    </Background>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 24,
    paddingVertical: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 24,
    color: "#16a34a",
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 12,
    color: "#1f2937",
  },
  helperText: {
    color: "#6b7280",
    marginBottom: 8,
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
    backgroundColor: "#16a34a",
    paddingVertical: 16,
    borderRadius: 8,
    marginTop: 8,
  },
  buttonText: {
    color: "#fff",
    textAlign: "center",
    fontWeight: "600",
    fontSize: 18,
  },
  linkText: {
    textAlign: "center",
    color: "#6b7280",
    marginTop: 16,
  },
  linkHighlight: {
    color: "#16a34a",
    fontWeight: "600",
  },
  pickerContainer: {
    marginBottom: 16,
  },
  pickerLabel: {
    fontSize: 14,
    fontWeight: "500",
    color: "#374151",
    marginBottom: 8,
  },
  pickerWrapper: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    backgroundColor: "#fff",
    overflow: "hidden",
  },
  picker: {
    height: Platform.OS === "ios" ? 180 : 50,
  },
  allergyList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 12,
  },
  allergyChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#dcfce7",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  allergyText: {
    color: "#166534",
    fontWeight: "600",
    marginRight: 6,
  },
  allergyRemove: {
    color: "#166534",
    fontWeight: "700",
    fontSize: 16,
  },
  checkboxList: {
    gap: 10,
  },
  checkboxRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
  },
  checkboxBox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: "#16a34a",
    marginRight: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  checkboxBoxChecked: {
    backgroundColor: "#16a34a",
  },
  checkboxMark: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 14,
  },
  checkboxLabel: {
    fontSize: 16,
    color: "#1f2937",
  },
});
