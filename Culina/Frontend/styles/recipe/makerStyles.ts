import { StyleSheet } from "react-native";

export const makerStyles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
  },
  backButton: {
    marginRight: 12,
    padding: 6,
    borderRadius: 12,
    backgroundColor: "#E6F3FEFF",
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: "bold",
    color: "#0f172a",
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 32,
    gap: 16,
  },
  section: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  label: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1e293b",
    marginBottom: 10,
  },
  input: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: "#0f172a",
    backgroundColor: "#f8fafc",
  },
  multilineInput: {
    height: 120,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0f172a",
  },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: "#E6F3FEFF",
  },
  addButtonText: {
    color: "#128AFAFF",
    fontWeight: "600",
    fontSize: 14,
  },
  ingredientRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  ingredientName: {
    flex: 2,
  },
  ingredientQty: {
    width: 70,
  },
  unitPickerContainer: {
    paddingHorizontal: 0,
    paddingVertical: 0,
    borderColor: "transparent",
    width: 80,
  },
  unitPicker: {
    height: 48,
    color: "#0f172a",
  },
  removeButton: {
    padding: 8,
  },
  stepRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginBottom: 12,
  },
  stepNumberContainer: {
    width: 24,
    alignItems: "center",
    justifyContent: "flex-start",
    paddingTop: 14,
  },
  stepNumber: {
    fontSize: 16,
    fontWeight: "600",
    color: "#128AFAFF",
  },
  stepInput: {
    flex: 1,
    minHeight: 80,
  },
  buttonGroup: {
    gap: 12,
    marginTop: 8,
  },
  primaryButton: {
    backgroundColor: "#128AFAFF",
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonText: {
    color: "#ffffff",
    fontSize: 17,
    fontWeight: "700",
  },
  secondaryButton: {
    backgroundColor: "#0ea5e9",
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryButtonText: {
    color: "#ffffff",
    fontSize: 17,
    fontWeight: "700",
  },
  disabledButton: {
    opacity: 0.6,
  },
  scrollContentLandscape: {
    paddingHorizontal: 16,
  },
  landscapeContainer: {
    flexDirection: "row",
    gap: 16,
    width: "100%",
  },
  landscapeColumn: {
    flex: 1,
    gap: 24,
  },
});
