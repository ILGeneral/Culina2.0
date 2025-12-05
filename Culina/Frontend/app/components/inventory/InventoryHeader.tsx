import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { ArrowLeft } from "lucide-react-native";

type Props = {
  onAddPress: () => void;
};

export default function InventoryHeader({ onAddPress }: Props) {
  const router = useRouter();

  return (
    <View
      style={{
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingHorizontal: 20,
        paddingTop: 16,
        paddingBottom: 16,
        backgroundColor: "#fff",
        borderBottomWidth: 1,
        borderBottomColor: "#e2e8f0",
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={{
            padding: 8,
            marginLeft: -8, // Optical alignment
          }}
        >
          <ArrowLeft color="#15803d" size={24} />
        </TouchableOpacity>
        <Text
          style={{
            fontSize: 24,
            fontWeight: "700",
            color: "#15803d",
            letterSpacing: -0.5,
          }}
        >
          Inventory
        </Text>
      </View>
    </View>
  );
}