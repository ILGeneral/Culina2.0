import * as FileSystem from "expo-file-system/legacy";
import * as ImageManipulator from 'expo-image-manipulator';
import React, { useEffect, useMemo, useRef, useState } from "react";
import styles from "@/styles/inventoryStyle";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Modal,
  Image,
  TextInput,
  Alert,
  Dimensions,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
} from "react-native";
import { Picker } from "@react-native-picker/picker";

import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { CameraView, useCameraPermissions } from "expo-camera";
import {
  BottomSheetModal,
  BottomSheetBackdrop,
  BottomSheetView,
  BottomSheetModalProvider,
} from "@gorhom/bottom-sheet";
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
import { detectFoodFromImage, API_BASE } from "@/lib/clarifai";
import {
  searchMealDbIngredients,
  type MealDbIngredient,
  prefetchMealDbIngredients,
  hasMealDbIngredientsLoaded,
} from "@/lib/mealdb";
import Background from "@/components/Background";
import { GestureHandlerRootView } from "react-native-gesture-handler";

// —— helpers ——
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
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
type Filter = "All" | "Low Stock" | "Meat" | "Vegetables" | "Fruits";
const CAT: Record<Exclude<Filter, "All" | "Low Stock">, string[]> = {
  Meat: ["chicken", "beef", "pork", "bacon", "turkey", "ham"],
  Vegetables: [
    "tomato",
    "onion",
    "garlic",
    "carrot",
    "potato",
    "broccoli",
    "spinach",
  ],
  Fruits: [
    "apple",
    "banana",
    "mango",
    "orange",
    "grape",
    "pineapple",
    "strawberry",
  ],
};

// —— main ——
export default function InventoryScreen() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("All");

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

  const applySuggestion = (ingredient: MealDbIngredient) => {
    setName(capitalize(ingredient.name));
    setSuggest([]);
    setSuggestLoading(false);
    setHighlightIndex(null);
  };

  // camera
  const [camOpen, setCamOpen] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const camRef = useRef<CameraView | null>(null);
  const [uploading, setUploading] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [capturedPhoto, setCapturedPhoto] = useState<{
    uri: string;
    base64?: string;
  } | null>(null);
  const [previewVisible, setPreviewVisible] = useState(false);

  // bottom sheet
  const sheetRef = useRef<BottomSheetModal>(null);
  const snap = useMemo(() => ["26%"], []);

  const user = auth.currentUser;

  // — Firestore listener —
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "users", user.uid, "ingredients"));
    const unsub = onSnapshot(q, (snap) => {
      const arr: any[] = [];
      snap.forEach((d) => arr.push({ id: d.id, ...d.data() }));
      setItems(arr.sort((a, b) => a.name.localeCompare(b.name)));
      setLoading(false);
    });
    return unsub;
  }, [user]);

  useEffect(() => {
    ensurePrefetch();
  }, []);

  // — Suggestions —
  const onChangeName = (t: string) => {
    setName(t);
    setHighlightIndex(null);
    if (timer.current) clearTimeout(timer.current);
    if (t.trim().length < 2) {
      setSuggest([]);
      setSuggestLoading(false);
      return;
    }
    timer.current = setTimeout(async () => {
      if (!hasMealDbIngredientsLoaded()) {
        await prefetchMealDbIngredients();
      }
      setSuggestLoading(true);
      const results = await searchMealDbIngredients(t, 8);
      setSuggest(results);
      setSuggestLoading(false);
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

  const handleCameraFocus = async (event: any) => {
    if (!camRef.current) return;
    const { locationX, locationY } = event.nativeEvent;
    const xNormalized = Math.min(Math.max(locationX / SCREEN_WIDTH, 0), 1);
    const yNormalized = Math.min(Math.max(locationY / SCREEN_HEIGHT, 0), 1);
    try {
      await (camRef.current as any)?.focus?.({
        x: xNormalized,
        y: yNormalized,
      });
    } catch (err) {
      console.warn("Camera focus failed", err);
    }
  };

  const handleCapturePress = async () => {
    if (capturing || uploading || previewVisible) return;
    try {
      setCapturing(true);
      await new Promise((resolve) => setTimeout(resolve, 250));

      const p = await camRef.current?.takePictureAsync({
        base64: false,
        quality: 0.3, // Reduced from 0.5 to keep file size small
        imageType: "jpg",
        skipProcessing: true,
      });

      if (p?.uri) {
        setCapturedPhoto(p);
        setPreviewVisible(true);
      }
    } catch {
      Alert.alert("Capture failed");
    } finally {
      setCapturing(false);
    }
  };

  const retakePhoto = () => {
    if (uploading) return;
    setPreviewVisible(false);
    setCapturedPhoto(null);
  };

  const confirmScan = async () => {
    if (!capturedPhoto || uploading) return;
    await handleCapture(capturedPhoto);
  };

  // — Add sheet —
  const openSheet = () => sheetRef.current?.present();
  const closeSheet = () => sheetRef.current?.dismiss();

  // — Manual add —
  const ensurePrefetch = () => {
    if (!hasMealDbIngredientsLoaded()) {
      prefetchMealDbIngredients();
    }
  };

  const manualAdd = () => {
    closeSheet();
    setEditing(null);
    setName("");
    setQty("");
    setUnit("");
    setImg(null);
    setSuggest([]);
    setSuggestLoading(false);
    setHighlightIndex(null);
    setFormVisible(true);
    ensurePrefetch();
  };

  // — Camera add —
  const cameraAdd = async () => {
    closeSheet();
    if (!permission?.granted) {
      const res = await requestPermission();
      if (!res.granted) return;
    }
    setEditing(null);
    setName("");
    setQty("");
    setUnit("");
    setImg(null);
    setSuggest([]);
    setCapturedPhoto(null);
    setPreviewVisible(false);
    setCamOpen(true);
    ensurePrefetch();
  };

  const handleCapture = async (photo: { uri: string }) => {
    let success = false;

    try {
      if (!user) return;
      setUploading(true);

      // Step 1: Resize and compress the image
      // Food detection works well with smaller images (max 1024px)
      const manipResult = await ImageManipulator.manipulateAsync(
        photo.uri,
        [
          // Resize to max 1024px on longest side while maintaining aspect ratio
          { resize: { width: 1024 } }
        ],
        {
          compress: 0.6, // 60% quality - good balance for food detection
          format: ImageManipulator.SaveFormat.JPEG,
          base64: false
        }
      );

      console.log('📸 Image resized to:', manipResult.width, 'x', manipResult.height);

      // Step 2: Read compressed image as binary
      const fileData = await FileSystem.readAsStringAsync(manipResult.uri, {
        encoding: "base64",
      });
      
      if (!fileData) {
        throw new Error("Failed to read image file");
      }
      
      // Check file size (base64 string length / 1.37 ≈ binary size in bytes)
      const estimatedSizeKB = Math.round((fileData.length / 1.37) / 1024);
      console.log(`📦 Compressed image size: ~${estimatedSizeKB}KB`);
      
      const binary = Uint8Array.from(atob(fileData), (c) => c.charCodeAt(0));

      // Step 3: Upload to Vercel Blob via backend
      const uploadRes = await fetch(`${API_BASE}/api/upload-ingredient-image`, {
        method: "POST",
        headers: {
          "Content-Type": "image/jpeg",
        },
        body: binary,
      });

      if (!uploadRes.ok) {
        const errText = await uploadRes.text();
        throw new Error(`Upload failed: ${uploadRes.status} - ${errText}`);
      }

      const uploadResult = await uploadRes.json();
      const blobUrl = uploadResult.url;
      console.log("✅ Uploaded to Vercel Blob:", blobUrl);

      // Step 4: Send blob URL to Clarifai
      try {
        const det = await detectFoodFromImage({ url: blobUrl });
        const topConcept = Array.isArray(det) ? det[0]?.name : undefined;

        if (topConcept) {
          setName(capitalize(topConcept));
        } else {
          Alert.alert("No ingredients detected", "Try capturing a clearer photo.");
        }

        success = true;
        setCamOpen(false);
        setFormVisible(true);
      } catch (clarifaiError) {
        console.error("Clarifai detection error:", clarifaiError);
        Alert.alert("Error", "Failed to detect ingredient. Please try again.");
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error("❌ Upload error:", errorMessage);
      Alert.alert("Upload failed", errorMessage);
    } finally {
      setUploading(false);
      if (success) {
        setPreviewVisible(false);
        setCapturedPhoto(null);
      }
    }
  };

  // — Save —
  const save = async () => {
    if (!user) return;
    if (!name.trim() || !qty) return Alert.alert("Missing fields");
    const qn = parseFloat(qty);
    if (isNaN(qn)) return Alert.alert("Invalid quantity");
    if (!unit) return Alert.alert("Missing unit", "Please select a unit.");
    const u = unit;

    const data = {
      name: capitalize(name),
      quantity: qn,
      unit: u,
      imageUrl: img ?? mealThumb(name),
      updatedAt: serverTimestamp(),
    };
    try {
      if (editing?.id)
        await updateDoc(
          doc(db, "users", user.uid, "ingredients", editing.id),
          data
        );
      else
        await addDoc(collection(db, "users", user.uid, "ingredients"), {
          ...data,
          createdAt: serverTimestamp(),
        });
      setFormVisible(false);
    } catch {
      Alert.alert("Error", "Failed to save.");
    }
  };

  const edit = (it: any) => {
    setEditing(it);
    setName(it.name);
    setQty(String(it.quantity));
    setUnit((it.unit ?? "") as Unit);

    setImg(it.imageUrl);
    setSuggest([]);
    setSuggestLoading(false);
    setHighlightIndex(null);
    setFormVisible(true);
  };

  const del = (it: any) => {
    if (!user) return;
    Alert.alert("Delete", `Remove "${it.name}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () =>
          deleteDoc(doc(db, "users", user.uid, "ingredients", it.id)),
      },
    ]);
  };

  const pass = (it: any) => {
    if (filter === "All") return true;
    if (filter === "Low Stock") return it.quantity <= 1;
    return CAT[filter].some((k) => it.name.toLowerCase().includes(k));
  };
  const filtered = items.filter(
    (i) => i.name.toLowerCase().includes(search.toLowerCase()) && pass(i)
  );

  // — render —
  const render = ({ item }: any) => (
    <Pressable
      onPress={() => edit(item)}
      onLongPress={() => del(item)}
      style={styles.tile}
    >
      <Image
        source={{ uri: item.imageUrl ?? mealThumb(item.name) }}
        style={styles.tileImg}
      />
      <Text style={styles.tileName}>{item.name}</Text>
      <Text style={styles.tileQty}>
        {item.quantity} {item.unit}
      </Text>
    </Pressable>
  );

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <BottomSheetModalProvider>
        <Background>
          <SafeAreaView style={styles.container}>
            {/* header */}
            <View style={styles.head}>
              <Text style={styles.title}>My Pantry</Text>
              <View style={styles.search}>
                <Ionicons name="search" size={18} color="#6b7280" />
                <TextInput
                  value={search}
                  onChangeText={setSearch}
                  placeholder="Search ingredients..."
                  style={styles.searchInput}
                />
                {search.length > 0 && (
                  <TouchableOpacity onPress={() => setSearch("")}>
                    <Ionicons name="close-circle" size={18} color="#9ca3af" />
                  </TouchableOpacity>
                )}
              </View>
              <View style={styles.filters}>
                {(
                  [
                    "All",
                    "Low Stock",
                    "Meat",
                    "Vegetables",
                    "Fruits",
                  ] as Filter[]
                ).map((f) => (
                  <TouchableOpacity
                    key={f}
                    style={[styles.fChip, filter === f && styles.fChipOn]}
                    onPress={() => setFilter(f)}
                  >
                    <Text style={[styles.fTxt, filter === f && styles.fTxtOn]}>{f}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {loading ? (
              <View style={[styles.center, { flex: 1 }]}>
                <ActivityIndicator size="large" />
              </View>
            ) : (
              <FlatList
                data={filtered}
                keyExtractor={(i) => i.id}
                numColumns={2}
                columnWrapperStyle={{ gap: 12 }}
                contentContainerStyle={{
                  paddingHorizontal: 16,
                  paddingBottom: 120,
                  gap: 12,
                }}
                renderItem={render}
              />
            )}

            {/* FAB */}
            <TouchableOpacity style={styles.fab} onPress={openSheet}>
              <Ionicons name="add" size={28} color="#fff" />
            </TouchableOpacity>

            {/* bottom sheet */}
            <BottomSheetModal
              ref={sheetRef}
              index={0}
              snapPoints={snap}
              backdropComponent={(p) => (
                <BottomSheetBackdrop
                  appearsOnIndex={0}
                  disappearsOnIndex={-1}
                  {...p}
                />
              )}
              enablePanDownToClose
            >
              <BottomSheetView
                style={{ paddingHorizontal: 16, paddingBottom: 8 }}
              >
                <Text style={styles.sheetTitle}>Add Ingredient</Text>
                <TouchableOpacity style={styles.sheetOpt} onPress={cameraAdd}>
                  <Ionicons
                    name="camera-outline"
                    size={22}
                    style={{ marginRight: 12 }}
                  />
                  <Text style={styles.sheetTxt}>Use Camera</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.sheetOpt} onPress={manualAdd}>
                  <Ionicons
                    name="pencil-outline"
                    size={22}
                    style={{ marginRight: 12 }}
                  />
                  <Text style={styles.sheetTxt}>Type Manually</Text>
                </TouchableOpacity>
              </BottomSheetView>
            </BottomSheetModal>

            <Modal visible={formVisible} animationType="slide" transparent>
              <KeyboardAvoidingView
                style={styles.formWrap}
                behavior={Platform.OS === "ios" ? "padding" : undefined}
              >
                <View style={styles.formBackdrop}>
                  <Pressable
                    style={{ flex: 1 }}
                    onPress={() => setFormVisible(false)}
                  />
                  <View style={styles.formCard}>
                    <ScrollView
                      contentContainerStyle={styles.formContent}
                      keyboardShouldPersistTaps="handled"
                      showsVerticalScrollIndicator={false}
                    >
                      <Text style={styles.formTitle}>
                        {editing ? "Edit Ingredient" : "Add Ingredient"}
                      </Text>
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
                      <TextInput
                        value={qty}
                        onChangeText={(t) => setQty(sanitizeQuantity(t))}
                        keyboardType="numeric"
                        inputMode="decimal"
                        placeholder="0"
                        style={styles.input}
                      />
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

                      <View style={styles.btnRow}>
                        <TouchableOpacity
                          style={[styles.formBtn, styles.cancelBtn]}
                          onPress={() => {
                            setFormVisible(false);
                            setSuggest([]);
                            setSuggestLoading(false);
                            setHighlightIndex(null);
                          }}
                        >
                          <Text style={[styles.formBtnTxt, styles.cancelBtnTxt]}>
                            Cancel
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.formBtn, styles.saveBtn]}
                          onPress={save}
                        >
                          <Text style={styles.formBtnTxt}>
                            {editing ? "Update" : "Save"}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </ScrollView>
                  </View>
                </View>
              </KeyboardAvoidingView>
            </Modal>

            {/* camera */}
            <Modal visible={camOpen} animationType="fade">
              <View style={styles.cameraContainer}>
                {!permission?.granted ? (
                  <View style={styles.center}>
                    <Text style={styles.cameraPermissionText}>
                      Camera permission required
                    </Text>
                    <TouchableOpacity
                      onPress={requestPermission}
                      style={styles.cameraPermissionBtn}
                    >
                      <Text style={styles.cameraPermissionBtnText}>Grant Permission</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => setCamOpen(false)}
                      style={styles.cameraCancelBtn}
                    >
                      <Text style={styles.cameraCancelBtnText}>Cancel</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={styles.cameraContainer}>
                    <View style={styles.previewWrapper}>
                      <CameraView
                        ref={camRef}
                        style={styles.cameraPreview}
                        facing="back"
                      >
                        {/* Camera preview only */}
                      </CameraView>
                      {!previewVisible && (
                        <TouchableWithoutFeedback onPress={handleCameraFocus}>
                          <View style={styles.focusLayer} />
                        </TouchableWithoutFeedback>
                      )}
                      <TouchableOpacity
                        onPress={() => setCamOpen(false)}
                        style={styles.topCloseButton}
                      >
                        <Ionicons name="arrow-back" size={26} color="#fff" />
                      </TouchableOpacity>
                      {!previewVisible && (
                        <>
                          <View pointerEvents="none" style={styles.frameCorners}>
                            <View style={[styles.frameCorner, styles.frameCorner_tl]} />
                            <View style={[styles.frameCorner, styles.frameCorner_tr]} />
                            <View style={[styles.frameCorner, styles.frameCorner_bl]} />
                            <View style={[styles.frameCorner, styles.frameCorner_br]} />
                          </View>
                          <View pointerEvents="none" style={styles.reticleOverlay}>
                            <View style={styles.reticleCircle} />
                            <View style={styles.reticleLineHorizontal} />
                            <View style={styles.reticleLineVertical} />
                            <Text style={styles.reticlePlus}>+</Text>
                          </View>
                        </>
                      )}
                      {previewVisible && capturedPhoto && (
                        <View style={styles.previewOverlay}>
                          <Image
                            source={{ uri: capturedPhoto.uri }}
                            style={styles.previewImage}
                            resizeMode="cover"
                          />
                        </View>
                      )}
                    </View>
                    <View style={styles.camOverlayPanel}>
                      {previewVisible && capturedPhoto ? (
                        <View style={styles.previewActions}>
                          <TouchableOpacity
                            style={styles.previewSecondaryBtn}
                            onPress={retakePhoto}
                            disabled={uploading}
                          >
                            <Text style={styles.previewSecondaryBtnText}>Retake</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.previewPrimaryBtn}
                            onPress={confirmScan}
                            disabled={uploading}
                          >
                            {uploading ? (
                              <ActivityIndicator color="#111827" />
                            ) : (
                              <Text style={styles.previewPrimaryBtnText}>Scan</Text>
                            )}
                          </TouchableOpacity>
                        </View>
                      ) : (
                        <TouchableOpacity
                          disabled={capturing || uploading}
                          onPress={handleCapturePress}
                          style={styles.captureButton}
                          accessibilityLabel="Capture and scan ingredient"
                        >
                          {capturing || uploading ? (
                            <ActivityIndicator color="#fff" />
                          ) : (
                            <View style={styles.captureInner} />
                          )}
                        </TouchableOpacity>
                      )}
                      <Text style={styles.scanPrompt}>
                        {uploading
                          ? "Scanning ingredient..."
                          : previewVisible
                          ? "Confirm the photo before scanning"
                          : capturing
                          ? "Capturing..."
                          : "Tap the red button to capture"}
                      </Text>
                    </View>
                  </View>
                )}
              </View>
            </Modal>
          </SafeAreaView>
        </Background>
      </BottomSheetModalProvider>
    </GestureHandlerRootView>
  );
};