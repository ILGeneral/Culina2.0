import { StyleSheet, Platform } from "react-native";

export const registerStyles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 24,
    paddingVertical: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 24,
    color: "#128AFA",
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 12,
    color: "#1f2937",
  },
  helperText: {
    color: "#6b7280",
    marginBottom: 8,
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
    paddingVertical: 16,
    borderRadius: 8,
    marginTop: 8,
  },
  buttonText: {
    color: "#fff",
    textAlign: "center",
    fontWeight: "600",
    fontSize: 18,
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
  pickerContainer: {
    marginBottom: 16,
  },
  pickerLabel: {
    fontSize: 14,
    fontWeight: "500",
    color: "#374151",
    marginBottom: 8,
  },
  pickerWrapper: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    backgroundColor: "#fff",
    overflow: "hidden",
  },
  picker: {
    height: Platform.OS === "ios" ? 180 : 50,
  },
  checkboxList: {
    gap: 10,
  },
  checkboxRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
  },
  checkboxBox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: "#128AFA",
    marginRight: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  checkboxBoxChecked: {
    backgroundColor: "#128AFA",
  },
  checkboxMark: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 14,
  },
  checkboxLabel: {
    fontSize: 16,
    color: "#1f2937",
  },
});
