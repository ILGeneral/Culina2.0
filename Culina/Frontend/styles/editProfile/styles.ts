import { StyleSheet, Platform } from "react-native";

const styles = StyleSheet.create({
  container: { flex: 1 },
  contentContainer: { padding: 24 },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#0F0F0FFF",
    textAlign: "center",
    marginBottom: 24,
  },
  section: { marginBottom: 20 },
  label: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1f2937",
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: "#fff",
  },
  pickerWrapper: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    backgroundColor: "#fff",
  },
  picker: {
    height: Platform.OS === "ios" ? 180 : 50,
  },
  dropdownToggle: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
  },
  dropdownLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: "#0B1116",
  },
  dropdownChevron: {
    fontSize: 16,
    color: "#191C1F",
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
  saveButton: {
    backgroundColor: "#128AFA",
    paddingVertical: 16,
    borderRadius: 8,
    marginTop: 10,
    alignItems: "center",
  },
  saveButtonText: {
    color: "#fff",
    textAlign: "center",
    fontWeight: "600",
    fontSize: 18,
  },
});

export default styles;
