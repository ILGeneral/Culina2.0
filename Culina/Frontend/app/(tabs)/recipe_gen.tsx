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
import { collection, getDocs, doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { generateRecipe } from "@/lib/generateRecipe";
import type { Recipe } from "@/types/recipe";
import Background from "@/components/Background";

type UserPrefsDoc = {
  dietaryPreference?: string;
  religiousPreference?: string;
  caloriePlan?: string;
};

export default function RecipeGeneratorScreen() {
  const [ingredients, setIngredients] = useState<string[]>([]);
  const [preferences, setPreferences] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const user = auth.currentUser;

  useEffect(() => {
    const fetchUserData = async () => {
      if (!user) {
        setLoading(false);
        return;
      }
      try {
        const invRef = collection(db, "users", user.uid, "ingredients");
        const invSnap = await getDocs(invRef);
        const names = invSnap.docs.map((d) => d.data()?.name).filter(Boolean) as string[];
        setIngredients(names);

        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);
        const prefsDoc = (userSnap.exists() ? (userSnap.data() as UserPrefsDoc) : {}) as UserPrefsDoc;
        const prefs: string[] = [];
        if (prefsDoc.dietaryPreference) prefs.push(prefsDoc.dietaryPreference);
        if (prefsDoc.religiousPreference) prefs.push(prefsDoc.religiousPreference);
        if (prefsDoc.caloriePlan) prefs.push(prefsDoc.caloriePlan);
        if (prefs.length === 0) prefs.push("Maintain Calories");
        setPreferences(prefs);
      } catch (err) {
        console.error("Error loading user data:", err);
        Alert.alert("Error", "Could not load pantry or preferences.");
      } finally {
        setLoading(false);
      }
    };
    fetchUserData();
  }, [user]);

  const handleGenerate = async () => {
    if (ingredients.length === 0) {
      Alert.alert("No Ingredients", "Add items to your inventory first!");
      return;
    }
    try {
      setGenerating(true);
      const data = await generateRecipe(ingredients, preferences);
      if (!data?.recipes || data.recipes.length < 5) {
        throw new Error("AI returned fewer than five recipes");
      }
      setRecipes(data.recipes);
    } catch (error) {
      console.error("Generation failed:", error);
      Alert.alert("Error", "Could not generate recipes.");
    } finally {
      setGenerating(false);
    }
  };

  const handleSave = async (recipe: Recipe) => {
    if (!user || !recipe) return;
    try {
      setSaving(true);
      const ref = doc(collection(db, "users", user.uid, "recipes"));
      await setDoc(ref, {
        ...recipe,
        createdAt: serverTimestamp(),
        source: "AI Generated",
      });
      Alert.alert("Saved", `Saved recipe: ${recipe.title}`);
    } catch (err) {
      console.error("Save failed:", err);
      Alert.alert("Error", "Could not save recipe.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#128AFA" />
        <Text style={styles.gray}>Loading your pantry...</Text>
      </View>
    );
  }

  return (
    <Background>
      <SafeAreaView style={styles.container}>
        {!recipes.length ? (
          <View style={styles.center}>
            <TouchableOpacity style={styles.button} onPress={handleGenerate} disabled={generating}>
              <Text style={styles.buttonText}>{generating ? "Generating..." : "Generate Recipes!"}</Text>
            </TouchableOpacity>
            {preferences.length > 0 && (
              <Text style={styles.gray}>Preferences: {preferences.join(", ")}</Text>
            )}
          </View>
        ) : (
          <ScrollView style={styles.scroll}>
            {recipes.map((recipe, idx) => (
              <View key={idx} style={{ marginBottom: 20 }}>
                <Text style={styles.title}>{recipe.title}</Text>
                <Text style={styles.desc}>{recipe.description}</Text>

                <Text style={styles.section}>Ingredients</Text>
                {recipe.ingredients.map((ingredient, j) => (
                  <Text key={j} style={styles.item}>
                    • {typeof ingredient === "string" ? ingredient : ingredient.name}
                  </Text>
                ))}

                <Text style={styles.section}>Instructions</Text>
                {recipe.instructions.map((s: string, j: number) => (
                  <Text key={j} style={styles.item}>{j + 1}. {s}</Text>
                ))}

                <TouchableOpacity style={styles.saveButton} onPress={() => handleSave(recipe)} disabled={saving}>
                  <Text style={styles.saveText}>{saving ? "Saving..." : "Save Recipe"}</Text>
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
        )}
      </SafeAreaView>
    </Background>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  gray: { color: "#6b7280", marginTop: 10, textAlign: "center" },
  button: { backgroundColor: "#128AFA", paddingVertical: 14, paddingHorizontal: 30, borderRadius: 14 },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "bold" },
  scroll: { flex: 1 },
  title: { fontSize: 22, fontWeight: "bold", color: "#128AFA" },
  desc: { marginVertical: 8, color: "#6b7280", fontStyle: "italic" },
  section: { fontSize: 18, fontWeight: "bold", marginTop: 16, color: "#111827" },
  item: { color: "#374151", marginVertical: 2 },
  saveButton: { backgroundColor: "#128AFA", paddingVertical: 12, borderRadius: 12, marginTop: 18 },
  saveText: { color: "#fff", fontWeight: "bold", textAlign: "center" },
});
