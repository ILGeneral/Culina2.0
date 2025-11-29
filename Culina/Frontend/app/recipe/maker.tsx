import React, { useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
  useWindowDimensions,
} from "react-native";
import { Picker } from "@react-native-picker/picker";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeft, Plus, Trash2, ChevronDown } from "lucide-react-native";
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
import { makerStyles as styles } from "@/styles/recipe/makerStyles";
import { EQUIPMENT_DB } from "@/lib/equipmentDetector";

type IngredientForm = {
  name: string;
  qty: string;
  unit: string;
};

const sanitizeQuantityInput = (value: string) => {
  const numericOnly = value.replace(/[^0-9.]/g, "");
  const parts = numericOnly.split(".");
  if (parts.length <= 1) {
    return numericOnly;
  }
  const [first, ...rest] = parts;
  return `${first}.${rest.join("")}`;
};

const UNIT_OPTIONS = [
  "g",
  "kg",
  "cups",
  "tbsp",
  "tsp",
  "ml",
  "l",
  "oz",
  "lb",
  "pieces",
  "slices",
  "cloves",
  "bunches",
  "cans",
  "bottles",
];

// Helper function to parse ingredient strings
const parseIngredientString = (ingredientStr: string): IngredientForm => {
  // Trim the input
  const trimmed = ingredientStr.trim();
  
  // Check if there's a comma - format: "Broccoli, 1 kg" or "Lemon, 2 pcs"
  if (trimmed.includes(',')) {
    const parts = trimmed.split(',').map(p => p.trim());
    if (parts.length >= 2) {
      const name = parts[0];
      const qtyUnit = parts[1];
      
      // Parse the quantity and unit from "1 kg" or "2 pcs"
      const qtyUnitMatch = qtyUnit.match(/^([\d\/\.\s]+)\s*(.*)$/);
      if (qtyUnitMatch) {
        const qty = qtyUnitMatch[1].trim();
        const unit = qtyUnitMatch[2].trim();
        return { name, qty, unit };
      }
      
      // If no quantity found, treat the whole second part as quantity
      return { name, qty: qtyUnit, unit: "" };
    }
  }
  
  // Try standard format: "2 cups flour" or "1/2 tsp salt"
  const standardPattern = /^([\d\/\.\s]+)\s+([a-zA-Z]+)\s+(.+)$/;
  const standardMatch = trimmed.match(standardPattern);
  
  if (standardMatch) {
    const [, qty, unit, name] = standardMatch;
    return {
      name: name.trim(),
      qty: qty.trim(),
      unit: unit.trim()
    };
  }
  
  // Try format with just quantity and name: "3 eggs"
  const simplePattern = /^([\d\/\.\s]+)\s+(.+)$/;
  const simpleMatch = trimmed.match(simplePattern);
  
  if (simpleMatch) {
    const [, qty, name] = simpleMatch;
    return {
      name: name.trim(),
      qty: qty.trim(),
      unit: ""
    };
  }
  
  // No pattern matched, return as just a name
  return { name: trimmed, qty: "", unit: "" };
};

// Available tags organized by category
const AVAILABLE_TAGS = {
  mealType: ['Breakfast', 'Lunch', 'Dinner', 'Snack', 'Dessert', 'Brunch', 'Appetizer'],
  cookingStyle: ['Baked', 'Fried', 'Grilled', 'Steamed', 'Roasted', 'Boiled', 'Sautéed', 'Raw', 'No-Cook'],
  dietary: ['Vegan', 'Vegetarian', 'Gluten-Free', 'Dairy-Free', 'Keto', 'Paleo', 'Low-Carb', 'High-Protein'],
};

const DIFFICULTY_LEVELS: Array<'Easy' | 'Medium' | 'Hard'> = ['Easy', 'Medium', 'Hard'];

export default function RecipeMakerScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const recipeId = typeof params.recipeId === "string" ? params.recipeId : undefined;
  const isEditing = !!recipeId;

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [ingredients, setIngredients] = useState<IngredientForm[]>([
    { name: "", qty: "", unit: "" },
  ]);
  const [steps, setSteps] = useState<string[]>([""]);
  const [equipment, setEquipment] = useState<string[]>([]);
  const [equipmentSearch, setEquipmentSearch] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [difficulty, setDifficulty] = useState<'Easy' | 'Medium' | 'Hard' | ''>('');
  const [ingredientsOpen, setIngredientsOpen] = useState(true);
  const [instructionsOpen, setInstructionsOpen] = useState(true);
  const [tagsOpen, setTagsOpen] = useState(true);
  const [equipmentOpen, setEquipmentOpen] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [initializing, setInitializing] = useState(isEditing);
  const [originalSource, setOriginalSource] = useState<string | undefined>();
  const [currentRecipe, setCurrentRecipe] = useState<Record<string, any> | null>(null);
  const isMountedRef = useRef(true);

  // Track screen dimensions for responsive layout
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!isEditing) return;

    const loadRecipe = async () => {
      const uid = auth.currentUser?.uid;
      if (!uid || !recipeId) {
        if (isMountedRef.current) {
          setInitializing(false);
        }
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
          if (isMountedRef.current) {
            setInitializing(false);
          }
          Alert.alert("Recipe Not Found", "Unable to load this recipe for editing.", [
            {
              text: "OK",
              onPress: () => router.back(),
            },
          ]);
          return;
        }

        const data = snapshot.data() as Record<string, any>;
        
        // Debug: Log the raw ingredients data
        console.log("Raw ingredients data:", JSON.stringify(data.ingredients, null, 2));
        
        setCurrentRecipe(data);
        setOriginalSource(typeof data.source === "string" ? data.source : undefined);
        setTitle(typeof data.title === "string" ? data.title : "");
        setDescription(typeof data.description === "string" ? data.description : "");

        const loadedIngredients = Array.isArray(data.ingredients)
          ? data.ingredients.map((item: any) => {
              // Case 1: Item is a plain string
              if (typeof item === "string") {
                console.log("Parsing string ingredient:", item);
                const parsed = parseIngredientString(item);
                console.log("Parsed result:", parsed);
                return parsed;
              }
              
              // Case 2: Item is an object
              const itemQty = typeof item?.qty === "string" ? item.qty.trim() : "";
              const itemUnit = typeof item?.unit === "string" ? item.unit.trim() : "";
              const itemName = typeof item?.name === "string" ? item.name.trim() : "";
              
              console.log("Object ingredient:", { name: itemName, qty: itemQty, unit: itemUnit });
              
              // If qty and unit are empty but name has content, parse the name
              if ((!itemQty && !itemUnit) && itemName) {
                console.log("Parsing name field:", itemName);
                const parsed = parseIngredientString(itemName);
                console.log("Parsed from name:", parsed);
                return parsed;
              }
              
              // Otherwise return as-is
              return {
                name: itemName,
                qty: itemQty,
                unit: itemUnit,
              };
            })
          : [];
        
        console.log("Final loaded ingredients:", JSON.stringify(loadedIngredients, null, 2));
        setIngredients(
          loadedIngredients.length > 0 ? loadedIngredients : [{ name: "", qty: "", unit: "" }]
        );

        const loadedSteps = Array.isArray(data.instructions)
          ? data.instructions.filter((step: any) => typeof step === "string")
          : [];
        setSteps(loadedSteps.length > 0 ? loadedSteps : [""]);

        const loadedEquipment = Array.isArray(data.equipment)
          ? data.equipment.filter((item: any) => typeof item === "string")
          : [];
        setEquipment(loadedEquipment);

        const loadedTags = Array.isArray(data.tags)
          ? data.tags.filter((item: any) => typeof item === "string")
          : [];
        setTags(loadedTags);

        if (data.difficulty && ['Easy', 'Medium', 'Hard'].includes(data.difficulty)) {
          setDifficulty(data.difficulty as 'Easy' | 'Medium' | 'Hard');
        }
      } finally {
        if (isMountedRef.current) {
          setInitializing(false);
        }
      }
    };

    loadRecipe();
  }, [isEditing, recipeId, router]);

  const addIngredient = () => {
    setIngredients((prev) => [...prev, { name: "", qty: "", unit: "" }]);
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

  const handleQuantityChange = (index: number, text: string) => {
    const sanitized = sanitizeQuantityInput(text);
    updateIngredient(index, "qty", sanitized);
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

  const toggleEquipment = (equipmentKey: string) => {
    setEquipment((prev) => {
      if (prev.includes(equipmentKey)) {
        return prev.filter((item) => item !== equipmentKey);
      } else {
        return [...prev, equipmentKey];
      }
    });
  };

  const toggleTag = (tag: string) => {
    setTags((prev) => {
      if (prev.includes(tag)) {
        return prev.filter((item) => item !== tag);
      } else {
        // Limit to 4 tags
        if (prev.length >= 4) {
          Alert.alert("Tag Limit", "You can select up to 4 tags.");
          return prev;
        }
        return [...prev, tag];
      }
    });
  };

  const buildRecipePayload = () => {
    const trimmedTitle = title.trim();
    const cleanedIngredients = ingredients
      .map((item) => ({
        name: item.name.trim(),
        qty: item.qty.trim(),
        unit: item.unit.trim(),
      }))
      .filter((item) => item.name.length > 0)
      .map((item) =>
        item.qty.length > 0 || item.unit.length > 0
          ? {
              name: item.name,
              ...(item.qty.length > 0 ? { qty: item.qty } : {}),
              ...(item.unit.length > 0 ? { unit: item.unit } : {}),
            }
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
      equipment: equipment.length > 0 ? equipment : undefined,
      tags: tags.length > 0 ? tags : undefined,
      difficulty: difficulty || undefined,
      source: determineSource(),
    };
  };

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setIngredients([{ name: "", qty: "", unit: "" }]);
    setSteps([""]);
    setEquipment([]);
    setTags([]);
    setDifficulty('');
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

        if (!isEditing) {
          resetForm();
        }
        Alert.alert("Success", "Recipe saved and shared with the community!", [
          {
            text: "OK",
            onPress: () => router.back(),
          }
        ]);
        return;
      }

      if (!isEditing) {
        resetForm();
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
    } catch (error) {
      console.error("Failed to save recipe", error);
      Alert.alert("Error", "Something went wrong while saving your recipe.");
    } finally {
      if (isMountedRef.current) {
        setSaving(false);
        setSharing(false);
      }
    }
  };

  const keyboardVerticalOffset = Platform.OS === "ios" ? 90 : 0;

  return (
    <Background>
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={keyboardVerticalOffset}
        >
          <View style={styles.header}>
            <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
              <ArrowLeft color="#128AFAFF" size={26} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>{isEditing ? "Edit Recipe" : "Create a Recipe"}</Text>
          </View>

          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
          >
            {isLandscape ? (
              <>
                {/* Landscape: Two-column layout */}
                <View style={styles.landscapeContainer}>
                  {/* Left Column: Title, Description, Ingredients */}
                  <View style={styles.landscapeColumn}>
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

                    {/* Difficulty Selection */}
                    <View style={styles.section}>
                      <Text style={styles.sectionTitle}>Difficulty</Text>
                      <View style={styles.difficultyContainer}>
                        {DIFFICULTY_LEVELS.map((level) => (
                          <TouchableOpacity
                            key={level}
                            style={[
                              styles.difficultyChip,
                              difficulty === level && styles.difficultyChipSelected,
                            ]}
                            onPress={() => setDifficulty(level)}
                          >
                            <Text
                              style={[
                                styles.difficultyChipText,
                                difficulty === level && styles.difficultyChipTextSelected,
                              ]}
                            >
                              {level}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>

                    {/* Tags Selection */}
                    <View style={styles.section}>
                      <TouchableOpacity
                        style={{ flexDirection: 'row', alignItems: 'center' }}
                        onPress={() => setTagsOpen(!tagsOpen)}
                      >
                        <Text style={styles.sectionTitle}>Tags (Max 4)</Text>
                        <ChevronDown
                          color="#0F172A"
                          size={20}
                          style={{
                            marginLeft: 8,
                            transform: [{ rotate: tagsOpen ? '180deg' : '0deg' }],
                          }}
                        />
                      </TouchableOpacity>

                      {tagsOpen && (
                        <>
                          <Text style={styles.tagCategoryLabel}>Meal Type</Text>
                          <View style={styles.tagsGrid}>
                        {AVAILABLE_TAGS.mealType.map((tag) => (
                          <TouchableOpacity
                            key={tag}
                            style={[
                              styles.tagChip,
                              tags.includes(tag) && styles.tagChipSelected,
                            ]}
                            onPress={() => toggleTag(tag)}
                          >
                            <Text
                              style={[
                                styles.tagChipText,
                                tags.includes(tag) && styles.tagChipTextSelected,
                              ]}
                            >
                              {tag}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>

                      <Text style={styles.tagCategoryLabel}>Cooking Style</Text>
                      <View style={styles.tagsGrid}>
                        {AVAILABLE_TAGS.cookingStyle.map((tag) => (
                          <TouchableOpacity
                            key={tag}
                            style={[
                              styles.tagChip,
                              tags.includes(tag) && styles.tagChipSelected,
                            ]}
                            onPress={() => toggleTag(tag)}
                          >
                            <Text
                              style={[
                                styles.tagChipText,
                                tags.includes(tag) && styles.tagChipTextSelected,
                              ]}
                            >
                              {tag}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>

                          <Text style={styles.tagCategoryLabel}>Dietary</Text>
                          <View style={styles.tagsGrid}>
                            {AVAILABLE_TAGS.dietary.map((tag) => (
                              <TouchableOpacity
                                key={tag}
                                style={[
                                  styles.tagChip,
                                  tags.includes(tag) && styles.tagChipSelected,
                                ]}
                                onPress={() => toggleTag(tag)}
                              >
                                <Text
                                  style={[
                                    styles.tagChipText,
                                    tags.includes(tag) && styles.tagChipTextSelected,
                                  ]}
                                >
                                  {tag}
                                </Text>
                              </TouchableOpacity>
                            ))}
                          </View>
                        </>
                      )}
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
                        <TouchableOpacity
                          style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}
                          onPress={() => setIngredientsOpen(!ingredientsOpen)}
                        >
                          <Text style={styles.sectionTitle}>Ingredients *</Text>
                          <ChevronDown
                            color="#0F172A"
                            size={20}
                            style={{
                              marginLeft: 8,
                              transform: [{ rotate: ingredientsOpen ? '180deg' : '0deg' }],
                            }}
                          />
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.addButton} onPress={addIngredient}>
                          <Plus color="#128AFAFF" size={18} />
                          <Text style={styles.addButtonText}>Add Ingredient</Text>
                        </TouchableOpacity>
                      </View>

                      {ingredientsOpen && ingredients.map((item, index) => (
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
                            placeholder="Qty"
                            placeholderTextColor="#94a3b8"
                            value={item.qty}
                            onChangeText={(text) => handleQuantityChange(index, text)}
                            keyboardType="numeric"
                            inputMode="decimal"
                          />
                          <View style={styles.unitContainer}>
                            <View style={[styles.input, styles.unitPickerContainer]}>
                              <Picker
                                selectedValue={item.unit}
                                onValueChange={(value) => updateIngredient(index, "unit", value)}
                                mode="dropdown"
                                dropdownIconColor="#128AFAFF"
                                style={styles.unitPicker}
                              >
                                {UNIT_OPTIONS.map((option) => (
                                  <Picker.Item
                                    key={option}
                                    label={option}
                                    value={option}
                                  />
                                ))}
                              </Picker>
                            </View>
                            {item.unit && (
                              <Text style={styles.unitLabel}>{item.unit}</Text>
                            )}
                          </View>

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

                    {/* Equipment Section */}
                    <View style={styles.section}>
                      <TouchableOpacity
                        style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}
                        onPress={() => setEquipmentOpen(!equipmentOpen)}
                      >
                        <Text style={styles.sectionTitle}>Equipment</Text>
                        <ChevronDown
                          color="#0F172A"
                          size={20}
                          style={{
                            marginLeft: 8,
                            transform: [{ rotate: equipmentOpen ? '180deg' : '0deg' }],
                          }}
                        />
                      </TouchableOpacity>

                      {equipmentOpen && (<>
                        <TextInput
                          style={[styles.input, { marginBottom: 12 }]}
                          placeholder="Search equipment..."
                          placeholderTextColor="#94a3b8"
                          value={equipmentSearch}
                          onChangeText={setEquipmentSearch}
                        />
                        <View style={styles.equipmentGrid}>
                          {Object.entries(EQUIPMENT_DB)
                            .filter(([key, equipmentItem]) =>
                              equipmentItem.name.toLowerCase().includes(equipmentSearch.toLowerCase())
                            )
                            .map(([key, equipmentItem]) => (
                            <TouchableOpacity
                              key={key}
                              style={[
                                styles.equipmentChip,
                                equipment.includes(key) && styles.equipmentChipSelected,
                              ]}
                              onPress={() => toggleEquipment(key)}
                            >
                              <Text style={styles.equipmentIcon}>{equipmentItem.icon}</Text>
                              <Text
                                style={[
                                  styles.equipmentName,
                                  equipment.includes(key) && styles.equipmentNameSelected,
                                ]}
                              >
                                {equipmentItem.name}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      </>)}
                    </View>
                  </View>

                  {/* Right Column: Instructions */}
                  <View style={styles.landscapeColumn}>
                    <View style={styles.section}>
                      <View style={styles.sectionHeader}>
                        <TouchableOpacity
                          style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}
                          onPress={() => setInstructionsOpen(!instructionsOpen)}
                        >
                          <Text style={styles.sectionTitle}>Instructions *</Text>
                          <ChevronDown
                            color="#0F172A"
                            size={20}
                            style={{
                              marginLeft: 8,
                              transform: [{ rotate: instructionsOpen ? '180deg' : '0deg' }],
                            }}
                          />
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.addButton} onPress={addStep}>
                          <Plus color="#128AFAFF" size={18} />
                          <Text style={styles.addButtonText}>Add Step</Text>
                        </TouchableOpacity>
                      </View>

                      {instructionsOpen && steps.map((step, index) => (
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
                  </View>
                </View>

                {/* Buttons below both columns */}
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
              </>
            ) : (
              <>
                {/* Portrait: Single column layout */}
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

                {/* Difficulty Selection */}
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Difficulty</Text>
                  <View style={styles.difficultyContainer}>
                    {DIFFICULTY_LEVELS.map((level) => (
                      <TouchableOpacity
                        key={level}
                        style={[
                          styles.difficultyChip,
                          difficulty === level && styles.difficultyChipSelected,
                        ]}
                        onPress={() => setDifficulty(level)}
                      >
                        <Text
                          style={[
                            styles.difficultyChipText,
                            difficulty === level && styles.difficultyChipTextSelected,
                          ]}
                        >
                          {level}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* Tags Selection */}
                <View style={styles.section}>
                  <TouchableOpacity
                    style={{ flexDirection: 'row', alignItems: 'center' }}
                    onPress={() => setTagsOpen(!tagsOpen)}
                  >
                    <Text style={styles.sectionTitle}>Tags (Max 4)</Text>
                    <ChevronDown
                      color="#0F172A"
                      size={20}
                      style={{
                        marginLeft: 8,
                        transform: [{ rotate: tagsOpen ? '180deg' : '0deg' }],
                      }}
                    />
                  </TouchableOpacity>

                  {tagsOpen && (<>
                    <Text style={styles.tagCategoryLabel}>Meal Type</Text>
                    <View style={styles.tagsGrid}>
                      {AVAILABLE_TAGS.mealType.map((tag) => (
                        <TouchableOpacity
                          key={tag}
                          style={[
                            styles.tagChip,
                            tags.includes(tag) && styles.tagChipSelected,
                          ]}
                          onPress={() => toggleTag(tag)}
                        >
                          <Text
                            style={[
                              styles.tagChipText,
                              tags.includes(tag) && styles.tagChipTextSelected,
                            ]}
                          >
                            {tag}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    <Text style={styles.tagCategoryLabel}>Cooking Style</Text>
                    <View style={styles.tagsGrid}>
                      {AVAILABLE_TAGS.cookingStyle.map((tag) => (
                        <TouchableOpacity
                          key={tag}
                          style={[
                            styles.tagChip,
                            tags.includes(tag) && styles.tagChipSelected,
                          ]}
                          onPress={() => toggleTag(tag)}
                        >
                          <Text
                            style={[
                              styles.tagChipText,
                              tags.includes(tag) && styles.tagChipTextSelected,
                            ]}
                          >
                            {tag}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    <Text style={styles.tagCategoryLabel}>Dietary</Text>
                    <View style={styles.tagsGrid}>
                      {AVAILABLE_TAGS.dietary.map((tag) => (
                        <TouchableOpacity
                          key={tag}
                          style={[
                            styles.tagChip,
                            tags.includes(tag) && styles.tagChipSelected,
                          ]}
                          onPress={() => toggleTag(tag)}
                        >
                          <Text
                            style={[
                              styles.tagChipText,
                              tags.includes(tag) && styles.tagChipTextSelected,
                            ]}
                          >
                            {tag}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </>)}
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
                    <TouchableOpacity
                      style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}
                      onPress={() => setIngredientsOpen(!ingredientsOpen)}
                    >
                      <Text style={styles.sectionTitle}>Ingredients *</Text>
                      <ChevronDown
                        color="#0F172A"
                        size={20}
                        style={{
                          marginLeft: 8,
                          transform: [{ rotate: ingredientsOpen ? '180deg' : '0deg' }],
                        }}
                      />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.addButton} onPress={addIngredient}>
                      <Plus color="#128AFAFF" size={18} />
                      <Text style={styles.addButtonText}>Add Ingredient</Text>
                    </TouchableOpacity>
                  </View>

                  {ingredientsOpen && ingredients.map((item, index) => (
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
                        placeholder="Qty"
                        placeholderTextColor="#94a3b8"
                        value={item.qty}
                        onChangeText={(text) => handleQuantityChange(index, text)}
                        keyboardType="numeric"
                        inputMode="decimal"
                      />
                      <View style={styles.unitContainer}>
                        <View style={[styles.input, styles.unitPickerContainer]}>
                          <Picker
                            selectedValue={item.unit}
                            onValueChange={(value) => updateIngredient(index, "unit", value)}
                            mode="dropdown"
                            dropdownIconColor="#128AFAFF"
                            style={styles.unitPicker}
                          >
                            {UNIT_OPTIONS.map((option) => (
                              <Picker.Item
                                key={option}
                                label={option}
                                value={option}
                              />
                            ))}
                          </Picker>
                        </View>
                        {item.unit && (
                          <Text style={styles.unitLabel}>{item.unit}</Text>
                        )}
                      </View>

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

                {/* Equipment Section */}
                <View style={styles.section}>
                  <TouchableOpacity
                    style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}
                    onPress={() => setEquipmentOpen(!equipmentOpen)}
                  >
                    <Text style={styles.sectionTitle}>Equipment</Text>
                    <ChevronDown
                      color="#0F172A"
                      size={20}
                      style={{
                        marginLeft: 8,
                        transform: [{ rotate: equipmentOpen ? '180deg' : '0deg' }],
                      }}
                    />
                  </TouchableOpacity>

                  {equipmentOpen && (<>
                    <TextInput
                      style={[styles.input, { marginBottom: 12 }]}
                      placeholder="Search equipment..."
                      placeholderTextColor="#94a3b8"
                      value={equipmentSearch}
                      onChangeText={setEquipmentSearch}
                    />
                    <View style={styles.equipmentGrid}>
                      {Object.entries(EQUIPMENT_DB)
                        .filter(([key, equipmentItem]) =>
                          equipmentItem.name.toLowerCase().includes(equipmentSearch.toLowerCase())
                        )
                        .map(([key, equipmentItem]) => (
                        <TouchableOpacity
                          key={key}
                          style={[
                            styles.equipmentChip,
                            equipment.includes(key) && styles.equipmentChipSelected,
                          ]}
                          onPress={() => toggleEquipment(key)}
                        >
                          <Text style={styles.equipmentIcon}>{equipmentItem.icon}</Text>
                          <Text
                            style={[
                              styles.equipmentName,
                              equipment.includes(key) && styles.equipmentNameSelected,
                            ]}
                          >
                            {equipmentItem.name}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </>)}
                </View>

                <View style={styles.section}>
                  <View style={styles.sectionHeader}>
                    <TouchableOpacity
                      style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}
                      onPress={() => setInstructionsOpen(!instructionsOpen)}
                    >
                      <Text style={styles.sectionTitle}>Instructions *</Text>
                      <ChevronDown
                        color="#0F172A"
                        size={20}
                        style={{
                          marginLeft: 8,
                          transform: [{ rotate: instructionsOpen ? '180deg' : '0deg' }],
                        }}
                      />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.addButton} onPress={addStep}>
                      <Plus color="#128AFAFF" size={18} />
                      <Text style={styles.addButtonText}>Add Step</Text>
                    </TouchableOpacity>
                  </View>

                  {instructionsOpen && steps.map((step, index) => (
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
              </>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Background>
  );
}