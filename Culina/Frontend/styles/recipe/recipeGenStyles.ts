import { StyleSheet } from "react-native";
import { Colors } from "@/constants/colors";

const recipeGenStyles = StyleSheet.create({
  container: { 
    flex: 1,
    paddingTop: 20, // Added top padding to the container
  },
  center: { flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 20 },
  gray: { color: "#6b7280", marginTop: 10, textAlign: "center" },
  loadingTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#0f172a",
    marginTop: 16,
    textAlign: "center",
  },
  loadingSubtitle: {
    fontSize: 14,
    color: "#64748b",
    marginTop: 8,
    textAlign: "center",
  },
  culinaIntro: {
    fontSize: 24,
    fontWeight: "700",
    color: "#0f172a",
    textAlign: "center",
    marginBottom: 8,
  },
  culinaPrompt: {
    fontSize: 16,
    color: "#475569",
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 24,
    paddingHorizontal: 20,
  },
  generatingBox: {
    marginTop: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#f8fafc",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  generatingText: {
    fontSize: 14,
    color: "#475569",
    fontWeight: "500",
  },
  button: {
    backgroundColor: "#0284c7",
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 16,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 10, // Reduced from 20 to lower the header
    paddingBottom: 12,
    marginTop: 10, // Added margin at the top
  },
  headerBtn: {
    padding: 10,
    borderRadius: 12,
    backgroundColor: "#f8fafc",
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#0f172a",
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  section: {
    marginBottom: 24,
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    shadowColor: "#94a3b8",
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
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
  sectionSubtitle: {
    fontSize: 14,
    color: "#64748b",
    marginTop: 4,
  },
  inventoryList: {
    gap: 10,
  },
  inventoryTag: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: "#f8fafc",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  inventoryTagText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0f172a",
  },
  inventoryTagCount: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0284c7",
  },
  inventoryEmpty: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 20,
    gap: 8,
  },
  inventoryEmptyText: {
    color: "#94a3b8",
    fontSize: 14,
  },
  generateButton: {
    marginTop: 16,
    backgroundColor: Colors.secondary.main,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    shadowColor: Colors.secondary.main,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  generateButtonDisabled: {
    opacity: 0.6,
  },
  generateButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  generatedHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  generatedTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#0f172a",
  },
  generatedSub: {
    color: "#64748b",
    marginTop: 4,
  },
  recipeList: {
    gap: 18,
  },
  refreshRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 10, // Added top padding
    paddingBottom: 12,
    marginTop: 10, // Added margin to push content down
  },
  refreshHint: {
    color: "#475569",
    fontSize: 14,
    fontWeight: "600",
  },
  secondaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#0f172a",
    backgroundColor: "rgba(255,255,255,0.92)",
  },
  secondaryButtonDisabled: {
    opacity: 0.6,
  },
  secondaryButtonText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#0f172a",
  },
  scroll: {
    paddingHorizontal: 20,
  },
  list: {
    paddingBottom: 32,
    gap: 20,
  },
  savedCard: {
    backgroundColor: "#fff",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    shadowColor: "#94a3b8",
    shadowOpacity: 0.18,
    shadowOffset: { width: 0, height: 5 },
    shadowRadius: 15,
    elevation: 5,
    marginBottom: 0,
  },
  savedContent: {
    padding: 20,
  },
  recipeTitle: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#1e293b",
    marginBottom: 8,
  },
  recipeDescription: {
    color: "#475569",
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 12,
  },
  previewSection: {
    marginBottom: 16,
    gap: 4,
  },
  previewLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0f172a",
  },
  previewRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  previewItem: {
    color: "#334155",
    fontSize: 14,
  },
  previewCount: {
    fontSize: 13,
    fontWeight: "600",
    color: "#0f172a",
  },
  previewCountLow: {
    color: "#dc2626",
  },
  recipeMetaContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
    paddingTop: 14,
  },
  metaPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
  },
  sourcePill: {
    backgroundColor: "#e0f2fe",
  },
  servingsPill: {
    backgroundColor: "#dbeafe",
  },
  caloriesPill: {
    backgroundColor: "#fff7ed",
  },
  ingredientsPill: {
    backgroundColor: "#f1f5f9",
  },
  metaText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#0f172a",
  },
  primaryButton: {
    marginTop: 16,
    backgroundColor: Colors.secondary.main,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: Colors.secondary.main,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  primaryButtonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  mainIngredientSection: {
    width: "100%",
    marginBottom: 24,
  },
  mainIngredientLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: "#0f172a",
    marginBottom: 12,
    textAlign: "center",
  },
  ingredientScroll: {
    maxHeight: 100,
  },
  ingredientScrollContent: {
    paddingHorizontal: 4,
    gap: 8,
    alignItems: "center",
  },
  ingredientChip: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: "#f1f5f9",
    borderWidth: 2,
    borderColor: "#e2e8f0",
    marginHorizontal: 4,
  },
  ingredientChipSelected: {
    backgroundColor: "#0ea5e9",
    borderColor: "#0284c7",
  },
  ingredientChipText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#475569",
  },
  ingredientChipTextSelected: {
    color: "#fff",
  },
});

export default recipeGenStyles;
