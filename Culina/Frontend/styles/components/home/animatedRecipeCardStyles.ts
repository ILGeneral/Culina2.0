import { StyleSheet } from 'react-native';

export const styles = StyleSheet.create({
  cardWrapper: {
    backgroundColor: "#fff",
    borderRadius: 20,
    marginBottom: 20,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    shadowColor: "#94a3b8",
    shadowOpacity: 0.18,
    shadowOffset: { width: 0, height: 5 },
    shadowRadius: 15,
    elevation: 5,
  },
  cover: {
    width: "100%",
    height: 192,
  },
  content: {
    padding: 20,
  },
  titleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  title: {
    flex: 1,
    fontSize: 22,
    fontWeight: "bold",
    color: "#1e293b",
    marginRight: 12,
  },
  cardActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  iconButton: {
    padding: 8,
    borderRadius: 12,
    backgroundColor: "#f1f5f9",
  },
  iconButtonActive: {
    backgroundColor: "#e0f2fe",
  },
  description: {
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
  previewItem: {
    color: "#334155",
    fontSize: 14,
  },
  metaRow: {
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
  datePill: {
    backgroundColor: "#f1f5f9",
  },
  metaText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#0f172a",
  },
  interactionSection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
    gap: 12,
  },
  ratingsDisplayRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingBottom: 4,
  },
  noRatingText: {
    fontSize: 13,
    color: "#94a3b8",
    fontStyle: "italic",
  },
  seeRatingsText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#128AFA",
    marginLeft: 4,
  },
  actionButtonsRow: {
    flexDirection: "row",
    gap: 10,
  },
  actionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: "#f8fafc",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  rateActionButton: {
    backgroundColor: "#e0f2fe",
    borderColor: "#bae6fd",
  },
  actionButtonText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#0f172a",
  },
  rateButtonText: {
    color: "#0ea5e9",
  },
});
