import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  Animated,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { LogOut, AlertTriangle, Edit3 } from "lucide-react-native";
import { auth, db } from "@/lib/firebaseConfig";
import { signOut, onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { useRouter, useFocusEffect, useLocalSearchParams } from "expo-router";

export default function ProfileScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [user, setUser] = useState<any>(null);
  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Toast animation
  const [toastMessage, setToastMessage] = useState("");
  const [toastColor, setToastColor] = useState("#128AFA");
  const fadeAnim = useState(new Animated.Value(0))[0];

  // Refresh data on focus
  useFocusEffect(
    useCallback(() => {
      const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
        setUser(currentUser);
        if (currentUser) await fetchUserData(currentUser.uid);
        else setLoading(false);
      });

      // Show toast once then clear params
      if (params.toastMessage) {
        const toastType = params.toastType === "error" ? "#DC2626" : "#16a34a";
        showToast(String(params.toastMessage), toastType);

        // Clear the params to prevent repeated display
        router.setParams({});
      }

      return () => unsubscribe();
    }, [params])
  );

  const showToast = (message: string, color: string) => {
    setToastMessage(message);
    setToastColor(color);
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      setTimeout(() => {
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }).start(() => setToastMessage(""));
      }, 2000);
    });
  };

  const fetchUserData = async (uid: string) => {
    try {
      const docRef = doc(db, "users", uid);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) setUserData(docSnap.data());
    } catch (error) {
      console.error("Error fetching user data:", error);
      showToast("❌ Failed to load profile", "#DC2626");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    router.replace("/login");
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#128AFA" />
        <Text style={{ color: "#6b7280", marginTop: 8 }}>
          Loading your profile...
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* HEADER */}
        <LinearGradient
          colors={["#128AFA", "#6EC4FF"]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={styles.headerGradient}
        >
          <View style={styles.avatarContainer}>
            <Image
              source={{
                uri:
                  user?.photoURL ||
                  "https://cdn-icons-png.flaticon.com/512/847/847969.png",
              }}
              style={styles.avatar}
            />
          </View>
          <Text style={styles.username}>
            {userData?.username || user?.displayName || "User"}
          </Text>
          <Text style={styles.email}>
            {userData?.email || user?.email || "No email"}
          </Text>
        </LinearGradient>

        {/* DETAILS CARD */}
        <LinearGradient
          colors={["#128AFA", "#6EC4FF"]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={styles.infoCard}
        >
          <Text style={styles.sectionTitle}>Your Preferences</Text>
          <Text style={styles.infoText}>
            🥗 Dietary Preference:{" "}
            <Text style={styles.highlight}>
              {userData?.preferences?.diet || "Not set"}
            </Text>
          </Text>
          <Text style={styles.infoText}>
            🔥 Calorie Plan:{" "}
            <Text style={styles.highlight}>
              {userData?.preferences?.caloriePlan
                ? `${userData.preferences.caloriePlan} kcal/day`
                : "Not set"}
            </Text>
          </Text>

          <TouchableOpacity
            onPress={() =>
              router.push({
                pathname: "/editProfile",
                params: { fromProfile: "true" },
              })
            }
            style={styles.editButton}
          >
            <Edit3 color="#0056B8FF" size={20} />
            <Text style={styles.editText}>Edit Profile</Text>
          </TouchableOpacity>
        </LinearGradient>

        {/* SUPPORT + LOGOUT */}
        <TouchableOpacity
          onPress={() => router.push("/report")}
          style={[styles.actionButton, { backgroundColor: "#BB3939FF" }]}
        >
          <AlertTriangle color="#fff" size={20} />
          <Text style={styles.actionText}>Report an Issue</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleLogout}
          style={[styles.actionButton, { backgroundColor: "#4b5563" }]}
        >
          <LogOut color="#fff" size={20} />
          <Text style={styles.actionText}>Logout</Text>
        </TouchableOpacity>

        <Text style={styles.footer}>Culina 2.0 © 2025</Text>
      </ScrollView>

      {/* Toast */}
      {toastMessage ? (
        <Animated.View
          style={[
            styles.toast,
            { backgroundColor: toastColor, opacity: fadeAnim },
          ]}
        >
          <Text style={styles.toastText}>{toastMessage}</Text>
        </Animated.View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
  },
  headerGradient: {
    alignItems: "center",
    paddingVertical: 40,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  avatarContainer: {
    borderWidth: 3,
    borderColor: "#fff",
    borderRadius: 80,
    padding: 3,
    marginBottom: 12,
  },
  avatar: { width: 100, height: 100, borderRadius: 80 },
  username: { fontSize: 22, fontWeight: "bold", color: "#fff" },
  email: { color: "#EDFEFFFF", fontSize: 14 },
  infoCard: {
    backgroundColor: "#E9FCFFFF",
    marginHorizontal: 20,
    marginTop: 20,
    borderRadius: 20,
    padding: 20,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#DAEBFFFF",
    marginBottom: 8,
  },
  infoText: { fontSize: 15, color: "#DAEBFFFF", marginTop: 4 },
  highlight: { color: "#DAEBFFFF", fontWeight: "600" },
  editButton: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 16,
    backgroundColor: "#DFF6FFFF",
    paddingVertical: 10,
    borderRadius: 10,
    justifyContent: "center",
  },
  editText: { color: "#163865FF", fontWeight: "600", marginLeft: 6 },
  actionButton: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginHorizontal: 20,
    marginTop: 16,
    borderRadius: 12,
    paddingVertical: 14,
  },
  actionText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 8,
  },
  footer: {
    textAlign: "center",
    color: "#9ca3af",
    marginVertical: 20,
  },
  toast: {
    position: "absolute",
    bottom: 50,
    alignSelf: "center",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 25,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 5,
  },
  toastText: { color: "#fff", fontWeight: "600", fontSize: 14 },
});
