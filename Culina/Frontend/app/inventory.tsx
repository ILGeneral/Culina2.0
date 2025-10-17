import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Modal,
  Image,
  StyleSheet,
  TextInput,
  Alert,
  Dimensions,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { CameraView, useCameraPermissions } from "expo-camera";
import { BottomSheetModal, BottomSheetBackdrop, BottomSheetView } from "@gorhom/bottom-sheet";
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
import { uploadImageAsync } from "@/lib/uploadImage";
import { detectFoodFromImage } from "@/lib/clarifai";
import Background from "@/components/Background";

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
const UNITS = ["g", "kg", "ml", "L", "pcs"] as const;
type Unit = (typeof UNITS)[number];
type Filter = "All" | "Low Stock" | "Meat" | "Vegetables" | "Fruits";
const CAT: Record<Exclude<Filter, "All" | "Low Stock">, string[]> = {
  Meat: ["chicken", "beef", "pork", "bacon", "turkey", "ham"],
  Vegetables: ["tomato", "onion", "garlic", "carrot", "potato", "broccoli", "spinach"],
  Fruits: ["apple", "banana", "mango", "orange", "grape", "pineapple", "strawberry"],
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
  const [unit, setUnit] = useState("");
  const [unitChip, setUnitChip] = useState<Unit | null>(null);
  const [img, setImg] = useState<string | null>(null);
  const [suggest, setSuggest] = useState<string[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // camera
  const [camOpen, setCamOpen] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const camRef = useRef<CameraView | null>(null);
  const [uploading, setUploading] = useState(false);

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

  // — Suggestions —
  const onChangeName = (t: string) => {
    setName(t);
    if (timer.current) clearTimeout(timer.current);
    if (t.trim().length < 2) return setSuggest([]);
    timer.current = setTimeout(async () => {
      try {
        const r = await fetch(
          `https://www.themealdb.com/api/json/v1/1/search.php?i=${encodeURIComponent(t)}`
        );
        const d = await r.json();
        if (d?.ingredients)
          setSuggest(
            Array.from(
              new Set(
                d.ingredients.map((i: any) => capitalize(String(i.strIngredient)))
              )
            ).slice(0, 8) as string[]
          );
      } catch {
        setSuggest([]);
      }
    }, 300);
  };

  // — Add sheet —
  const openSheet = () => sheetRef.current?.present();
  const closeSheet = () => sheetRef.current?.dismiss();

  // — Manual add —
  const manualAdd = () => {
    closeSheet();
    setEditing(null);
    setName("");
    setQty("");
    setUnit("");
    setUnitChip(null);
    setImg(null);
    setSuggest([]);
    setFormVisible(true);
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
    setUnitChip(null);
    setImg(null);
    setSuggest([]);
    setCamOpen(true);
  };

  const handleCapture = async (photo: { uri: string }) => {
    try {
      if (!user) return;
      setUploading(true);
      const url = await uploadImageAsync(photo.uri, user.uid);
      setImg(url);
      const det = await detectFoodFromImage(url);
      if (det && typeof det === "string") setName(capitalize(det));
      setCamOpen(false);
      setFormVisible(true);
    } catch {
      Alert.alert("Error", "Failed to process image.");
    } finally {
      setUploading(false);
    }
  };

  // — Save —
  const save = async () => {
    if (!user) return;
    if (!name.trim() || !qty) return Alert.alert("Missing fields");
    const qn = parseFloat(qty);
    if (isNaN(qn)) return Alert.alert("Invalid quantity");
    const u = unitChip ?? (unit.trim() || "pcs");
    const data = {
      name: capitalize(name),
      quantity: qn,
      unit: u,
      imageUrl: img ?? mealThumb(name),
      updatedAt: serverTimestamp(),
    };
    try {
      if (editing?.id)
        await updateDoc(doc(db, "users", user.uid, "ingredients", editing.id), data);
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
    setUnit(it.unit);
    setUnitChip(UNITS.includes(it.unit) ? it.unit : null);
    setImg(it.imageUrl);
    setSuggest([]);
    setFormVisible(true);
  };

  const del = (it: any) => {
    if (!user) return;
    Alert.alert("Delete", `Remove "${it.name}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => deleteDoc(doc(db, "users", user.uid, "ingredients", it.id)),
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
    <Pressable onPress={() => edit(item)} onLongPress={() => del(item)} style={s.tile}>
      <Image source={{ uri: item.imageUrl ?? mealThumb(item.name) }} style={s.tileImg} />
      <Text style={s.tileName}>{item.name}</Text>
      <Text style={s.tileQty}>
        {item.quantity} {item.unit}
      </Text>
    </Pressable>
  );

  return (
    <Background>
      <SafeAreaView style={s.container}>
      {/* header */}
      <View style={s.head}>
        <Text style={s.title}>My Pantry</Text>
        <View style={s.search}>
          <Ionicons name="search" size={18} color="#6b7280" />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search ingredients..."
            style={s.searchInput}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch("")}>
              <Ionicons name="close-circle" size={18} color="#9ca3af" />
            </TouchableOpacity>
          )}
        </View>
        <View style={s.filters}>
          {(["All", "Low Stock", "Meat", "Vegetables", "Fruits"] as Filter[]).map((f) => (
            <TouchableOpacity
              key={f}
              style={[s.fChip, filter === f && s.fChipOn]}
              onPress={() => setFilter(f)}
            >
              <Text style={[s.fTxt, filter === f && s.fTxtOn]}>{f}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {loading ? (
        <View style={[s.center, { flex: 1 }]}>
          <ActivityIndicator size="large" />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(i) => i.id}
          numColumns={2}
          columnWrapperStyle={{ gap: 12 }}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 120, gap: 12 }}
          renderItem={render}
        />
      )}

      {/* FAB */}
      <TouchableOpacity style={s.fab} onPress={openSheet}>
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>

      {/* bottom sheet */}
      <BottomSheetModal
        ref={sheetRef}
        index={0}
        snapPoints={snap}
        backdropComponent={(p) => (
          <BottomSheetBackdrop appearsOnIndex={0} disappearsOnIndex={-1} {...p} />
        )}
        enablePanDownToClose
      >
        <BottomSheetView style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
          <Text style={s.sheetTitle}>Add Ingredient</Text>
          <TouchableOpacity style={s.sheetOpt} onPress={cameraAdd}>
            <Ionicons name="camera-outline" size={22} style={{ marginRight: 12 }} />
            <Text style={s.sheetTxt}>Use Camera</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.sheetOpt} onPress={manualAdd}>
            <Ionicons name="pencil-outline" size={22} style={{ marginRight: 12 }} />
            <Text style={s.sheetTxt}>Type Manually</Text>
          </TouchableOpacity>
        </BottomSheetView>
      </BottomSheetModal>

      <Modal visible={formVisible} animationType="slide" transparent>
        <KeyboardAvoidingView
          style={s.formWrap}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View style={s.formBackdrop}>
            <Pressable style={{ flex: 1 }} onPress={() => setFormVisible(false)} />
            <View style={s.formCard}>
              <ScrollView
                contentContainerStyle={s.formContent}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                <Text style={s.formTitle}>
                  {editing ? "Edit Ingredient" : "Add Ingredient"}
                </Text>
                {(img || name.trim()) && (
                  <Image
                    source={{ uri: img ?? mealThumb(name.trim()) }}
                    style={s.formImg}
                  />
                )}
                <Text style={s.label}>Name</Text>
                <TextInput
                  value={name}
                  onChangeText={onChangeName}
                  placeholder="e.g. Tomato"
                  style={s.input}
                  autoCapitalize="words"
                />
                {suggest.length > 0 && (
                  <View style={s.suggestWrap}>
                    {suggest.map((sg) => (
                      <TouchableOpacity
                        key={sg}
                        style={s.suggestChip}
                        onPress={() => {
                          setName(sg);
                          setSuggest([]);
                        }}
                      >
                        <Text style={s.suggestTxt}>{sg}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
                <Text style={s.label}>Quantity</Text>
                <TextInput
                  value={qty}
                  onChangeText={(t) => setQty(sanitizeQuantity(t))}
                  keyboardType="decimal-pad"
                  placeholder="0"
                  style={s.input}
                />
                <Text style={s.label}>Unit</Text>
                <View style={s.unitWrap}>
                  {UNITS.map((u) => (
                    <TouchableOpacity
                      key={u}
                      style={[s.unitChip, unitChip === u && s.unitChipOn]}
                      onPress={() => {
                        setUnitChip(u);
                        setUnit("");
                      }}
                    >
                      <Text style={[s.unitChipTxt, unitChip === u && s.unitChipTxtOn]}>{u}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <TextInput
                  value={unit}
                  onChangeText={(t) => {
                    setUnit(t);
                    setUnitChip(null);
                  }}
                  placeholder="Custom unit (optional)"
                  style={s.input}
                />
                <View style={s.btnRow}>
                  <TouchableOpacity
                    style={[s.formBtn, s.cancelBtn]}
                    onPress={() => setFormVisible(false)}
                  >
                    <Text style={[s.formBtnTxt, s.cancelBtnTxt]}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[s.formBtn, s.saveBtn]} onPress={save}>
                    <Text style={s.formBtnTxt}>{editing ? "Update" : "Save"}</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* camera */}
      <Modal visible={camOpen} animationType="fade">
        <View style={{ width: SCREEN_WIDTH, height: SCREEN_HEIGHT, backgroundColor: "black" }}>
          {!permission?.granted ? (
            <View style={[s.center, { flex: 1 }]}>
              <Text style={{ color: "#fff", marginBottom: 16 }}>Camera permission required</Text>
              <TouchableOpacity onPress={requestPermission} style={[s.btn, { backgroundColor: "#128AFA" }]}>
                <Text style={s.btnText}>Grant Permission</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setCamOpen(false)} style={[s.btn, { marginTop: 12 }]}>
                <Text style={s.btnText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <CameraView ref={camRef} style={{ flex: 1 }} facing="back">
              <View style={s.camOverlay}>
                <TouchableOpacity onPress={() => setCamOpen(false)} style={s.closeCam}>
                  <Ionicons name="close" size={26} color="#fff" />
                </TouchableOpacity>
                <TouchableOpacity
                  disabled={uploading}
                  onPress={async () => {
                    try {
                      const p = await camRef.current?.takePictureAsync();
                      if (p?.uri) await handleCapture(p);
                    } catch {
                      Alert.alert("Capture failed");
                    }
                  }}
                  style={s.shutter}
                >
                  {uploading ? <ActivityIndicator color="#fff" /> : <View style={s.shutterInner} />}
                </TouchableOpacity>
              </View>
            </CameraView>
          )}
        </View>
      </Modal>
      </SafeAreaView>
    </Background>
  );
}

// —— styles ——
const s = StyleSheet.create({
  container: { flex: 1 },
  center: { justifyContent: "center", alignItems: "center" },
  head: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  title: { fontSize: 26, fontWeight: "bold", color: "#128AFA" },
  search: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 8,
  },
  searchInput: { flex: 1 },
  filters: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
  fChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#eef2f7",
  },
  fChipOn: { backgroundColor: "#128AFA" },
  fTxt: { color: "#111827", fontWeight: "600" },
  fTxtOn: { color: "#fff" },
  tile: {
    flex: 1,
    backgroundColor: "#f9fafb",
    borderRadius: 16,
    padding: 12,
    alignItems: "center",
  },
  tileImg: { width: "100%", height: 100, borderRadius: 12, marginBottom: 8 },
  tileName: { fontSize: 15, fontWeight: "600" },
  tileQty: { fontSize: 13, color: "#6b7280" },
  fab: {
    position: "absolute",
    right: 20,
    bottom: 28,
    backgroundColor: "#128AFA",
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
  },
  sheetTitle: { fontSize: 18, fontWeight: "700", marginBottom: 8 },
  sheetOpt: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomColor: "#f3f4f6",
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  sheetTxt: { fontSize: 16, fontWeight: "600", color: "#111827" },
  formWrap: { flex: 1 },
  formBackdrop: {
    flex: 1,
    backgroundColor: "rgba(17,24,39,0.55)",
    justifyContent: "flex-end",
  },
  formCard: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 28,
    maxHeight: SCREEN_HEIGHT * 0.85,
  },
  formContent: { paddingBottom: 12, gap: 12 },
  formTitle: { fontSize: 20, fontWeight: "700", color: "#111827" },
  formImg: {
    width: "100%",
    height: 140,
    borderRadius: 16,
    marginTop: 12,
    marginBottom: 4,
  },
  label: { fontSize: 14, fontWeight: "600", color: "#374151" },
  input: {
    marginTop: 6,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  suggestWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: -4,
    gap: 8,
  },
  suggestChip: {
    backgroundColor: "#eef2f7",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  suggestTxt: { color: "#1f2937", fontWeight: "600" },
  unitWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },
  unitChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#f3f4f6",
  },
  unitChipOn: { backgroundColor: "#128AFA" },
  unitChipTxt: { color: "#111827", fontWeight: "600" },
  unitChipTxtOn: { color: "#fff" },
  btnRow: { flexDirection: "row", gap: 12, marginTop: 20 },
  formBtn: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  cancelBtn: { backgroundColor: "#f3f4f6" },
  cancelBtnTxt: { color: "#111827" },
  saveBtn: { backgroundColor: "#128AFA" },
  formBtnTxt: { fontSize: 16, fontWeight: "700", color: "#fff" },
  camOverlay: {
    position: "absolute",
    bottom: 40,
    width: "100%",
    alignItems: "center",
  },
  closeCam: {
    position: "absolute",
    top: 40,
    right: 20,
    backgroundColor: "rgba(0,0,0,0.4)",
    borderRadius: 20,
    padding: 8,
  },
  shutter: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 6,
    borderColor: "rgba(255,255,255,0.6)",
    justifyContent: "center",
    alignItems: "center",
  },
  shutterInner: { width: 46, height: 46, borderRadius: 23, backgroundColor: "#fff" },
  btn: {
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 10,
    backgroundColor: "#e5e7eb",
  },
  btnText: { color: "#fff", fontWeight: "700" },
});
