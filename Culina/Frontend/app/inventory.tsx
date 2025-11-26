import React, { useEffect, useMemo, useRef, useState } from "react";
import styles from "@/styles/inventoryStyle";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Modal,
  Image,
  TextInput,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
} from "react-native";
import { Picker } from "@react-native-picker/picker";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import {
  collection,
  query,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebaseConfig";
import {
  searchMealDbIngredients,
  type MealDbIngredient,
  prefetchMealDbIngredients,
  hasMealDbIngredientsLoaded,
} from "@/lib/mealdb";
import Background from "@/components/Background";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import InventoryHeader from "@/app/components/inventory/InventoryHeader";
import { Plus, Minus, Calendar, X, Apple, Beef, Carrot, UtensilsCrossed } from "lucide-react-native";
import { getExpirationStatus, filterExpiringSoon, formatExpirationDate } from "@/lib/utils/expirationHelpers";
import { Timestamp } from "firebase/firestore";

// —— helpers ——
const capitalize = (s: string) =>
  s
    .toLowerCase()
    .split(" ")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

const sanitizeQuantity = (t: string) => {
  let c = t.replace(/[^0-9.]/g, "");
  const d = c.indexOf(".");
  if (d !== -1) c = c.slice(0, d + 1) + c.slice(d + 1).replace(/\./g, "");
  return c;
};

const parseDateInput = (input: string): Date | null => {
  // Accept formats: MM/DD/YYYY, MM-DD-YYYY, MM.DD.YYYY, or M/D/YY
  const cleaned = input.replace(/[^\d]/g, '');

  // Try parsing different formats
  let month, day, year;

  if (cleaned.length === 8) {
    // MMDDYYYY format
    month = parseInt(cleaned.substring(0, 2), 10);
    day = parseInt(cleaned.substring(2, 4), 10);
    year = parseInt(cleaned.substring(4, 8), 10);
  } else if (cleaned.length === 6) {
    // MMDDYY format
    month = parseInt(cleaned.substring(0, 2), 10);
    day = parseInt(cleaned.substring(2, 4), 10);
    year = 2000 + parseInt(cleaned.substring(4, 6), 10);
  } else {
    return null;
  }

  // Validate date components
  if (month < 1 || month > 12 || day < 1 || day > 31 || year < 2000 || year > 2100) {
    return null;
  }

  const date = new Date(year, month - 1, day);

  // Check if the date is valid (e.g., not Feb 30)
  if (date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null;
  }

  return date;
};

const mealThumb = (n: string) =>
  `https://www.themealdb.com/images/ingredients/${encodeURIComponent(n)}.png`;

const getPlaceholderIcon = (ingredientName: string, ingredientType?: string | null) => {
  // If we have a type from MealDB, use it first
  if (ingredientType) {
    const lowerType = ingredientType.toLowerCase();

    // Map MealDB types to icons
    if (lowerType.includes("meat") || lowerType === "protein") {
      return { Icon: Beef, color: "#DC2626" }; // Red for meat
    }
    if (lowerType.includes("vegetable") || lowerType === "produce") {
      return { Icon: Carrot, color: "#16A34A" }; // Green for vegetables
    }
    if (lowerType.includes("fruit")) {
      return { Icon: Apple, color: "#DC2626" }; // Red for fruits
    }
  }

  // Fallback to keyword matching for custom ingredients
  const lowerName = ingredientName.toLowerCase();

  // Check if it's meat
  if (["chicken", "beef", "pork", "bacon", "turkey", "ham", "sausage", "lamb", "meat", "steak", "fish", "salmon", "tuna", "shrimp", "duck", "veal"].some(m => lowerName.includes(m))) {
    return { Icon: Beef, color: "#DC2626" }; // Red for meat
  }

  // Check if it's vegetables
  if (["tomato", "onion", "garlic", "carrot", "potato", "broccoli", "spinach", "lettuce", "cucumber", "pepper", "celery", "cabbage", "kale", "vegetable", "eggplant", "zucchini", "asparagus"].some(v => lowerName.includes(v))) {
    return { Icon: Carrot, color: "#16A34A" }; // Green for vegetables
  }

  // Check if it's fruits
  if (["apple", "banana", "mango", "orange", "grape", "pineapple", "strawberry", "lemon", "lime", "berry", "fruit", "peach", "pear", "watermelon", "cherry", "plum", "kiwi"].some(f => lowerName.includes(f))) {
    return { Icon: Apple, color: "#DC2626" }; // Red for fruits
  }

  // Default icon for other ingredients
  return { Icon: UtensilsCrossed, color: "#6B7280" }; // Gray for other
};

const UNIT_OPTIONS = [
  "",
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
] as const;

type Unit = (typeof UNIT_OPTIONS)[number];
type Filter = "All" | "Meat" | "Vegetables" | "Fruits";

const CAT: Record<Exclude<Filter, "All">, string[]> = {
  Meat: ["chicken", "beef", "pork", "bacon", "turkey", "ham", "sausage", "lamb"],
  Vegetables: [
    "tomato",
    "onion",
    "garlic",
    "carrot",
    "potato",
    "broccoli",
    "spinach",
    "lettuce",
    "cucumber",
    "pepper",
  ],
  Fruits: [
    "apple",
    "banana",
    "mango",
    "orange",
    "grape",
    "pineapple",
    "strawberry",
    "lemon",
    "lime",
  ],
};

// —— main ——
export default function InventoryScreen() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("All");
  const [showExpiringSoon, setShowExpiringSoon] = useState(false);

  // form
  const [formVisible, setFormVisible] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [name, setName] = useState("");
  const [qty, setQty] = useState("");
  const [unit, setUnit] = useState<Unit>("");
  const [img, setImg] = useState<string | null>(null);
  const [ingredientType, setIngredientType] = useState<string | null>(null);
  const [suggest, setSuggest] = useState<MealDbIngredient[]>([]);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Expiration date state
  const [expirationDate, setExpirationDate] = useState<Date | null>(null);
  const [customDateInput, setCustomDateInput] = useState<string>("");

  // Image error state for form
  const [formImageError, setFormImageError] = useState(false);

  // Bulk add mode
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkItems, setBulkItems] = useState<Array<{name: string, quantity: number, unit: Unit}>>([]);

  const applySuggestion = (ingredient: MealDbIngredient) => {
    const ingredientName = capitalize(ingredient.name);
    setName(ingredientName);
    setIngredientType(ingredient.type || null);
    setFormImageError(false);
    setSuggest([]);
    setSuggestLoading(false);
    setHighlightIndex(null);
  };

  const user = auth.currentUser;

  // — Firestore listener —
  useEffect(() => {
    if (!user?.uid) {
      setLoading(false);
      setItems([]);
      return;
    }

    const q = query(collection(db, "users", user.uid, "ingredients"));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const arr: any[] = [];
        snap.forEach((d) => {
          const data = d.data();
          // Only add items with valid names
          if (data?.name) {
            arr.push({ id: d.id, ...data });
          }
        });
        // Safe sort with null check
        setItems(arr.sort((a, b) => (a.name || "").localeCompare(b.name || "")));
        setLoading(false);
      },
      (error) => {
        console.error("Firestore snapshot error:", error);
        setLoading(false);
        Alert.alert("Error", "Failed to load inventory. Please try again.");
      }
    );
    return unsub;
  }, [user?.uid]);

  useEffect(() => {
    ensurePrefetch();

    // Cleanup timer on unmount to prevent state updates
    return () => {
      if (timer.current) {
        clearTimeout(timer.current);
      }
    };
  }, []);

  // — Suggestions —
  const onChangeName = (t: string) => {
    setName(t);
    setHighlightIndex(null);
    setFormImageError(false);

    // Clear existing timer
    if (timer.current) {
      clearTimeout(timer.current);
    }

    // Reset if input too short
    if (t.trim().length < 2) {
      setSuggest([]);
      setSuggestLoading(false);
      return;
    }

    // Debounced search with comprehensive error handling
    timer.current = setTimeout(async () => {
      try {
        // Ensure data is loaded before searching
        if (!hasMealDbIngredientsLoaded()) {
          try {
            await prefetchMealDbIngredients();
          } catch (prefetchError) {
            console.warn("MealDB prefetch failed:", prefetchError);
            setSuggestLoading(false);
            return;
          }
        }

        setSuggestLoading(true);
        const results = await searchMealDbIngredients(t, 8);

        // Only update state if results are valid
        if (Array.isArray(results)) {
          setSuggest(results);
        } else {
          setSuggest([]);
        }
      } catch (err) {
        console.error("Ingredient search failed:", err);
        setSuggest([]);
      } finally {
        setSuggestLoading(false);
      }
    }, 300);
  };

  const handleKeyDown = (event: any) => {
    if (!suggest.length) return;
    const key = event.nativeEvent?.key || event.nativeEvent?.code;
    if (key === "ArrowDown") {
      event.preventDefault?.();
      setHighlightIndex((prev) => {
        const next = prev === null ? 0 : Math.min(prev + 1, suggest.length - 1);
        return next;
      });
    } else if (key === "ArrowUp") {
      event.preventDefault?.();
      setHighlightIndex((prev) => {
        if (prev === null) return suggest.length - 1;
        return Math.max(prev - 1, 0);
      });
    } else if (key === "Enter") {
      if (highlightIndex !== null) {
        event.preventDefault?.();
        applySuggestion(suggest[highlightIndex]);
      }
    }
  };

  // — Manual add —
  const ensurePrefetch = () => {
    if (!hasMealDbIngredientsLoaded()) {
      prefetchMealDbIngredients();
    }
  };

  const manualAdd = () => {
    setEditing(null);
    setName("");
    setQty("");
    setUnit("");
    setImg(null);
    setIngredientType(null);
    setExpirationDate(null);
    setCustomDateInput('');
    setFormImageError(false);
    setSuggest([]);
    setSuggestLoading(false);
    setHighlightIndex(null);
    setBulkMode(false);
    setBulkItems([]);
    setFormVisible(true);
    ensurePrefetch();
  };

  // — Save —
  const save = async () => {
    if (!user?.uid) {
      Alert.alert("Error", "Please log in to save ingredients");
      return;
    }

    // Validate inputs with detailed error messages
    const trimmedName = (name ?? "").trim();
    if (!trimmedName) {
      return Alert.alert("Missing Name", "Please enter an ingredient name");
    }

    const trimmedQty = (qty ?? "").trim();
    if (!trimmedQty) {
      return Alert.alert("Missing Quantity", "Please enter a quantity");
    }

    const qn = parseFloat(trimmedQty);
    if (isNaN(qn) || qn <= 0) {
      return Alert.alert("Invalid Quantity", "Please enter a valid positive number");
    }

    if (!unit) {
      return Alert.alert("Missing Unit", "Please select a unit of measurement");
    }

    // Safe capitalize with null check
    const safeName = capitalize(trimmedName);

    // Safe image URL with proper encoding to prevent URL crash
    const safeImageUrl = img ?? mealThumb(encodeURIComponent(trimmedName));

    const data: any = {
      name: safeName,
      quantity: qn,
      unit: unit,
      imageUrl: safeImageUrl,
      ingredientType: ingredientType || null,
      updatedAt: serverTimestamp(),
    };

    // Add expiration date if set
    if (expirationDate) {
      data.expirationDate = Timestamp.fromDate(expirationDate);
    } else if (editing?.id && editing.expirationDate) {
      // Keep existing expiration date if editing and not changed
      data.expirationDate = editing.expirationDate;
    }

    try {
      if (editing?.id) {
        // Validate editing.id exists and is valid
        if (typeof editing.id !== 'string' || !editing.id.trim()) {
          throw new Error("Invalid ingredient ID");
        }
        await updateDoc(
          doc(db, "users", user.uid, "ingredients", editing.id),
          data
        );

        if (bulkMode) {
          // Continue in bulk mode
          setBulkItems([...bulkItems, { name: safeName, quantity: qn, unit }]);
          setName("");
          setQty("");
          setUnit("");
          setImg(null);
        } else {
          setFormVisible(false);
        }
      } else {
        await addDoc(collection(db, "users", user.uid, "ingredients"), {
          ...data,
          createdAt: serverTimestamp(),
        });

        if (bulkMode) {
          // Continue in bulk mode
          setBulkItems([...bulkItems, { name: safeName, quantity: qn, unit }]);
          Alert.alert("Added!", `${safeName} added. Add another or tap Done.`);
          setName("");
          setQty("");
          setUnit("");
          setImg(null);
        } else {
          setFormVisible(false);
        }
      }
    } catch (err) {
      console.error("Save ingredient error:", err);
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      Alert.alert("Save Failed", `Could not save ingredient: ${errorMessage}`);
    }
  };

  const edit = (it: any) => {
    setEditing(it);
    setName(it.name);
    setQty(String(it.quantity));
    setUnit((it.unit ?? "") as Unit);

    setImg(it.imageUrl);
    setIngredientType(it.ingredientType || null);
    setFormImageError(false);

    // Load expiration date if exists
    if (it.expirationDate) {
      const date = it.expirationDate.toDate ? it.expirationDate.toDate() : new Date(it.expirationDate);
      setExpirationDate(date);
      // Format the date for display in the input
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const year = date.getFullYear();
      setCustomDateInput(`${month}/${day}/${year}`);
    } else {
      setExpirationDate(null);
      setCustomDateInput('');
    }

    setSuggest([]);
    setSuggestLoading(false);
    setHighlightIndex(null);
    setBulkMode(false);
    setBulkItems([]);
    setFormVisible(true);
  };

  const del = (it: any) => {
    if (!user?.uid) {
      Alert.alert("Error", "Please log in to delete ingredients");
      return;
    }

    if (!it?.id || !it?.name) {
      Alert.alert("Error", "Invalid ingredient");
      return;
    }

    Alert.alert("Delete", `Remove "${it.name}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteDoc(doc(db, "users", user.uid, "ingredients", it.id));
          } catch (err) {
            console.error("Delete failed:", err);
            Alert.alert("Delete Failed", "Could not delete ingredient. Please try again.");
          }
        },
      },
    ]);
  };

  // Quantity adjustment
  const adjustQuantity = (delta: number) => {
    const current = parseFloat(qty) || 0;
    const newQty = Math.max(0, current + delta);
    setQty(String(newQty));
  };

  // Filtered & sorted
  const filtered = useMemo(() => {
    let arr = items.filter((it) => {
      // Search
      if (search) {
        const s = search.toLowerCase();
        const nm = (it.name ?? "").toLowerCase();
        if (!nm.includes(s)) return false;
      }

      // Category Filter
      if (filter !== "All") {
        const nm = (it.name ?? "").toLowerCase();
        const cat = CAT[filter as keyof typeof CAT] || [];
        if (!cat.some((c) => nm.includes(c))) return false;
      }

      // Expiring Soon Toggle (independent of category)
      if (showExpiringSoon) {
        const expiringSoonItems = filterExpiringSoon(items, 7);
        if (!expiringSoonItems.some(exp => exp.id === it.id)) return false;
      }

      return true;
    });

    // Sort by expiration if toggle is on, otherwise by name
    if (showExpiringSoon) {
      arr.sort((a, b) => {
        if (!a.expirationDate && !b.expirationDate) return 0;
        if (!a.expirationDate) return 1;
        if (!b.expirationDate) return -1;
        const aTime = a.expirationDate.toDate ? a.expirationDate.toDate().getTime() : new Date(a.expirationDate).getTime();
        const bTime = b.expirationDate.toDate ? b.expirationDate.toDate().getTime() : new Date(b.expirationDate).getTime();
        return aTime - bTime;
      });
    } else {
      arr.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    }
    return arr;
  }, [items, search, filter, showExpiringSoon]);

  const renderItem = ({ item }: { item: any }) => {
    const expirationStatus = getExpirationStatus(item);
    const [imageError, setImageError] = React.useState(false);
    const placeholder = getPlaceholderIcon(item.name, item.ingredientType);

    return (
      <TouchableOpacity
        style={styles.itemCard}
        onPress={() => edit(item)}
        onLongPress={() => del(item)}
        accessibilityLabel={`${item.name}, ${item.quantity} ${item.unit}`}
      >
        {item.imageUrl && !imageError ? (
          <Image
            source={{ uri: item.imageUrl }}
            style={styles.itemImg}
            onError={() => setImageError(true)}
          />
        ) : (
          <View style={[styles.itemImg, { backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center' }]}>
            <placeholder.Icon size={32} color={placeholder.color} />
          </View>
        )}
        <View style={styles.itemInfo}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={styles.itemName}>{item.name}</Text>
            {expirationStatus.status !== 'unknown' && (
              <View style={{
                paddingHorizontal: 6,
                paddingVertical: 2,
                borderRadius: 4,
                backgroundColor: expirationStatus.backgroundColor,
              }}>
                <Text style={{
                  fontSize: 10,
                  fontWeight: '600',
                  color: expirationStatus.color,
                }}>
                  {expirationStatus.icon} {expirationStatus.text}
                </Text>
              </View>
            )}
          </View>
          <Text style={styles.itemQty}>
            {item.quantity} {item.unit}
          </Text>
          {item.quantity < 5 && (
            <Text style={styles.lowStockLabel}>Low Stock!</Text>
          )}
          {item.expirationDate && expirationStatus.status !== 'unknown' && (
            <Text style={{ fontSize: 11, color: '#6B7280', marginTop: 2 }}>
              Expires: {formatExpirationDate(item.expirationDate)}
            </Text>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Background>
        <SafeAreaView style={styles.safeArea}>
          <InventoryHeader onAddPress={manualAdd} />

          {/* search + filter */}
          <View style={styles.controlsRow}>
            <View style={styles.searchWrap}>
              <Ionicons
                name="search-outline"
                size={18}
                style={{ marginRight: 6 }}
              />
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder="Search ingredients..."
                style={styles.searchInput}
                placeholderTextColor="#9ca3af"
              />
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterScroll}
            >
              {(
                ["All", "Meat", "Vegetables", "Fruits"] as Filter[]
              ).map((f) => (
                <TouchableOpacity
                  key={f}
                  style={[
                    styles.filterChip,
                    filter === f && styles.filterChipActive,
                  ]}
                  onPress={() => setFilter(f)}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      filter === f && styles.filterChipTextActive,
                    ]}
                  >
                    {f}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Expiring Soon Toggle */}
          <View style={{ paddingHorizontal: 16, paddingVertical: 8 }}>
            <TouchableOpacity
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                paddingHorizontal: 14,
                paddingVertical: 10,
                borderRadius: 20,
                borderWidth: 1.5,
                borderColor: showExpiringSoon ? '#F59E0B' : '#FED7AA',
                backgroundColor: showExpiringSoon ? '#F59E0B' : '#FFF',
                alignSelf: 'flex-start',
              }}
              onPress={() => setShowExpiringSoon(!showExpiringSoon)}
            >
              <Ionicons
                name={showExpiringSoon ? "time" : "time-outline"}
                size={16}
                color={showExpiringSoon ? "#fff" : "#F59E0B"}
              />
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: '600',
                  color: showExpiringSoon ? '#fff' : '#F59E0B',
                }}
              >
                Expiring Soon
              </Text>
            </TouchableOpacity>
          </View>

          {/* list */}
          {loading ? (
            <View style={styles.center}>
              <ActivityIndicator size="large" color="#15803d" />
              <Text style={styles.loadingText}>Loading pantry...</Text>
            </View>
          ) : filtered.length === 0 ? (
            <View style={styles.center}>
              <Ionicons name="leaf-outline" size={64} color="#9ca3af" />
              <Text style={styles.emptyText}>
                {search
                  ? "No ingredients match your search"
                  : filter !== "All"
                  ? `No ${filter.toLowerCase()} found`
                  : "Your pantry is empty"}
              </Text>
              <Text style={styles.emptyHint}>
                {search || filter !== "All"
                  ? "Try a different search or filter"
                  : "Add your first ingredient to get started"}
              </Text>
            </View>
          ) : (
            <FlatList
              data={filtered}
              keyExtractor={(it) => it.id}
              renderItem={renderItem}
              contentContainerStyle={styles.list}
            />
          )}

          {/* FAB - Quick Add */}
          <TouchableOpacity style={styles.fab} onPress={manualAdd}>
            <Ionicons name="add" size={28} color="#fff" />
          </TouchableOpacity>

          {/* Add/Edit Form Modal */}
          <Modal visible={formVisible} animationType="slide" transparent>
            <KeyboardAvoidingView
              style={styles.formWrap}
              behavior={Platform.OS === "ios" ? "padding" : undefined}
            >
              <View style={styles.formBackdrop}>
                <Pressable
                  style={{ flex: 1 }}
                  onPress={() => {
                    if (bulkMode && bulkItems.length > 0) {
                      Alert.alert(
                        "Exit Bulk Mode?",
                        `You've added ${bulkItems.length} item(s). Exit bulk mode?`,
                        [
                          { text: "Cancel", style: "cancel" },
                          {
                            text: "Exit",
                            onPress: () => {
                              setFormVisible(false);
                              setBulkMode(false);
                              setBulkItems([]);
                            },
                          },
                        ]
                      );
                    } else {
                      setFormVisible(false);
                    }
                  }}
                />
                <View style={styles.formCard}>
                  <ScrollView
                    contentContainerStyle={styles.formContent}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                  >
                    <View style={styles.formHeader}>
                      <Text style={styles.formTitle}>
                        {editing ? "Edit Ingredient" : bulkMode ? `Bulk Add (${bulkItems.length} added)` : "Add Ingredient"}
                      </Text>
                      {!editing && (
                        <TouchableOpacity
                          style={[styles.bulkModeBtn, bulkMode && styles.bulkModeBtnActive]}
                          onPress={() => setBulkMode(!bulkMode)}
                        >
                          <Text style={[styles.bulkModeBtnText, bulkMode && styles.bulkModeBtnTextActive]}>
                            {bulkMode ? "Exit Bulk" : "Bulk Mode"}
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>

                    {bulkMode && bulkItems.length > 0 && (
                      <View style={styles.bulkItemsPreview}>
                        <Text style={styles.bulkItemsTitle}>Added items:</Text>
                        {bulkItems.slice(-3).map((item, idx) => (
                          <Text key={idx} style={styles.bulkItemText}>
                            • {item.name} - {item.quantity} {item.unit}
                          </Text>
                        ))}
                      </View>
                    )}

                    {(img || name.trim()) && !formImageError ? (
                      <Image
                        source={{ uri: img ?? mealThumb(name.trim()) }}
                        style={styles.formImg}
                        onError={() => setFormImageError(true)}
                      />
                    ) : (img || name.trim()) ? (
                      (() => {
                        const formPlaceholder = getPlaceholderIcon(name.trim(), ingredientType);
                        return (
                          <View style={[styles.formImg, { backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center' }]}>
                            <formPlaceholder.Icon size={48} color={formPlaceholder.color} />
                          </View>
                        );
                      })()
                    ) : null}
                    <Text style={styles.label}>Name</Text>
                    <TextInput
                      value={name}
                      onChangeText={onChangeName}
                      onKeyPress={handleKeyDown}
                      placeholder="e.g. Tomato"
                      style={styles.input}
                      autoCapitalize="words"
                      autoFocus
                    />
                    {(suggestLoading || suggest.length > 0) && (
                      <View style={styles.suggestPanel}>
                        {suggestLoading && (
                          <View style={styles.suggestLoadingRow}>
                            <ActivityIndicator size="small" color="#0284c7" />
                            <Text style={styles.suggestLoadingText}>Searching TheMealDB…</Text>
                          </View>
                        )}
                        {!suggestLoading &&
                          suggest.map((sg, idx) => (
                            <TouchableOpacity
                              key={sg.name}
                              style={[
                                styles.suggestRow,
                                highlightIndex === idx && styles.suggestRowHighlight,
                              ]}
                              onPress={() => applySuggestion(sg)}
                            >
                              <Text style={styles.suggestName}>{capitalize(sg.name)}</Text>
                              {sg.type ? (
                                <Text style={styles.suggestMeta}>{sg.type}</Text>
                              ) : null}
                            </TouchableOpacity>
                          ))}
                        {!suggestLoading && suggest.length === 0 && (
                          <Text style={styles.suggestEmpty}>No matches found</Text>
                        )}
                      </View>
                    )}
                    <Text style={styles.label}>Quantity</Text>
                    <View style={styles.quantityRow}>
                      <TouchableOpacity
                        style={styles.qtyBtn}
                        onPress={() => adjustQuantity(-1)}
                      >
                        <Minus size={20} color="#15803d" />
                      </TouchableOpacity>
                      <TextInput
                        value={qty}
                        onChangeText={(t) => setQty(sanitizeQuantity(t))}
                        keyboardType="numeric"
                        inputMode="decimal"
                        placeholder="0"
                        style={[styles.input, styles.qtyInput]}
                      />
                      <TouchableOpacity
                        style={styles.qtyBtn}
                        onPress={() => adjustQuantity(1)}
                      >
                        <Plus size={20} color="#15803d" />
                      </TouchableOpacity>
                    </View>
                    <Text style={styles.label}>Unit</Text>
                    <View style={[styles.input, styles.unitPickerContainer]}>
                      <Picker
                        selectedValue={unit}
                        onValueChange={(value) => setUnit(value)}
                        mode="dropdown"
                        dropdownIconColor="#128AFA"
                        style={styles.unitPicker}
                      >
                        {UNIT_OPTIONS.map((option) => (
                          <Picker.Item
                            key={option || "none"}
                            label={option === "" ? "Select unit" : option}
                            value={option}
                          />
                        ))}
                      </Picker>
                    </View>

                    {/* Expiration Date Section */}
                    <Text style={styles.label}>Expiration Date (Optional)</Text>
                    <View style={{ gap: 8 }}>
                      {/* Custom date input */}
                      <TextInput
                        value={customDateInput}
                        onChangeText={(text) => {
                          setCustomDateInput(text);
                          const parsedDate = parseDateInput(text);
                          if (parsedDate) {
                            setExpirationDate(parsedDate);
                          }
                        }}
                        placeholder="MM/DD/YYYY or MM/DD/YY"
                        style={[styles.input, { marginBottom: 0 }]}
                        keyboardType="numeric"
                        maxLength={10}
                      />
                      <Text style={{ fontSize: 11, color: '#6B7280', marginTop: -4 }}>
                        Enter date in MM/DD/YYYY format (e.g., 12/31/2024)
                      </Text>

                      {/* Display selected date */}
                      {expirationDate && (
                        <View style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          backgroundColor: '#F9FAFB',
                          padding: 12,
                          borderRadius: 8,
                          borderWidth: 1,
                          borderColor: '#E5E7EB',
                          marginTop: 4,
                        }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <Calendar size={16} color="#128AFA" />
                            <Text style={{ fontSize: 14, color: '#374151' }}>
                              {expirationDate.toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric'
                              })}
                            </Text>
                          </View>
                          <TouchableOpacity onPress={() => {
                            setExpirationDate(null);
                            setCustomDateInput('');
                          }}>
                            <X size={18} color="#6B7280" />
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>

                    <View style={styles.btnRow}>
                      <TouchableOpacity
                        style={[styles.formBtn, styles.cancelBtn]}
                        onPress={() => {
                          if (bulkMode && bulkItems.length > 0) {
                            Alert.alert(
                              "Exit Bulk Mode?",
                              `You've added ${bulkItems.length} item(s). Exit?`,
                              [
                                { text: "No", style: "cancel" },
                                {
                                  text: "Yes",
                                  onPress: () => {
                                    setFormVisible(false);
                                    setBulkMode(false);
                                    setBulkItems([]);
                                    setSuggest([]);
                                    setSuggestLoading(false);
                                    setHighlightIndex(null);
                                  },
                                },
                              ]
                            );
                          } else {
                            setFormVisible(false);
                            setSuggest([]);
                            setSuggestLoading(false);
                            setHighlightIndex(null);
                          }
                        }}
                      >
                        <Text style={[styles.formBtnTxt, styles.cancelBtnTxt]}>
                          {bulkMode && bulkItems.length > 0 ? "Done" : "Cancel"}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.formBtn, styles.saveBtn]}
                        onPress={save}
                      >
                        <Text style={styles.formBtnTxt}>
                          {editing ? "Update" : bulkMode ? "Add & Continue" : "Save"}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </ScrollView>
                </View>
              </View>
            </KeyboardAvoidingView>
          </Modal>

        </SafeAreaView>
      </Background>
    </GestureHandlerRootView>
  );
}
