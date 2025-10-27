import { StyleSheet } from "react-native";

export const onboardingStyles = StyleSheet.create({
  container: {
    flex: 1,
  },
  slide: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  image: {
    width: 288,
    height: 288,
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    textAlign: "center",
    color: "#128AFA",
    marginBottom: 12,
  },
  description: {
    fontSize: 16,
    color: "#6b7280",
    textAlign: "center",
    lineHeight: 24,
    marginBottom: 40,
  },
  pagination: {
    flexDirection: "row",
    justifyContent: "center",
    marginBottom: 32,
  },
  button: {
    backgroundColor: "#128AFA",
    paddingVertical: 12,
    marginHorizontal: 40,
    marginBottom: 40,
    borderRadius: 8,
  },
  buttonText: {
    color: "#fff",
    textAlign: "center",
    fontWeight: "600",
    fontSize: 18,
  },
});
