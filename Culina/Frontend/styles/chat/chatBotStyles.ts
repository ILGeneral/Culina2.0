import { StyleSheet, Dimensions } from "react-native";
import { Colors } from "@/constants/colors";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

const chatBotStyles = StyleSheet.create({
  // Base
  background: {
    flex: 1,
    backgroundColor: 'black',
  },
  safeArea: {
    flex: 1,
  },

  // LAYER 1: The Image (Absolute Background)
  // Stays behind everything and ignores keyboard
  culinaWrapper: {
    ...StyleSheet.absoluteFillObject, // Short for top:0, left:0, bottom:0, right:0
    zIndex: 0,
    justifyContent: "center",
    alignItems: "center",
  },
  culinaModel: {
    width: "120%",
    height: "120%",
    transform: [{ translateY: 100 }, { scale: 1.1 }],
  },

  // LAYER 2: The Interactive Container
  // This wraps everything that needs to move
  keyboardContainer: {
    flex: 1,
  },
  contentContainer: {
    flex: 1,
    justifyContent: "flex-end", // Pushes chat panel to bottom naturally
  },

  // Top Controls (Voice/Expand)
  controlsContainer: {
    position: "absolute",
    top: 16,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    zIndex: 20,
  },

  // THE CHAT PANEL
  // ERROR FIX: Removed 'position: absolute'. 
  // It now sits naturally at the bottom of the flex column.
  chatPanel: {
    width: "100%",
    backgroundColor: "#0000008C",
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 12,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  chatPanelCollapsed: {
    minHeight: 100,
    maxHeight: 150,
  },
  chatPanelExpanded: {
    height: "85%", 
    maxHeight: SCREEN_HEIGHT * 0.85, 
  },

  // --- Buttons & Content (Unchanged) ---
  voiceButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    backgroundColor: "#0F172A73",
    borderRadius: 999,
  },
  voiceButtonDisabled: { backgroundColor: "#0F172A40" },
  voiceLabel: { fontSize: 12, fontWeight: "600", color: "#f8fafc" },
  expandButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#0F172A73",
    alignItems: "center",
    justifyContent: "center",
  },
  
  // Messages List
  messagesWrapper: {
    flex: 1,
    borderRadius: 18,
    backgroundColor: "#0F172A40",
    paddingVertical: 12,
    paddingHorizontal: 6,
    marginBottom: 10,
  },
  messageList: { flex: 1 },
  messages: { paddingHorizontal: 10, paddingBottom: 12, gap: 12 },

  // Floating Bubble (Collapsed State)
  collapsedMessageContainer: {
    position: "absolute",
    bottom: 150, // Floating above the panel
    left: 20,
    right: 20,
    alignSelf: "center",
    zIndex: 10,
  },
  collapsedBubble: {
    backgroundColor: "#0F172ACC",
    borderRadius: 18,
    padding: 16,
    alignSelf: "center",
    width: "100%",
    maxWidth: 400,
    minHeight: 60,
    maxHeight: 250,
  },
  collapsedScrollView: { maxHeight: 220 },
  collapsedText: { fontSize: 16, color: "#f8fafc", textAlign: "center", lineHeight: 24 },

  // Typing & Text
  typingIndicatorContainer: { flexDirection: "column", alignItems: "center", gap: 8, paddingVertical: 4 },
  typingText: { fontSize: 12, color: "#cbd5e1", fontWeight: "500" },
  typingDotsContainer: { flexDirection: "row", gap: 6 },
  typingDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#60a5fa" },

  messageRow: { flexDirection: "row", width: "100%", marginBottom: 8 },
  messageRowStart: { justifyContent: "flex-start" },
  messageRowEnd: { justifyContent: "flex-end" },
  bubble: { maxWidth: "85%", borderRadius: 18, paddingVertical: 10, paddingHorizontal: 14 },
  botBubble: { backgroundColor: "#f1f5f9", borderBottomLeftRadius: 4 },
  userBubble: { backgroundColor: "#0284c7", borderTopRightRadius: 4 },
  botText: { color: "#0f172a", fontSize: 15, lineHeight: 22 },
  userText: { color: "#fff", fontSize: 15, lineHeight: 22 },

  // Input
  inputContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "#94A3B859",
    borderRadius: 24,
    backgroundColor: "#0F172AA6",
  },
  input: {
    flex: 1,
    color: "#f8fafc",
    maxHeight: 100,
    minHeight: 40,
    paddingTop: 5,
    paddingBottom: 5,
    fontSize: 15,
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.secondary.main,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 2,
  },
  sendButtonDisabled: { backgroundColor: "#64748b" },
});

export default chatBotStyles;