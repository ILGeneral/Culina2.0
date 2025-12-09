import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  ScrollView,
  ActivityIndicator,
  Image,
  Modal,
} from "react-native";
import { Picker } from "@react-native-picker/picker";
import { useRouter } from "expo-router";
import { auth, db } from "@/lib/firebaseConfig";
import { doc, getDoc, updateDoc, collection, query, where, getDocs, writeBatch } from "firebase/firestore";
import { updateProfile, User } from "firebase/auth";
import { Camera } from "lucide-react-native";
import Background from "@/components/Background";
import styles from "@/styles/editProfile/styles";
import AvatarPicker from "@/components/AvatarPicker";

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

export default function EditProfileScreen() {
  const router = useRouter();
  const user = auth.currentUser as User | null;

  const [username, setUsername] = useState("");
  const [diet, setDiet] = useState("");
  const [religiousPreference, setReligiousPreference] = useState("");
  const [calories, setCalories] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [allergies, setAllergies] = useState<string[]>([]);
  const [showAllergyList, setShowAllergyList] = useState(false);
  const [profilePicture, setProfilePicture] = useState<string>("");
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);

  const toggleAllergy = (value: string) => {
    setAllergies((prev) =>
      prev.includes(value) ? prev.filter((item) => item !== value) : [...prev, value]
    );
  };

  useEffect(() => {
    const currentUser = auth.currentUser as User | null;
    if (!currentUser) {
      setLoading(false);
      Alert.alert("Error", "No user is currently logged in.");
      return;
    }
    fetchData(currentUser.uid);
  }, []);

  const fetchData = async (uid: string) => {
    try {
      const docRef = doc(db, "users", uid);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        setUsername(data?.username || "");
        setDiet(data?.preferences?.diet || "");
        setReligiousPreference(data?.preferences?.religiousPreference || "");
        setCalories(data?.preferences?.caloriePlan || "");
        setAllergies(data?.preferences?.allergies ?? []);
        setProfilePicture(data?.profilePicture || user?.photoURL || "");
      } else {
        setProfilePicture(user?.photoURL || "");
      }
    } catch (error) {
      console.error("Error fetching user data:", error);
      Alert.alert("Error", "Failed to load user data.");
    } finally {
      setLoading(false);
    }
  };

  const handleSelectAvatar = async (avatarUrl: string) => {
    if (!user) return;

    try {
      // Update local state
      setProfilePicture(avatarUrl);

      // Update Firestore
      const docRef = doc(db, 'users', user.uid);
      await updateDoc(docRef, {
        profilePicture: avatarUrl,
      });

      // Update Firebase Auth profile
      await updateProfile(user, {
        photoURL: avatarUrl,
      });

      // Update all shared recipes with new profile picture
      try {
        await updateSharedRecipesProfile(username, avatarUrl);
      } catch (sharedRecipeError) {
        // Log but don't fail the entire operation if shared recipes update fails
        console.error('Error updating shared recipes:', sharedRecipeError);
      }

      Alert.alert('Success', 'Profile picture updated!');
    } catch (error: any) {
      console.error('Error updating profile picture:', error);
      Alert.alert('Error', 'Failed to update profile picture. Please try again.');
    }
  };

  const updateSharedRecipesProfile = async (newUsername: string, newProfilePicture: string) => {
    if (!user) return;

    try {
      // Query all shared recipes by this user
      const sharedRecipesRef = collection(db, 'sharedRecipes');
      const q = query(sharedRecipesRef, where('userId', '==', user.uid));
      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        return; // No shared recipes to update
      }

      // Batch update all shared recipes
      const batch = writeBatch(db);
      snapshot.docs.forEach((docSnap) => {
        const recipeRef = doc(db, 'sharedRecipes', docSnap.id);
        batch.update(recipeRef, {
          authorUsername: newUsername,
          authorProfilePicture: newProfilePicture,
        });
      });

      await batch.commit();
    } catch (error) {
      console.error('Error updating shared recipes:', error);
      // Don't throw - this is a non-critical update
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

      await updateDoc(docRef, {
        username: username.trim(),
        "preferences.diet": diet,
        "preferences.religiousPreference": religiousPreference,
        "preferences.caloriePlan": calories,
        "preferences.allergies": allergies,
      });

      await updateProfile(user, { displayName: username.trim() });

      // Update all shared recipes with new username and profile picture
      await updateSharedRecipesProfile(username.trim(), profilePicture);

      Alert.alert("Success", "Profile updated successfully!", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch (error) {
      console.error("Error updating profile:", error);
      Alert.alert("Error", "Failed to update profile. Please try again.");
      router.replace("/profile");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Background>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#128AFA" />
          <Text style={{ color: "#6b7280", marginTop: 8 }}>Loading...</Text>
        </View>
      </Background>
    );
  }

  return (
    <Background>
      <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
        <Text style={styles.title}>Edit Profile</Text>

        {/* Profile Picture Section */}
        <View style={styles.profilePictureSection}>
          <Text style={styles.label}>Profile Picture</Text>
          <View style={styles.profilePictureContainer}>
            <Image
              source={{
                uri: profilePicture || `https://api.dicebear.com/7.x/avataaars/png?seed=${user?.uid}&size=200`
              }}
              style={styles.profilePictureImage}
              onError={(error) => {
                console.warn('Failed to load profile picture:', error);
              }}
            />
            <TouchableOpacity
              style={styles.profilePictureButton}
              onPress={() => setShowAvatarPicker(true)}
            >
              <Camera size={20} color="#fff" />
            </TouchableOpacity>
          </View>

          <Text style={styles.profilePictureHint}>
            Tap the camera icon to choose an avatar
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Username</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter your username"
            value={username}
            onChangeText={setUsername}
          />
        </View>

        <View style={styles.section}>
          <TouchableOpacity
            style={styles.dropdownToggle}
            onPress={() => setShowAllergyList((prev) => !prev)}
          >
            <Text style={styles.dropdownLabel}>
              {showAllergyList ? "Hide Allergies" : "Show Allergies"}
            </Text>
            <Text style={styles.dropdownChevron}>{showAllergyList ? "▲" : "▼"}</Text>
          </TouchableOpacity>
          {showAllergyList && (
            <View style={styles.checkboxList}>
              {ALLERGY_OPTIONS.map((option) => {
                const checked = allergies.includes(option);
                return (
                  <TouchableOpacity
                    key={option}
                    style={styles.checkboxRow}
                    onPress={() => toggleAllergy(option)}
                  >
                    <View style={[styles.checkboxBox, checked && styles.checkboxBoxChecked]}>
                      {checked && <Text style={styles.checkboxMark}>✓</Text>}
                    </View>
                    <Text style={styles.checkboxLabel}>{option}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>

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

        <View style={styles.section}>
          <Text style={styles.label}>Religious Preference</Text>
          <View style={styles.pickerWrapper}>
            <Picker
              selectedValue={religiousPreference}
              onValueChange={setReligiousPreference}
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

        <TouchableOpacity onPress={handleSave} disabled={saving} style={styles.saveButton}>
          <Text style={styles.saveButtonText}>{saving ? "Saving..." : "Save Changes"}</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Avatar Picker Modal */}
      {showAvatarPicker && (
        <Modal
          visible={showAvatarPicker}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowAvatarPicker(false)}
        >
          <AvatarPicker
            onSelect={handleSelectAvatar}
            onClose={() => setShowAvatarPicker(false)}
            currentAvatar={profilePicture}
          />
        </Modal>
      )}
    </Background>
  );
}
