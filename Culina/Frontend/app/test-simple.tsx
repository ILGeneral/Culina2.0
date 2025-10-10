import { View, Text, StyleSheet } from "react-native";

export default function TestSimple() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>🎉 IT WORKS! This is Culina App!</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#dcfce7",
  },
  text: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#166534",
  },
});
