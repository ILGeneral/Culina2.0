import React from "react";
import "./global.css";
import { StatusBar } from "expo-status-bar";
import { View, Text, StyleSheet } from "react-native";

export default function App() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>
        Culina 2.0 🍳
      </Text>
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#dcfce7",
  },
  text: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#166534",
  },
});
