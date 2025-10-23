import React, { useState, useEffect } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Picker } from "@react-native-picker/picker";
import { X } from "lucide-react-native";
import FormInput from "./FormInput"; // Reusable input component

type Props = {
  visible: boolean;
  onClose: () => void;
  item: any | null;
  onSave: (payload: any) => Promise<void>;
};

export default function AddEditModal({ visible, onClose, item, onSave }: Props) {
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState("");
  const [type, setType] = useState("");

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
  ];

  const sanitizeQuantity = (value: string) => {
    const digits = value.replace(/[^0-9.]/g, "");
    const [head, ...tail] = digits.split(".");
    return tail.length ? `${head}.${tail.join("")}` : head;
  };

  useEffect(() => {
    if (item) {
      setName(item.name);
      setQuantity(String(item.quantity));
      setUnit(item.unit);
      setType(item.type || "");
    } else {
      // Reset form when opening for a new item
      setName("");
      setQuantity("");
      setUnit("");
      setType("");
    }
  }, [item, visible]);

  const handleSave = async () => {
    if (!name || !quantity || !unit) {
      Alert.alert("Missing Fields", "Please fill in the name, quantity, and unit.");
      return;
    }
    const payload = {
      name,
      quantity: parseFloat(quantity),
      unit,
      type,
    };

    await onSave(payload);
    onClose();
  };

  return (
    <Modal animationType="slide" transparent visible={visible} onRequestClose={onClose}>
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View className="flex-1 justify-end bg-black/60">
          <View className="bg-white rounded-t-3xl p-6">
            <View className="flex-row justify-between items-center mb-5">
              <Text className="text-2xl font-bold text-gray-800">
                {item ? "Edit Ingredient" : "Add Ingredient"}
              </Text>
              <TouchableOpacity onPress={onClose} className="p-1">
                <X size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>
            <View>
              <FormInput label="Ingredient Name" placeholder="e.g., Chicken Breast" value={name} onChangeText={setName} />
              <View className="flex-row gap-4">
                <View className="flex-1">
                  <FormInput
                    label="Quantity"
                    placeholder="e.g., 500"
                    value={quantity}
                    onChangeText={(text) => setQuantity(sanitizeQuantity(text))}
                    keyboardType="numeric"
                    inputMode="decimal"
                  />
                </View>
                <View className="flex-1">
                  <Text className="text-sm font-semibold text-gray-600 mb-1">Unit</Text>
                  <View className="border border-gray-300 rounded-xl bg-white overflow-hidden">
                    <Picker
                      selectedValue={unit}
                      onValueChange={(value) => setUnit(value)}
                      dropdownIconColor="#6b7280"
                      style={{ height: 48, color: "#0f172a" }}
                      mode="dropdown"
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
                </View>
              </View>
              <FormInput label="Category (optional)" placeholder="e.g., Meat, Dairy, Vegetable" value={type} onChangeText={setType} />

              <TouchableOpacity
                onPress={handleSave}
                className="bg-green-600 py-4 rounded-xl mt-6 active:bg-green-700"
              >
                <Text className="text-white text-center text-lg font-bold">
                  {item ? "Update Ingredient" : "Add to Pantry"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}