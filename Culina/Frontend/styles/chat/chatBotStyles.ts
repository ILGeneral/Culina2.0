import { StyleSheet } from "react-native";

const chatBotStyles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  background: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  contentContainer: {
    flex: 1,
    justifyContent: "flex-end",
    position: "relative",
  },
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
    paddingHorizontal: 0,
    paddingBottom: 0,
    paddingTop: 0,
    backgroundColor: "#00000033",
    zIndex: 1,
  },
  controlsContainer: {
    position: "absolute",
    top: 24,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    zIndex: 2,
  },
  culinaWrapper: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 0,
  },
  culinaModel: {
    width: "120%",
    height: "120%",
    opacity: 1,
    transform: [{ translateY: 100 }, { scale: 1.1 }],
  },
  chatPanel: {
    width: "100%",
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: "#0000008C",
    gap: 12,
  },
  chatPanelCollapsed: {
    height: 120,
    borderRadius: 20,
  },
  chatPanelExpanded: {
    height: "70%",
    borderRadius: 20,
  },
  voiceButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    backgroundColor: "#0F172A73",
    borderRadius: 999,
  },
  voiceButtonDisabled: {
    backgroundColor: "#0F172A40",
  },
  voiceLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#f8fafc",
  },
  expandButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#0F172A73",
    alignItems: "center",
    justifyContent: "center",
  },
  messagesWrapper: {
    flex: 1,
    borderRadius: 18,
    backgroundColor: "#0F172A40",
    paddingVertical: 12,
    paddingHorizontal: 6,
  },
  messageList: {
    flexGrow: 0,
  },
  messages: {
    paddingHorizontal: 10,
    paddingBottom: 12,
    gap: 12,
  },
  messagesPlaceholder: {
    flex: 1,
  },
  collapsedMessageContainer: {
    position: "absolute",
    bottom: 250, 
    left: 20,
    right: 20,
    zIndex: 0,
    maxWidth: "85%",
    alignSelf: "center",
  },
  collapsedBubble: {
    backgroundColor: "#0F172ACC",
    borderRadius: 18,
    padding: 16,
    alignSelf: "center", // Center the bubble
    maxWidth: "100%",
    marginBottom: 0,
  },
  collapsedText: {
    fontSize: 18,
    color: "#f8fafc",
    textAlign: "center",
    lineHeight: 26,
  },
  messageRow: {
    flexDirection: "row",
    width: "100%",
  },
  messageRowStart: {
    justifyContent: "flex-start",
  },
  messageRowEnd: {
    justifyContent: "flex-end",
  },
  bubble: {
    maxWidth: "82%",
    borderRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  botBubble: {
    backgroundColor: "#f1f5f9",
    borderBottomLeftRadius: 6,
  },
  userBubble: {
    backgroundColor: "#0284c7",
    borderTopRightRadius: 4,
    padding: 12,
    maxWidth: "85%",
    alignSelf: "flex-end",
    marginRight: 10,       
    marginBottom: 8,       
    marginTop: 4,          
  },
  messageText: {
    fontSize: 15,
    lineHeight: 21,
  },
  botText: {
    color: "#0f172a",
  },
  userText: {
    color: "#fff",
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 8,
    paddingBottom: 10, 
    borderWidth: 1,
    borderColor: "#94A3B859",
    borderRadius: 20,
    backgroundColor: "#0F172AA6",
    marginBottom: 30,
  },
  input: {
    flex: 1,
    color: "#f8fafc",
    maxHeight: 120,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 22,
    backgroundColor: "#128AFA",
    justifyContent: "center",
    alignItems: "center",
    top: 5,
  },
  sendButtonDisabled: {
    backgroundColor: "#94a3b8",
  },
});

export default chatBotStyles;
