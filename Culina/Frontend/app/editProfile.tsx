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
} from "react-native";
import { Picker } from "@react-native-picker/picker";
import { useRouter } from "expo-router";
import { auth, db } from "@/lib/firebaseConfig";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { updateProfile, User } from "firebase/auth";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system";
import { Camera } from "lucide-react-native";
import Background from "@/components/Background";
import styles from "@/styles/editProfile/styles";

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
  const [tempProfilePicture, setTempProfilePicture] = useState<string>("");
  const [showImagePreview, setShowImagePreview] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

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

  const handlePickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (status !== 'granted') {
        Alert.alert(
          'Permission Required',
          'Please enable photo library access in your device settings.'
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        // Store temporarily and show preview
        setTempProfilePicture(result.assets[0].uri);
        setShowImagePreview(true);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to select image.');
    }
  };

  const handleCancelImage = () => {
    setTempProfilePicture("");
    setShowImagePreview(false);
  };

  const handleConfirmImage = async () => {
    if (!tempProfilePicture) return;
    await uploadProfilePicture(tempProfilePicture);
    setShowImagePreview(false);
  };

  const uploadProfilePicture = async (uri: string) => {
    if (!user) return;

    try {
      setUploadingImage(true);

      // For now, we'll use a placeholder that uses the image URI
      // In a production app, you would upload to Firebase Storage or another cloud storage service
      const imageUrl = uri; // Direct use of local URI for demonstration

      // Update local state
      setProfilePicture(imageUrl);

      // Update Firestore
      const docRef = doc(db, 'users', user.uid);
      await updateDoc(docRef, {
        profilePicture: imageUrl,
      });

      // Update Firebase Auth profile
      await updateProfile(user, {
        photoURL: imageUrl,
      });

      Alert.alert('Success', 'Profile picture updated!');
    } catch (error) {
      console.error('Error uploading profile picture:', error);
      Alert.alert('Error', 'Failed to update profile picture. Please try again.');
    } finally {
      setUploadingImage(false);
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

      Alert.alert("Success", "Profile updated successfully!", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch (error) {
      console.error("Error updating profile:", error);
      Alert.alert("Error", "Failed to update profile. Please try again.");
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
                uri: (showImagePreview ? tempProfilePicture : profilePicture) || "https://avatar.iran.liara.run/public"
              }}
              style={styles.profilePictureImage}
            />
            {!showImagePreview && (
              <TouchableOpacity
                style={styles.profilePictureButton}
                onPress={handlePickImage}
                disabled={uploadingImage}
              >
                {uploadingImage ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Camera size={20} color="#fff" />
                )}
              </TouchableOpacity>
            )}
          </View>

          {showImagePreview ? (
            <View style={styles.imageActionButtons}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={handleCancelImage}
                disabled={uploadingImage}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.confirmButton}
                onPress={handleConfirmImage}
                disabled={uploadingImage}
              >
                {uploadingImage ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.confirmButtonText}>Confirm</Text>
                )}
              </TouchableOpacity>
            </View>
          ) : (
            <Text style={styles.profilePictureHint}>
              Tap the camera icon to change your profile picture
            </Text>
          )}
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
    </Background>
  );
}
