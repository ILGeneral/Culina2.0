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
  writeBatch,
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
import { ShoppingCart, Plus, Minus, Calendar, AlertCircle, X } from "lucide-react-native";
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

const mealThumb = (n: string) =>
  `https://www.themealdb.com/images/ingredients/${encodeURIComponent(n)}.png`;

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

// Smart Unit Suggestions based on ingredient type
const SMART_UNIT_MAP: Record<string, Unit> = {
  // Liquids
  milk: "l",
  water: "l",
  juice: "ml",
  oil: "ml",
  vinegar: "ml",
  sauce: "ml",
  cream: "ml",

  // Countable items
  egg: "pieces",
  apple: "pieces",
  banana: "pieces",
  orange: "pieces",
  tomato: "pieces",
  onion: "pieces",
  potato: "pieces",
  carrot: "pieces",

  // Dry goods/powders
  flour: "g",
  sugar: "g",
  salt: "g",
  rice: "kg",
  pasta: "g",

  // Sliced items
  bread: "slices",
  cheese: "slices",
  ham: "slices",

  // Spices/herbs
  garlic: "cloves",
  basil: "bunches",
  parsley: "bunches",

  // Canned/packaged
  "canned": "cans",
  "bottled": "bottles",
};

// Function to get smart unit suggestion
const getSmartUnit = (ingredientName: string): Unit => {
  const lower = ingredientName.toLowerCase().trim();

  // Check exact matches first
  if (SMART_UNIT_MAP[lower]) {
    return SMART_UNIT_MAP[lower];
  }

  // Check partial matches
  for (const [key, unit] of Object.entries(SMART_UNIT_MAP)) {
    if (lower.includes(key)) {
      return unit;
    }
  }

  // Default
  return "";
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
  const [suggest, setSuggest] = useState<MealDbIngredient[]>([]);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Expiration date state
  const [expirationDate, setExpirationDate] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [datePickerMode, setDatePickerMode] = useState<'calendar' | 'quick'>('quick');

  // Bulk add mode
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkItems, setBulkItems] = useState<Array<{name: string, quantity: number, unit: Unit}>>([]);

  // Shopping list
  const [shoppingListVisible, setShoppingListVisible] = useState(false);
  const [shoppingList, setShoppingList] = useState<any[]>([]);

  const applySuggestion = (ingredient: MealDbIngredient) => {
    const ingredientName = capitalize(ingredient.name);
    setName(ingredientName);

    // Apply smart unit suggestion
    const smartUnit = getSmartUnit(ingredientName);
    if (smartUnit && !unit) {
      setUnit(smartUnit);
    }

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

  // Shopping list listener
  useEffect(() => {
    if (!user?.uid) {
      setShoppingList([]);
      return;
    }

    const q = query(collection(db, "users", user.uid, "shoppingList"));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const arr: any[] = [];
        snap.forEach((d) => {
          const data = d.data();
          if (data?.name && !data?.purchased) {
            arr.push({ id: d.id, ...data });
          }
        });
        setShoppingList(arr.sort((a, b) => (a.name || "").localeCompare(b.name || "")));
      },
      (error) => {
        console.error("Shopping list snapshot error:", error);
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
    setExpirationDate(null);
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

    // Load expiration date if exists
    if (it.expirationDate) {
      const date = it.expirationDate.toDate ? it.expirationDate.toDate() : new Date(it.expirationDate);
      setExpirationDate(date);
    } else {
      setExpirationDate(null);
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

  // Shopping list functions
  const addToShoppingList = async (item: any) => {
    const currentUser = auth.currentUser;
    if (!currentUser?.uid) {
      Alert.alert("Error", "You must be logged in to add items to shopping list");
      return;
    }

    try {
      await addDoc(collection(db, "users", currentUser.uid, "shoppingList"), {
        name: item.name,
        quantity: item.quantity,
        unit: item.unit,
        imageUrl: item.imageUrl,
        purchased: false,
        createdAt: serverTimestamp(),
      });
      Alert.alert("Added to Shopping List", `${item.name} added to your shopping list`);
    } catch (err) {
      console.error("Add to shopping list failed:", err);
      Alert.alert("Error", "Failed to add to shopping list");
    }
  };

  const markPurchased = async (itemId: string) => {
    const currentUser = auth.currentUser;
    if (!currentUser?.uid) return;

    try {
      await updateDoc(
        doc(db, "users", currentUser.uid, "shoppingList", itemId),
        { purchased: true, purchasedAt: serverTimestamp() }
      );
    } catch (err) {
      console.error("Mark purchased failed:", err);
    }
  };

  const addLowStockToShoppingList = async () => {
    const currentUser = auth.currentUser;
    if (!currentUser?.uid) return;

    const lowStockItems = items.filter(item => item.quantity < 5);

    if (lowStockItems.length === 0) {
      Alert.alert("All Stocked!", "You don't have any low stock items.");
      return;
    }

    try {
      const batch = writeBatch(db);

      lowStockItems.forEach(item => {
        const ref = doc(collection(db, "users", currentUser.uid, "shoppingList"));
        batch.set(ref, {
          name: item.name,
          quantity: 5, // Suggest restocking to 5 units
          unit: item.unit,
          imageUrl: item.imageUrl,
          purchased: false,
          createdAt: serverTimestamp(),
        });
      });

      await batch.commit();
      Alert.alert("Added to Shopping List", `${lowStockItems.length} low stock items added!`);
      setShoppingListVisible(true);
    } catch (err) {
      console.error("Batch add failed:", err);
      Alert.alert("Error", "Failed to create shopping list");
    }
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

    return (
      <TouchableOpacity
        style={styles.itemCard}
        onPress={() => edit(item)}
        onLongPress={() => del(item)}
        accessibilityLabel={`${item.name}, ${item.quantity} ${item.unit}`}
      >
        {item.imageUrl && (
          <Image source={{ uri: item.imageUrl }} style={styles.itemImg} />
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
        <TouchableOpacity
          style={styles.addToCartBtn}
          onPress={(e) => {
            e.stopPropagation();
            addToShoppingList(item);
          }}
        >
          <ShoppingCart size={20} color="#15803d" />
        </TouchableOpacity>
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

          {/* Shopping List Button */}
          <View style={styles.shoppingListBtnContainer}>
            <TouchableOpacity
              style={styles.shoppingListBtn}
              onPress={() => setShoppingListVisible(true)}
            >
              <ShoppingCart size={18} color="#fff" />
              <Text style={styles.shoppingListBtnText}>
                Shopping List ({shoppingList.length})
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.addLowStockBtn}
              onPress={addLowStockToShoppingList}
            >
              <Text style={styles.addLowStockBtnText}>+ Low Stock</Text>
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

                    {(img || name.trim()) && (
                      <Image
                        source={{ uri: img ?? mealThumb(name.trim()) }}
                        style={styles.formImg}
                      />
                    )}
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
                      {/* Quick date buttons */}
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                        <TouchableOpacity
                          style={{
                            paddingHorizontal: 12,
                            paddingVertical: 8,
                            borderRadius: 8,
                            backgroundColor: '#F3F4F6',
                            borderWidth: 1,
                            borderColor: '#E5E7EB',
                          }}
                          onPress={() => {
                            const date = new Date();
                            date.setDate(date.getDate() + 3);
                            setExpirationDate(date);
                          }}
                        >
                          <Text style={{ fontSize: 13, color: '#374151' }}>3 days</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={{
                            paddingHorizontal: 12,
                            paddingVertical: 8,
                            borderRadius: 8,
                            backgroundColor: '#F3F4F6',
                            borderWidth: 1,
                            borderColor: '#E5E7EB',
                          }}
                          onPress={() => {
                            const date = new Date();
                            date.setDate(date.getDate() + 7);
                            setExpirationDate(date);
                          }}
                        >
                          <Text style={{ fontSize: 13, color: '#374151' }}>1 week</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={{
                            paddingHorizontal: 12,
                            paddingVertical: 8,
                            borderRadius: 8,
                            backgroundColor: '#F3F4F6',
                            borderWidth: 1,
                            borderColor: '#E5E7EB',
                          }}
                          onPress={() => {
                            const date = new Date();
                            date.setDate(date.getDate() + 14);
                            setExpirationDate(date);
                          }}
                        >
                          <Text style={{ fontSize: 13, color: '#374151' }}>2 weeks</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={{
                            paddingHorizontal: 12,
                            paddingVertical: 8,
                            borderRadius: 8,
                            backgroundColor: '#F3F4F6',
                            borderWidth: 1,
                            borderColor: '#E5E7EB',
                          }}
                          onPress={() => {
                            const date = new Date();
                            date.setMonth(date.getMonth() + 1);
                            setExpirationDate(date);
                          }}
                        >
                          <Text style={{ fontSize: 13, color: '#374151' }}>1 month</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={{
                            paddingHorizontal: 12,
                            paddingVertical: 8,
                            borderRadius: 8,
                            backgroundColor: '#FEF3C7',
                            borderWidth: 1,
                            borderColor: '#FCD34D',
                          }}
                          onPress={() => setShowDatePicker(true)}
                        >
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                            <Calendar size={14} color="#CA8A04" />
                            <Text style={{ fontSize: 13, color: '#CA8A04', fontWeight: '600' }}>Custom</Text>
                          </View>
                        </TouchableOpacity>
                      </View>

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
                          <TouchableOpacity onPress={() => setExpirationDate(null)}>
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

          {/* Custom Date Picker Modal */}
          <Modal visible={showDatePicker} animationType="fade" transparent>
            <View style={{
              flex: 1,
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
              justifyContent: 'center',
              alignItems: 'center',
            }}>
              <View style={{
                backgroundColor: '#fff',
                borderRadius: 16,
                padding: 20,
                width: '85%',
                maxWidth: 400,
              }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <Text style={{ fontSize: 18, fontWeight: '700', color: '#111827' }}>
                    Select Expiration Date
                  </Text>
                  <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                    <X size={24} color="#6B7280" />
                  </TouchableOpacity>
                </View>

                <View style={{ gap: 12 }}>
                  {[7, 14, 30, 60, 90].map((days) => (
                    <TouchableOpacity
                      key={days}
                      style={{
                        padding: 14,
                        borderRadius: 10,
                        backgroundColor: '#F3F4F6',
                        borderWidth: 1,
                        borderColor: '#E5E7EB',
                      }}
                      onPress={() => {
                        const date = new Date();
                        date.setDate(date.getDate() + days);
                        setExpirationDate(date);
                        setShowDatePicker(false);
                      }}
                    >
                      <Text style={{ fontSize: 15, color: '#374151', fontWeight: '500' }}>
                        {days === 7 ? '1 week' : days === 14 ? '2 weeks' : days === 30 ? '1 month' : days === 60 ? '2 months' : '3 months'}
                      </Text>
                      <Text style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>
                        {new Date(Date.now() + days * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric'
                        })}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <TouchableOpacity
                  style={{
                    marginTop: 16,
                    padding: 12,
                    borderRadius: 8,
                    backgroundColor: '#F9FAFB',
                    alignItems: 'center',
                  }}
                  onPress={() => setShowDatePicker(false)}
                >
                  <Text style={{ fontSize: 14, color: '#6B7280', fontWeight: '600' }}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>

          {/* Shopping List Modal */}
          <Modal visible={shoppingListVisible} animationType="slide" transparent>
            <KeyboardAvoidingView style={styles.formWrap} behavior={Platform.OS === "ios" ? "padding" : undefined}>
              <View style={styles.formBackdrop}>
                <Pressable style={{ flex: 1 }} onPress={() => setShoppingListVisible(false)} />
                <View style={styles.formCard}>
                  <View style={styles.formHeader}>
                    <Text style={styles.formTitle}>Shopping List</Text>
                    <TouchableOpacity onPress={() => setShoppingListVisible(false)}>
                      <Ionicons name="close" size={24} color="#374151" />
                    </TouchableOpacity>
                  </View>

                  {shoppingList.length === 0 ? (
                    <View style={styles.emptyShoppingList}>
                      <ShoppingCart size={48} color="#9ca3af" />
                      <Text style={styles.emptyText}>Your shopping list is empty</Text>
                      <Text style={styles.emptyHint}>Add items to your shopping list to see them here</Text>
                    </View>
                  ) : (
                    <ScrollView contentContainerStyle={styles.shoppingListContent}>
                      {shoppingList.map((item) => (
                        <View key={item.id} style={styles.shoppingListItem}>
                          <TouchableOpacity
                            style={styles.shoppingListCheckbox}
                            onPress={() => markPurchased(item.id)}
                          >
                            <View style={styles.checkbox} />
                          </TouchableOpacity>
                          <View style={styles.shoppingListInfo}>
                            <Text style={styles.shoppingListName}>{item.name}</Text>
                            <Text style={styles.shoppingListQty}>
                              {item.quantity} {item.unit}
                            </Text>
                          </View>
                        </View>
                      ))}
                    </ScrollView>
                  )}
                </View>
              </View>
            </KeyboardAvoidingView>
          </Modal>
        </SafeAreaView>
      </Background>
    </GestureHandlerRootView>
  );
}
