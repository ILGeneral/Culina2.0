import { StyleSheet } from "react-native";

export const loginStyles = StyleSheet.create({
  container: {
    flex: 1,
  },
  inner: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    marginBottom: 24,
    textAlign: "center",
    color: "#128AFA",
  },
  logo: {
    width: 260,
    height: 260,
    alignSelf: "center",
    marginBottom: 16,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    marginBottom: 12,
    paddingHorizontal: 12,
    backgroundColor: "#fff",
  },
  inputIcon: {
    marginRight: 8,
  },
  inputWithIcon: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
  },
  eyeIcon: {
    padding: 4,
  },
  button: {
    backgroundColor: "#128AFA",
    paddingVertical: 14,
    borderRadius: 8,
    marginTop: 8,
  },
  buttonText: {
    color: "#fff",
    textAlign: "center",
    fontWeight: "600",
    fontSize: 16,
  },
  linkText: {
    textAlign: "center",
    color: "#6b7280",
    marginTop: 16,
  },
  linkHighlight: {
    color: "#128AFA",
    fontWeight: "600",
  },
});
