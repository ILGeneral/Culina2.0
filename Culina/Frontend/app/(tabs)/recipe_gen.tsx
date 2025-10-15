import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { auth, db } from "@/lib/firebaseConfig";
import {
  collection,
  getDocs,
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";
import { generateRecipe } from "@/lib/generateRecipe";
import type { Recipe } from "@/types/recipe";

type UserPrefsDoc = {
  dietaryPreference?: string;      // e.g., "Vegetarian", "Vegan", "Keto"
  religiousPreference?: string;    // e.g., "Halal", "Kosher"
  caloriePlan?: string;            // e.g., "Maintain Calories", "Lose Weight"
};

export default function RecipeGeneratorScreen() {
  const [ingredients, setIngredients] = useState<string[]>([]);
  const [preferences, setPreferences] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [recipe, setRecipe] = useState<any | null>(null);
  const user = auth.currentUser;

  // 🔹 Fetch user inventory + preferences from Firestore
  useEffect(() => {
    const run = async () => {
      if (!user) {
        setLoading(false);
        return;
      }
      try {
        // Ingredients
        const invRef = collection(db, "users", user.uid, "ingredients");
        const invSnap = await getDocs(invRef);
        const names = invSnap.docs
          .map((d) => d.data()?.name)
          .filter(Boolean) as string[];
        setIngredients(names);

        // Preferences (optional but recommended)
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);
        const prefsDoc = (userSnap.exists()
          ? (userSnap.data() as UserPrefsDoc)
          : {}) as UserPrefsDoc;

        const prefs: string[] = [];
        if (prefsDoc.dietaryPreference) prefs.push(prefsDoc.dietaryPreference);
        if (prefsDoc.religiousPreference) prefs.push(prefsDoc.religiousPreference);
        if (prefsDoc.caloriePlan) prefs.push(prefsDoc.caloriePlan);

        // Sensible default if nothing on file
        if (prefs.length === 0) {
          prefs.push("Maintain Calories");
        }
        setPreferences(prefs);
      } catch (err) {
        console.error("Error loading pantry/prefs:", err);
        Alert.alert("Error", "Failed to load your pantry or preferences.");
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [user]);

  // 🔹 Generate recipe from inventory + preferences
  const handleGenerate = async () => {
    if (ingredients.length === 0) {
      Alert.alert("No Ingredients", "Add items to your inventory first.");
      return;
    }
    try {
      setGenerating(true);
      // ✅ Pass BOTH arguments as required by generateRecipe.ts
      const data = await generateRecipe(ingredients, preferences);
      if (!data?.title) throw new Error("Invalid AI response");
      setRecipe(data);
    } catch (err) {
      console.error("❌ Recipe generation failed:", err);
      Alert.alert("Error", "Failed to generate recipe. Try again.");
    } finally {
      setGenerating(false);
    }
  };

  // 🔹 Save generated recipe
  const handleSave = async () => {
    if (!user || !recipe) return;
    try {
      setSaving(true);
      const ref = doc(collection(db, "users", user.uid, "recipes"));
      await setDoc(ref, {
        ...recipe,
        createdAt: serverTimestamp(),
        source: "AI Generated",
      });
      Alert.alert("✅ Saved", "Recipe added to your collection.");
    } catch (err) {
      console.error("Save failed:", err);
      Alert.alert("Error", "Could not save recipe.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color="#128AFA" />
        <Text style={styles.gray}>Loading your pantry...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {!recipe ? (
        <View style={styles.center}>
          <TouchableOpacity
            onPress={handleGenerate}
            disabled={generating}
            style={styles.button}
          >
            <Text style={styles.buttonText}>
              {generating ? "Generating Recipe..." : "Generate Recipe from Inventory"}
            </Text>
          </TouchableOpacity>

          {/* Small hint on which preferences are active */}
          {preferences.length > 0 && (
            <Text style={[styles.gray, { marginTop: 12 }]}>
              Preferences: {preferences.join(", ")}
            </Text>
          )}
        </View>
      ) : (
        <ScrollView style={styles.scroll}>
          <Text style={styles.title}>{recipe.title}</Text>
          {recipe.description && <Text style={styles.desc}>{recipe.description}</Text>}

          <Text style={styles.section}>Ingredients</Text>
          {recipe.ingredients?.map((i: string, idx: number) => (
            <Text key={idx} style={styles.item}>• {i}</Text>
          ))}

          <Text style={styles.section}>Instructions</Text>
          {recipe.instructions?.map((s: string, idx: number) => (
            <Text key={idx} style={styles.item}>{idx + 1}. {s}</Text>
          ))}

          <TouchableOpacity onPress={handleSave} disabled={saving} style={styles.saveButton}>
            <Text style={styles.saveText}>{saving ? "Saving..." : "Save Recipe"}</Text>
          </TouchableOpacity>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff", padding: 20 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  gray: { color: "#6b7280", marginTop: 10, textAlign: "center" },
  button: {
    backgroundColor: "#128AFA",
    paddingVertical: 14,
    paddingHorizontal: 30,
    borderRadius: 14,
  },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "bold" },
  scroll: { flex: 1 },
  title: { fontSize: 24, fontWeight: "bold", color: "#128AFA" },
  desc: { marginVertical: 8, color: "#6b7280", fontStyle: "italic" },
  section: { fontSize: 18, fontWeight: "bold", marginTop: 16, color: "#111827" },
  item: { color: "#374151", marginVertical: 2 },
  saveButton: {
    backgroundColor: "#16a34a",
    paddingVertical: 14,
    borderRadius: 14,
    marginTop: 24,
  },
  saveText: { color: "#fff", fontSize: 16, fontWeight: "bold", textAlign: "center" },
});
