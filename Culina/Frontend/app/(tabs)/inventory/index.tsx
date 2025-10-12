import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Alert,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useInventory } from "@/hooks/useInventory";
import { Plus, Edit2, Trash2, Camera, X, ArrowLeft } from "lucide-react-native";
import { useRouter } from "expo-router";
import { CameraView, useCameraPermissions } from "expo-camera";
import { auth } from "@/lib/firebaseConfig";
import { uploadImageAsync } from "@/lib/uploadImage";
import { Image as RNImage } from "react-native";
import {
  CLARIFAI_PAT,
  CLARIFAI_USER_ID,
  CLARIFAI_APP_ID,
  CLARIFAI_MODEL_ID,
  CLARIFAI_MODEL_VERSION_ID,
} from "@/lib/secrets";

export default function InventoryScreen() {
  const { inventory, loading, addIngredient, updateIngredient, deleteIngredient } =
    useInventory();
  const router = useRouter();

  // UI state
  const [modalVisible, setModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);

  // Form state
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState("");
  const [type, setType] = useState("");
  const [calories, setCalories] = useState("");

  // Camera state
  const [cameraVisible, setCameraVisible] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<any>(null);

  // Upload + detection states
  const [uploading, setUploading] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  useEffect(() => {
    requestPermission();
  }, []);

  // Prefetch thumbnails
  useEffect(() => {
    inventory.forEach((item) => {
      if (item.imageUrl) RNImage.prefetch(item.imageUrl);
    });
  }, [inventory]);

  const resetForm = () => {
    setName("");
    setQuantity("");
    setUnit("");
    setType("");
    setCalories("");
    setEditingItem(null);
  };

  const openAddModal = () => {
    resetForm();
    setModalVisible(true);
  };

  const openEditModal = (item: any) => {
    setEditingItem(item);
    setName(item.name);
    setQuantity(String(item.quantity));
    setUnit(item.unit);
    setType(item.type || "");
    setCalories(item.caloriesPerUnit ? String(item.caloriesPerUnit) : "");
    setModalVisible(true);
  };

  // 🍳 Detect ingredient via Clarifai
  const detectFoodFromImage = async (imageUrl: string) => {
    try {
      const body = JSON.stringify({
        user_app_id: {
          user_id: CLARIFAI_USER_ID,
          app_id: CLARIFAI_APP_ID,
        },
        inputs: [
          {
            data: {
              image: { url: imageUrl },
            },
          },
        ],
      });

      const res = await fetch(
        `https://api.clarifai.com/v2/models/${CLARIFAI_MODEL_ID}/versions/${CLARIFAI_MODEL_VERSION_ID}/outputs`,
        {
          method: "POST",
          headers: {
            Accept: "application/json",
            Authorization: `Key ${CLARIFAI_PAT}`,
            "Content-Type": "application/json",
          },
          body,
        }
      );

      const json = await res.json();
      if (!json.outputs?.[0]?.data?.concepts) {
        throw new Error("No results found");
      }

      const predictions = json.outputs[0].data.concepts.map((c: any) => ({
        name: c.name,
        confidence: c.value,
      }));

      return predictions;
    } catch (err) {
      console.error("Clarifai error:", err);
      return [];
    }
  };

  // 📸 Capture → upload → detect
  const handleTakePhoto = async () => {
    try {
      if (!cameraRef.current) return;
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.7 });
      if (!photo?.uri) return;

      setPhotoPreview(photo.uri);
      setUploading(true);

      const userId = auth.currentUser?.uid;
      if (!userId) {
        Alert.alert("Error", "You must be logged in to upload.");
        setUploading(false);
        return;
      }

      // Upload to Firebase Storage
      const uploadedUrl = await uploadImageAsync(photo.uri, userId);

      // Detect ingredient using Clarifai
      const predictions = await detectFoodFromImage(uploadedUrl);
      setUploading(false);
      setCameraVisible(false);

      if (!predictions || predictions.length === 0) {
        Alert.alert("No recognizable food detected.");
        return;
      }

      const topItem = predictions[0];
      Alert.alert(
        "Detected Ingredient",
        `Top match: ${topItem.name} (${(topItem.confidence * 100).toFixed(1)}%)`,
        [
          {
            text: "Add to Inventory",
            onPress: async () =>
              addIngredient({
                name: topItem.name,
                quantity: 1,
                unit: "pcs",
                imageUrl: uploadedUrl,
              }),
          },
          { text: "Cancel", style: "cancel" },
        ]
      );
    } catch (err) {
      console.error("Detection failed:", err);
      setUploading(false);
      setCameraVisible(false);
      Alert.alert("Error", "Failed to analyze image.");
    } finally {
      setPhotoPreview(null);
    }
  };

  const handleSave = async () => {
    if (!name || !quantity || !unit) {
      Alert.alert("Missing fields", "Name, quantity, and unit are required.");
      return;
    }

    const payload = {
      name,
      quantity: parseFloat(quantity),
      unit,
      type,
      caloriesPerUnit: calories ? parseFloat(calories) : undefined,
    };

    try {
      if (editingItem) {
        await updateIngredient(editingItem.id, payload);
        Alert.alert("Updated", "Ingredient updated successfully!");
      } else {
        await addIngredient(payload);
        Alert.alert("Added", "Ingredient added successfully!");
      }
      setModalVisible(false);
      resetForm();
    } catch (err) {
      Alert.alert("Error", "Failed to save ingredient.");
      console.error(err);
    }
  };

  const handleDelete = (id: string) => {
    Alert.alert("Delete Ingredient", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteIngredient(id);
          } catch {
            Alert.alert("Error", "Failed to delete ingredient.");
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <SafeAreaView className="flex-1 justify-center items-center bg-white">
        <ActivityIndicator size="large" color="#16a34a" />
        <Text className="mt-3 text-gray-600">Loading your pantry...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white">
      {/* Header */}
      <View className="flex-row justify-between items-center px-5 pt-5 pb-3 border-b border-gray-200">
        <View className="flex-row items-center gap-3">
          <TouchableOpacity onPress={() => router.back()}>
            <ArrowLeft color="#16a34a" size={24} />
          </TouchableOpacity>
          <Text className="text-3xl font-bold text-green-700">Your Pantry 🥬</Text>
        </View>

        <View className="flex-row gap-2">
          <TouchableOpacity
            onPress={async () => {
              const { status } = await requestPermission();
              if (status === "granted") setCameraVisible(true);
              else Alert.alert("Permission required", "Please allow camera access.");
            }}
            className="bg-green-500 rounded-full p-2 active:opacity-80"
          >
            <Camera color="#fff" size={22} />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={openAddModal}
            className="bg-green-600 rounded-full p-2 active:opacity-80"
          >
            <Plus color="#fff" size={22} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Inventory List */}
      {inventory.length === 0 ? (
        <View className="flex-1 justify-center items-center">
          <Text className="text-gray-500">Your pantry is empty.</Text>
          <Text className="text-gray-400 text-sm mt-1">
            Tap + or 📷 to add ingredients.
          </Text>
        </View>
      ) : (
        <ScrollView className="px-5 pt-3">
          {inventory.map((item) => (
            <View
              key={item.id}
              className="flex-row justify-between items-center py-3 border-b border-gray-100"
            >
              <View className="flex-row items-center gap-3 flex-1">
                {item.imageUrl ? (
                  <Image
                    source={{ uri: item.imageUrl }}
                    className="w-12 h-12 rounded-lg bg-gray-100"
                  />
                ) : (
                  <View className="w-12 h-12 rounded-lg bg-gray-200 justify-center items-center">
                    <Text className="text-gray-400 text-xs">No Img</Text>
                  </View>
                )}

                <View className="flex-1">
                  <Text className="text-gray-900 font-semibold">{item.name}</Text>
                  <Text className="text-gray-500 text-sm">
                    {item.quantity} {item.unit} {item.type ? `• ${item.type}` : ""}
                  </Text>
                </View>
              </View>

              <View className="flex-row gap-3 ml-3">
                <TouchableOpacity onPress={() => openEditModal(item)} className="p-1">
                  <Edit2 size={18} color="#16a34a" />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => item.id && handleDelete(item.id)}
                  className="p-1"
                >
                  <Trash2 size={18} color="#dc2626" />
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </ScrollView>
      )}

      {/* Add/Edit Modal */}
      <Modal animationType="slide" transparent visible={modalVisible}>
        <View className="flex-1 justify-center bg-black/50 px-6">
          <View className="bg-white rounded-2xl p-6">
            <View className="flex-row justify-between items-center mb-3">
              <Text className="text-xl font-bold text-green-700">
                {editingItem ? "Edit Ingredient" : "Add Ingredient"}
              </Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <X size={22} color="#6b7280" />
              </TouchableOpacity>
            </View>

            <ScrollView className="space-y-3">
              <TextInput
                placeholder="Name"
                value={name}
                onChangeText={setName}
                className="border border-gray-300 rounded-lg px-4 py-2"
              />
              <TextInput
                placeholder="Quantity"
                value={quantity}
                onChangeText={setQuantity}
                keyboardType="numeric"
                className="border border-gray-300 rounded-lg px-4 py-2"
              />
              <TextInput
                placeholder="Unit (e.g. g, pcs, kg, ml)"
                value={unit}
                onChangeText={setUnit}
                className="border border-gray-300 rounded-lg px-4 py-2"
              />
              <TextInput
                placeholder="Type (e.g. Meat, Fruit, Condiment)"
                value={type}
                onChangeText={setType}
                className="border border-gray-300 rounded-lg px-4 py-2"
              />
              <TextInput
                placeholder="Calories per unit (optional)"
                value={calories}
                onChangeText={setCalories}
                keyboardType="numeric"
                className="border border-gray-300 rounded-lg px-4 py-2"
              />

              <TouchableOpacity
                onPress={handleSave}
                className="bg-green-600 py-3 rounded-lg mt-4"
              >
                <Text className="text-white text-center text-lg font-semibold">
                  {editingItem ? "Update" : "Add"}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Camera Modal */}
      <Modal animationType="slide" transparent visible={cameraVisible}>
        <View className="flex-1 bg-black">
          <CameraView style={{ flex: 1 }} facing="back" ref={cameraRef} />

          <TouchableOpacity
            onPress={handleTakePhoto}
            className="absolute bottom-10 left-1/2 -translate-x-1/2 bg-white rounded-full p-5"
          >
            <View className="w-10 h-10 bg-green-600 rounded-full" />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setCameraVisible(false)}
            className="absolute top-10 right-5"
          >
            <X color="#fff" size={30} />
          </TouchableOpacity>
        </View>
      </Modal>

      {/* Upload Overlay */}
      {uploading && (
        <View className="absolute top-0 left-0 right-0 bottom-0 bg-black/70 justify-center items-center z-50">
          {photoPreview && (
            <Image
              source={{ uri: photoPreview }}
              className="w-40 h-40 rounded-xl mb-6"
            />
          )}
          <ActivityIndicator size="large" color="#22c55e" />
          <Text className="text-white mt-3 text-lg font-semibold">
            Analyzing image...
          </Text>
        </View>
      )}
    </SafeAreaView>
  );
}
