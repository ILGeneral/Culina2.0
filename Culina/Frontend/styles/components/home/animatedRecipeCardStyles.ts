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
  title: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#1e293b",
    marginBottom: 8,
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
  footerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 16,
  },
  ratingContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  noRatingText: {
    fontSize: 13,
    color: "#94a3af",
    fontStyle: "italic",
  },
  commentButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: "rgba(18,138,250,0.12)",
    borderRadius: 999,
  },
  commentText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#0f172a",
  },
  quickRateButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#e0f2fe",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginTop: 12,
    gap: 6,
    borderWidth: 1,
    borderColor: "#0ea5e9",
  },
  quickRateText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0ea5e9",
  },
});
