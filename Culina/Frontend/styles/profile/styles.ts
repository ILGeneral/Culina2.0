import { StyleSheet } from "react-native";

export const HEADER_MAX_HEIGHT = 180;
export const HEADER_MIN_HEIGHT = 60;
export const AVATAR_MAX_SIZE = 100;
export const AVATAR_MIN_SIZE = 40;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f8fafc",
  },
  loadingText: {
    color: "#6b7280",
    marginTop: 10,
    fontSize: 16,
  },
  header: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1,
    overflow: "hidden", // Important for border radius animation
    borderBottomLeftRadius: 50,
    borderBottomRightRadius: 50,
  },
  gradientFill: {
    ...StyleSheet.absoluteFillObject,
  },
  avatarContainer: {
    position: "absolute",
    alignSelf: "center",
    zIndex: 2,
    backgroundColor: "#f8fafc",
    borderRadius: 60,
    padding: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 10,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: HEADER_MAX_HEIGHT + AVATAR_MAX_SIZE / 2,
  },
  userInfo: {
    alignItems: "center",
    marginBottom: 32, // Replaces marginTop on individual section
  },
  username: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#1e293b",
  },
  email: {
    fontSize: 16,
    color: "#64748b",
    marginTop: 4,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#334155",
    marginBottom: 12,
  },
  prefsGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  prefPill: {
    flex: 1,
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  prefIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#eff6ff",
    alignItems: "center",
    justifyContent: "center",
  },
  prefLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#334155",
    textAlign: "center",
  },
  prefText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#475569",
    textAlign: "center",
  },
  menu: {
    backgroundColor: "#fff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  menuItemIcon: {
    width: 40,
    alignItems: "center",
  },
  menuItemText: {
    flex: 1,
    fontSize: 16,
    color: "#334155",
    fontWeight: "500",
  },
  toast: {
    position: "absolute",
    bottom: 40,
    left: 20,
    right: 20,
    backgroundColor: "#334155",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 10,
  },
  toastText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
  },
});

export default styles;
