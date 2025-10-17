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
import { Send, Volume2, VolumeX } from "lucide-react-native";
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
            <Image
              source={currentPose}
              style={styles.culinaModel}
              resizeMode="contain"
            />
            <View style={styles.overlay}>
              <View style={styles.header}>
                <View style={styles.headerTitles}>
                  <Text style={styles.title}>Culina</Text>
                  <Text style={styles.subtitle}>Cheerful kitchen guidance whenever you need it.</Text>
                </View>
                <TouchableOpacity
                  onPress={toggleVoice}
                  style={[styles.voiceButton, !voiceEnabled && styles.voiceButtonDisabled]}
                  activeOpacity={0.8}
                >
                  {voiceEnabled ? <Volume2 size={20} color="#0f172a" /> : <VolumeX size={20} color="#0f172a" />}
                  <Text style={styles.voiceLabel}>{voiceEnabled ? (speaking ? "Speaking" : "Voice on") : "Voice off"}</Text>
                </TouchableOpacity>
              </View>

              <FlatList
                ref={listRef}
                data={messages}
                keyExtractor={(item) => item.id}
                renderItem={renderMessage}
                contentContainerStyle={styles.messages}
                showsVerticalScrollIndicator={false}
              />

              <View style={styles.inputContainer}>
                <TextInput
                  style={styles.input}
                  placeholder="Share what you're cooking or ask a question..."
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
  },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(255, 255, 255, 0.86)",
    marginHorizontal: 16,
    marginTop: 80,
    borderRadius: 24,
    padding: 20,
    shadowColor: "#0f172a",
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 16,
  },
  culinaModel: {
    position: "absolute",
    top: -40,
    alignSelf: "center",
    width: 420,
    height: 720,
    opacity: 0.16,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  headerTitles: {
    flex: 1,
    paddingRight: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#0f172a",
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: "#475569",
  },
  voiceButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: "#e2f0e7",
    borderRadius: 999,
  },
  voiceButtonDisabled: {
    backgroundColor: "#e2e8f0",
  },
  voiceLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#0f172a",
  },
  messages: {
    paddingVertical: 16,
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
    borderColor: "#cbd5f5",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 12,
    marginBottom: 4,
  },
  input: {
    flex: 1,
    color: "#0f172a",
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