import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeft, Plus, Trash2 } from "lucide-react-native";
import Background from "@/components/Background";
import { auth, db } from "@/lib/firebaseConfig";
import {
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import { shareRecipe } from "@/lib/utils/shareRecipe";

type IngredientForm = {
  name: string;
  qty: string;
};

export default function RecipeMakerScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const recipeId = typeof params.recipeId === "string" ? params.recipeId : undefined;
  const isEditing = !!recipeId;
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [ingredients, setIngredients] = useState<IngredientForm[]>([
    { name: "", qty: "" },
  ]);
  const [steps, setSteps] = useState<string[]>([""]);
  const [saving, setSaving] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [initializing, setInitializing] = useState(isEditing);
  const [originalSource, setOriginalSource] = useState<string | undefined>();
  const [currentRecipe, setCurrentRecipe] = useState<Record<string, any> | null>(null);

  useEffect(() => {
    if (!isEditing) return;

    const loadRecipe = async () => {
      const uid = auth.currentUser?.uid;
      if (!uid || !recipeId) {
        setInitializing(false);
        Alert.alert("Authentication Required", "You must be logged in to edit recipes.", [
          {
            text: "OK",
            onPress: () => router.back(),
          },
        ]);
        return;
      }

      try {
        const recipeRef = doc(db, "users", uid, "recipes", recipeId);
        const snapshot = await getDoc(recipeRef);
        if (!snapshot.exists()) {
          Alert.alert("Recipe Not Found", "Unable to load this recipe for editing.", [
            {
              text: "OK",
              onPress: () => router.back(),
            },
          ]);
          return;
        }

        const data = snapshot.data() as Record<string, any>;
        setCurrentRecipe(data);
        setOriginalSource(typeof data.source === "string" ? data.source : undefined);
        setTitle(typeof data.title === "string" ? data.title : "");
        setDescription(typeof data.description === "string" ? data.description : "");

        const loadedIngredients = Array.isArray(data.ingredients)
          ? data.ingredients.map((item: any) => {
              if (typeof item === "string") {
                return { name: item, qty: "" };
              }
              return {
                name: typeof item?.name === "string" ? item.name : "",
                qty: typeof item?.qty === "string" ? item.qty : "",
              };
            })
          : [];
        setIngredients(
          loadedIngredients.length > 0 ? loadedIngredients : [{ name: "", qty: "" }]
        );

        const loadedSteps = Array.isArray(data.instructions)
          ? data.instructions.filter((step: any) => typeof step === "string")
          : [];
        setSteps(loadedSteps.length > 0 ? loadedSteps : [""]);
      } finally {
        setInitializing(false);
      }
    };

    loadRecipe();
  }, [isEditing, recipeId, router]);

  const addIngredient = () => {
    setIngredients((prev) => [...prev, { name: "", qty: "" }]);
  };

  const removeIngredient = (index: number) => {
    setIngredients((prev) => {
      if (prev.length === 1) return prev;
      return prev.filter((_, idx) => idx !== index);
    });
  };

  const updateIngredient = (index: number, key: keyof IngredientForm, value: string) => {
    setIngredients((prev) =>
      prev.map((item, idx) =>
        idx === index
          ? {
              ...item,
              [key]: value,
            }
          : item
      )
    );
  };

  const addStep = () => {
    setSteps((prev) => [...prev, ""]);
  };

  const removeStep = (index: number) => {
    setSteps((prev) => {
      if (prev.length === 1) return prev;
      return prev.filter((_, idx) => idx !== index);
    });
  };

  const updateStep = (index: number, value: string) => {
    setSteps((prev) => prev.map((item, idx) => (idx === index ? value : item)));
  };

  const buildRecipePayload = () => {
    const trimmedTitle = title.trim();
    const cleanedIngredients = ingredients
      .map((item) => ({
        name: item.name.trim(),
        qty: item.qty.trim(),
      }))
      .filter((item) => item.name.length > 0)
      .map((item) =>
        item.qty.length > 0
          ? { name: item.name, qty: item.qty }
          : { name: item.name }
      );
    const cleanedSteps = steps.map((step) => step.trim()).filter((step) => step.length > 0);

    if (!trimmedTitle) {
      Alert.alert("Missing Title", "Please enter a recipe title.");
      return null;
    }

    if (cleanedIngredients.length === 0) {
      Alert.alert("Missing Ingredients", "Add at least one ingredient with a name.");
      return null;
    }

    if (cleanedSteps.length === 0) {
      Alert.alert("Missing Steps", "Provide at least one instruction step.");
      return null;
    }

    const trimmedDescription = description.trim();
    const determineSource = () => {
      if (!isEditing) {
        return "Human" as const;
      }
      if (!originalSource) {
        return "Human";
      }
      const normalized = originalSource.toLowerCase();
      if (normalized.includes("ai") && normalized !== "ai - edited") {
        return "AI - Edited";
      }
      return originalSource;
    };

    return {
      title: trimmedTitle,
      description: trimmedDescription.length > 0 ? trimmedDescription : undefined,
      ingredients: cleanedIngredients,
      instructions: cleanedSteps,
      source: determineSource(),
    };
  };

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setIngredients([{ name: "", qty: "" }]);
    setSteps([""]);
  };

  const handleSave = async (shouldShare: boolean) => {
    if (saving || sharing || initializing) return;

    const recipePayload = buildRecipePayload();
    if (!recipePayload) return;

    const uid = auth.currentUser?.uid;
    if (!uid) {
      Alert.alert("Authentication Required", "You must be logged in to save recipes.");
      return;
    }

    try {
      if (shouldShare) {
        setSharing(true);
      } else {
        setSaving(true);
      }

      const recipeRef = isEditing
        ? doc(db, "users", uid, "recipes", recipeId)
        : doc(collection(db, "users", uid, "recipes"));

      if (isEditing) {
        await updateDoc(recipeRef, {
          ...recipePayload,
          updatedAt: serverTimestamp(),
        });
      } else {
        await setDoc(recipeRef, {
          ...recipePayload,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          isShared: false,
        });
      }

      if (shouldShare) {
        const shareBase = isEditing && currentRecipe ? currentRecipe : {};
        const shareResult = await shareRecipe({
          id: recipeRef.id,
          ...shareBase,
          ...recipePayload,
        }, uid);

        if (!shareResult.success) {
          Alert.alert("Share Failed", shareResult.error || "Unable to share recipe with the community.");
          return;
        }

        await updateDoc(recipeRef, {
          isShared: true,
          sharedAt: serverTimestamp(),
        });

        Alert.alert("Success", "Recipe saved and shared with the community!", [
          {
            text: "OK",
            onPress: () => router.back(),
          }
        ]);
        if (!isEditing) {
          resetForm();
        }
        return;
      }

      Alert.alert(
        "Saved",
        isEditing ? "Recipe updated." : "Recipe saved to your collection.",
        [
          {
            text: "OK",
            onPress: () => router.back(),
          },
        ]
      );
      if (!isEditing) {
        resetForm();
      }
    } catch (error) {
      console.error("Failed to save recipe", error);
      Alert.alert("Error", "Something went wrong while saving your recipe.");
    } finally {
      setSaving(false);
      setSharing(false);
    }
  };

  return (
    <Background>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <ArrowLeft color="#128AFAFF" size={26} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{isEditing ? "Edit Recipe" : "Create a Recipe"}</Text>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.section}>
            <Text style={styles.label}>Title *</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., Grandma's Apple Pie"
              placeholderTextColor="#94a3b8"
              value={title}
              onChangeText={setTitle}
            />
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>Description</Text>
            <TextInput
              style={[styles.input, styles.multilineInput]}
              placeholder="Add a brief description of your recipe"
              placeholderTextColor="#94a3b8"
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Ingredients *</Text>
              <TouchableOpacity style={styles.addButton} onPress={addIngredient}>
                <Plus color="#128AFAFF" size={18} />
                <Text style={styles.addButtonText}>Add Ingredient</Text>
              </TouchableOpacity>
            </View>

            {ingredients.map((item, index) => (
              <View key={`ingredient-${index}`} style={styles.ingredientRow}>
                <TextInput
                  style={[styles.input, styles.ingredientName]}
                  placeholder="Ingredient name"
                  placeholderTextColor="#94a3b8"
                  value={item.name}
                  onChangeText={(text) => updateIngredient(index, "name", text)}
                />
                <TextInput
                  style={[styles.input, styles.ingredientQty]}
                  placeholder="Quantity"
                  placeholderTextColor="#94a3b8"
                  value={item.qty}
                  onChangeText={(text) => updateIngredient(index, "qty", text)}
                />
                {ingredients.length > 1 && (
                  <TouchableOpacity
                    style={styles.removeButton}
                    onPress={() => removeIngredient(index)}
                  >
                    <Trash2 color="#ef4444" size={18} />
                  </TouchableOpacity>
                )}
              </View>
            ))}
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Instructions *</Text>
              <TouchableOpacity style={styles.addButton} onPress={addStep}>
                <Plus color="#128AFAFF" size={18} />
                <Text style={styles.addButtonText}>Add Step</Text>
              </TouchableOpacity>
            </View>

            {steps.map((step, index) => (
              <View key={`step-${index}`} style={styles.stepRow}>
                <View style={styles.stepNumberContainer}>
                  <Text style={styles.stepNumber}>{index + 1}.</Text>
                </View>
                <TextInput
                  style={[styles.input, styles.stepInput]}
                  placeholder="Describe this step"
                  placeholderTextColor="#94a3b8"
                  value={step}
                  onChangeText={(text) => updateStep(index, text)}
                  multiline
                  textAlignVertical="top"
                />
                {steps.length > 1 && (
                  <TouchableOpacity style={styles.removeButton} onPress={() => removeStep(index)}>
                    <Trash2 color="#ef4444" size={18} />
                  </TouchableOpacity>
                )}
              </View>
            ))}
          </View>

          <View style={styles.buttonGroup}>
            <TouchableOpacity
              style={[styles.primaryButton, (saving || sharing) && styles.disabledButton]}
              onPress={() => handleSave(false)}
              disabled={saving || sharing}
            >
              <Text style={styles.primaryButtonText}>
                {saving ? "Saving..." : "Save Recipe"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.secondaryButton, (saving || sharing) && styles.disabledButton]}
              onPress={() => handleSave(true)}
              disabled={saving || sharing}
            >
              <Text style={styles.secondaryButtonText}>
                {sharing ? "Sharing..." : "Save & Share"}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    </Background>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
  },
  backButton: {
    marginRight: 12,
    padding: 6,
    borderRadius: 12,
    backgroundColor: "#E6F3FEFF",
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: "bold",
    color: "#0f172a",
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
    gap: 24,
  },
  section: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  label: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1e293b",
    marginBottom: 10,
  },
  input: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: "#0f172a",
    backgroundColor: "#f8fafc",
  },
  multilineInput: {
    height: 120,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0f172a",
  },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: "#E6F3FEFF",
  },
  addButtonText: {
    color: "#128AFAFF",
    fontWeight: "600",
    fontSize: 14,
  },
  ingredientRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 12,
  },
  ingredientName: {
    flex: 1,
  },
  ingredientQty: {
    width: 110,
  },
  removeButton: {
    padding: 8,
  },
  stepRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginBottom: 12,
  },
  stepNumberContainer: {
    width: 24,
    alignItems: "center",
    justifyContent: "flex-start",
    paddingTop: 14,
  },
  stepNumber: {
    fontSize: 16,
    fontWeight: "600",
    color: "#128AFAFF",
  },
  stepInput: {
    flex: 1,
    minHeight: 80,
  },
  buttonGroup: {
    gap: 12,
    marginTop: 8,
  },
  primaryButton: {
    backgroundColor: "#128AFAFF",
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonText: {
    color: "#ffffff",
    fontSize: 17,
    fontWeight: "700",
  },
  secondaryButton: {
    backgroundColor: "#0ea5e9",
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryButtonText: {
    color: "#ffffff",
    fontSize: 17,
    fontWeight: "700",
  },
  disabledButton: {
    opacity: 0.6,
  },
});
