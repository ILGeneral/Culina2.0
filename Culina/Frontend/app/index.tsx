import { useEffect } from "react";
import { useRouter } from "expo-router";
import { View, Text, ActivityIndicator, StyleSheet } from "react-native";

export default function Index() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to login after a brief moment
    const timer = setTimeout(() => {
      router.replace("/login");
    }, 500);

    return () => clearTimeout(timer);
  }, []);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#16a34a" />
      <Text style={styles.text}>Loading Culina...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
  },
  text: {
    marginTop: 12,
    fontSize: 16,
    color: "#6b7280",
  },
});
