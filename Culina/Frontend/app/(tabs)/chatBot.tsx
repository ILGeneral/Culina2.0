import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ImageBackground,
  Image,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  FlatList,
  ActivityIndicator,
  Alert,
} from "react-native";
import type { ImageSourcePropType } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Send, Volume2, VolumeX, ChevronUp, ChevronDown } from "lucide-react-native";
import * as Speech from "expo-speech";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

const API_BASE = "https://culina-backend.vercel.app/api";

const CULINA_POSES: ImageSourcePropType[] = [
  require("@/assets/chatbotAssets/culinaModels/culinaPose1.png"),
  require("@/assets/chatbotAssets/culinaModels/culinaPose2.png"),
  require("@/assets/chatbotAssets/culinaModels/culinaPose3.png"),
];

const ChatBotScreen = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([{
    id: "welcome",
    role: "assistant",
    content: "Hey there! I'm Culina, your upbeat sous chef. What's cooking today? 🥕",
  }]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [speaking, setSpeaking] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [currentPose, setCurrentPose] = useState<ImageSourcePropType>(CULINA_POSES[0]);
  const listRef = useRef<FlatList<ChatMessage>>(null);

  useEffect(() => {
    return () => {
      Speech.stop();
    };
  }, []);

  useEffect(() => {
    if (!messages.length) return;
    requestAnimationFrame(() => {
      listRef.current?.scrollToEnd({ animated: true });
    });
  }, [messages]);

  const speak = useCallback((text: string) => {
    if (!voiceEnabled || !text.trim()) return;
    Speech.stop();
    Speech.speak(text, {
      onStart: () => setSpeaking(true),
      onDone: () => setSpeaking(false),
      onStopped: () => setSpeaking(false),
      onError: () => setSpeaking(false),
    });
  }, [voiceEnabled]);

  const switchPose = useCallback(() => {
    setCurrentPose((prev) => {
      const options = CULINA_POSES.filter((pose) => pose !== prev);
      if (options.length === 0) {
        return prev;
      }
      const randomIndex = Math.floor(Math.random() * options.length);
      return options[randomIndex];
    });
  }, []);

  const toggleVoice = useCallback(() => {
    setVoiceEnabled((prev) => {
      if (prev) {
        Speech.stop();
        setSpeaking(false);
      }
      return !prev;
    });
  }, []);

  const toggleExpanded = useCallback(() => {
    setExpanded((prev) => !prev);
  }, []);

  const handleSend = useCallback(async () => {
    if (!input.trim() || sending) {
      return;
    }

    const trimmed = input.trim();
    const userMessage: ChatMessage = {
      id: `${Date.now()}-user`,
      role: "user",
      content: trimmed,
    };

    const historyPayload = [
      ...messages.map(({ role, content }) => ({ role, content })),
      { role: "user", content: trimmed },
    ];

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setSending(true);

    try {
      const response = await fetch(`${API_BASE}/chatbot`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: trimmed,
          history: historyPayload,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Chatbot request failed");
      }

      const data = await response.json();
      const replyText = typeof data?.reply === "string" && data.reply.trim()
        ? data.reply.trim()
        : "I'm here and ready to help you cook something great!";

      const assistantMessage: ChatMessage = {
        id: `${Date.now()}-assistant`,
        role: "assistant",
        content: replyText,
      };

      setMessages((prev) => [...prev, assistantMessage]);
      switchPose();
      speak(replyText);
    } catch (error: any) {
      console.error("Chatbot request error:", error);
      Alert.alert("Chatbot", error.message || "Something went wrong. Please try again.");
    } finally {
      setSending(false);
    }
  }, [input, messages, sending, speak]);

  const renderMessage = ({ item }: { item: ChatMessage }) => {
    const isUser = item.role === "user";
    return (
      <View style={[styles.messageRow, isUser ? styles.messageRowEnd : styles.messageRowStart]}>
        <View style={[styles.bubble, isUser ? styles.userBubble : styles.botBubble]}>
          <Text style={[styles.messageText, isUser ? styles.userText : styles.botText]}>{item.content}</Text>
        </View>
      </View>
    );
  };

  return (
    <ImageBackground
      source={require("@/assets/chatbotAssets/chatbotBG.png")}
      style={styles.background}
      resizeMode="cover"
    >
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View style={styles.contentContainer}>
            <View style={styles.culinaWrapper} pointerEvents="none">
              <Image
                source={currentPose}
                style={styles.culinaModel}
                resizeMode="cover"
              />
            </View>
            <View style={styles.overlay}>
              <View style={[styles.chatPanel, expanded ? styles.chatPanelExpanded : styles.chatPanelCollapsed]}>
                <View style={styles.topBar}>
                  <View style={styles.topActions}>
                    <TouchableOpacity
                      onPress={toggleVoice}
                      style={[styles.voiceButton, !voiceEnabled && styles.voiceButtonDisabled]}
                      activeOpacity={0.8}
                    >
                      {voiceEnabled ? <Volume2 size={20} color="#f8fafc" /> : <VolumeX size={20} color="#f8fafc" />}
                      <Text style={styles.voiceLabel}>{voiceEnabled ? (speaking ? "Speaking" : "Voice on") : "Voice off"}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={toggleExpanded}
                      style={styles.expandButton}
                      activeOpacity={0.8}
                    >
                      {expanded ? <ChevronDown size={20} color="#f8fafc" /> : <ChevronUp size={20} color="#f8fafc" />}
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.messagesWrapper}>
                  <FlatList
                    ref={listRef}
                    data={messages}
                    keyExtractor={(item) => item.id}
                    renderItem={renderMessage}
                    contentContainerStyle={styles.messages}
                    style={styles.messageList}
                    showsVerticalScrollIndicator={false}
                  />
                </View>

                <View style={styles.inputContainer}>
                  <TextInput
                    style={styles.input}
                    placeholder="Share what you're cooking or ask me question! I am here for you!"
                    placeholderTextColor="#94a3b8"
                    value={input}
                    onChangeText={setInput}
                    multiline
                  />
                  <TouchableOpacity
                    style={[styles.sendButton, (!input.trim() || sending) && styles.sendButtonDisabled]}
                    onPress={handleSend}
                    disabled={!input.trim() || sending}
                  >
                    {sending ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <Send size={20} color="#fff" />
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ImageBackground>
  );
};

export default ChatBotScreen;

const styles = StyleSheet.create({
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
    paddingTop: 80,
    backgroundColor: "rgba(0, 0, 0, 0.2)",
    zIndex: 1,
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
    width: "115%",
    height: "115%",
    opacity: 1,
    transform: [{ translateY: 100 }, { scale: 1.1 }],
  },
  chatPanel: {
    width: "100%",
    alignSelf: "stretch",
    borderRadius: 28,
    paddingHorizontal: 8,
    paddingVertical: 10,
    backgroundColor: "rgba(0, 0, 0, 0.55)",
    gap: 16,
  },
  chatPanelCollapsed: {
    height: 240,
  },
  chatPanelExpanded: {
    height: 460,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
  },
  topActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  voiceButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    backgroundColor: "rgba(15, 23, 42, 0.45)",
    borderRadius: 999,
  },
  voiceButtonDisabled: {
    backgroundColor: "rgba(15, 23, 42, 0.25)",
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
    backgroundColor: "rgba(15, 23, 42, 0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
  messagesWrapper: {
    flex: 1,
    borderRadius: 18,
    backgroundColor: "rgba(15, 23, 42, 0.25)",
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
    backgroundColor: "#128AFA",
    borderBottomRightRadius: 6,
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
    alignItems: "flex-end",
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.35)",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 12,
    marginBottom:10,
    backgroundColor: "rgba(15, 23, 42, 0.65)",
  },
  input: {
    flex: 1,
    color: "#f8fafc",
    maxHeight: 120,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#128AFA",
    justifyContent: "center",
    alignItems: "center",
  },
  sendButtonDisabled: {
    backgroundColor: "#94a3b8",
  },
});