import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { Picker } from "@react-native-picker/picker";
import { useRouter } from "expo-router";
import { auth, db } from "@/lib/firebaseConfig";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { updateProfile, User } from "firebase/auth";

export default function EditProfileScreen() {
  const router = useRouter();
  const user = auth.currentUser as User | null;

  const [username, setUsername] = useState("");
  const [diet, setDiet] = useState("");
  const [calories, setCalories] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) {
      fetchData(user.uid);
    } else {
      setLoading(false);
      Alert.alert("Error", "No user is currently logged in.");
    }
  }, [user]);

  const fetchData = async (uid: string) => {
    try {
      const docRef = doc(db, "users", uid);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        setUsername(data?.username || "");
        setDiet(data?.preferences?.diet || "");
        setCalories(data?.preferences?.caloriePlan || "");
      }
    } catch (error) {
      console.error("Error fetching user data:", error);
      Alert.alert("Error", "Failed to load user data.");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!user) {
      Alert.alert("Error", "No authenticated user found.");
      return;
    }

    if (!username.trim()) {
      Alert.alert("Error", "Username cannot be empty.");
      return;
    }

    try {
      setSaving(true);

      const docRef = doc(db, "users", user.uid);

      // Update Firestore fields
      await updateDoc(docRef, {
        username: username.trim(),
        "preferences.diet": diet,
        "preferences.caloriePlan": calories,
      });

      // Update Firebase Auth display name
      await updateProfile(user, { displayName: username.trim() });

      // Navigate back with toast success message
      router.replace({
        pathname: "/(tabs)/profile",
        params: {
          toastMessage: "Profile updated successfully!",
          toastType: "success",
        },
      });
    } catch (error) {
      console.error("Error updating profile:", error);

      // ❌ Navigate back with error toast message
      router.replace({
        pathname: "/(tabs)/profile",
        params: {
          toastMessage: "Failed to update profile. Please try again.",
          toastType: "error",
        },
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#128AFA" />
        <Text style={{ color: "#6b7280", marginTop: 8 }}>Loading...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 24 }}>
      <Text style={styles.title}>Edit Profile</Text>

      {/* Username */}
      <View style={styles.section}>
        <Text style={styles.label}>Username</Text>
        <TextInput
          style={styles.input}
          placeholder="Enter your username"
          value={username}
          onChangeText={setUsername}
        />
      </View>

      {/* Dietary Preference */}
      <View style={styles.section}>
        <Text style={styles.label}>Dietary Preference</Text>
        <View style={styles.pickerWrapper}>
          <Picker selectedValue={diet} onValueChange={setDiet} style={styles.picker}>
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

      {/* Calorie Plan */}
      <View style={styles.section}>
        <Text style={styles.label}>Daily Calorie Goal</Text>
        <View style={styles.pickerWrapper}>
          <Picker selectedValue={calories} onValueChange={setCalories} style={styles.picker}>
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

      {/* Save Button */}
      <TouchableOpacity
        onPress={handleSave}
        style={[styles.saveButton, saving && { opacity: 0.7 }]}
        disabled={saving}
      >
        {saving ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.saveText}>Save Changes</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#128AFA",
    textAlign: "center",
    marginBottom: 24,
  },
  section: { marginBottom: 20 },
  label: {
    fontSize: 14,
    fontWeight: "500",
    color: "#374151",
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: "#fff",
  },
  pickerWrapper: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    backgroundColor: "#fff",
    marginBottom: 16,
  },
  picker: {
    height: Platform.OS === "ios" ? 180 : 50,
  },
  saveButton: {
    backgroundColor: "#128AFA",
    paddingVertical: 16,
    borderRadius: 8,
    marginTop: 10,
    alignItems: "center",
  },
  saveText: {
    color: "#fff",
    textAlign: "center",
    fontWeight: "600",
    fontSize: 18,
  },
});
