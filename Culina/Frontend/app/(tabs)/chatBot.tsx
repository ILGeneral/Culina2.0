import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
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
import chatBotStyles from "@/styles/chat/chatBotStyles";
import type { ImageSourcePropType } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Send, Volume2, VolumeX, ChevronUp, ChevronDown } from "lucide-react-native";
import * as Speech from "expo-speech";
import { auth } from "@/lib/firebaseConfig";

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

  const displayedMessages = useMemo(() => {
    if (expanded) {
      return messages;
    }

    for (let i = messages.length - 1; i >= 0; i -= 1) {
      const message = messages[i];
      if (message.role === "assistant") {
        return [message];
      }
    }

    return messages.length > 0 ? [messages[messages.length - 1]] : [];
  }, [expanded, messages]);

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
      // ✅ SECURITY FIX: Get auth token before making request
      const user = auth.currentUser;
      if (!user) {
        throw new Error('Please log in to use the chatbot');
      }

      const token = await user.getIdToken();

      const response = await fetch(`${API_BASE}/chatbot`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({
          message: trimmed,
          history: historyPayload,
        }),
      });

      if (!response.ok) {
        // ✅ Handle rate limit error (429)
        if (response.status === 429) {
          const data = await response.json().catch(() => ({}));
          const retryAfter = response.headers.get('RateLimit-Reset') || '1 minute';
          throw new Error(data.error || `Too many messages. Please wait ${retryAfter} and try again.`);
        }

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

      // ✅ User-friendly error messages
      let errorMessage = error.message || "Something went wrong. Please try again.";

      if (error.message?.includes('Too many')) {
        Alert.alert(
          "Slow Down",
          error.message,
          [{ text: 'OK' }]
        );
      } else if (error.message?.includes('log in')) {
        Alert.alert(
          "Authentication Required",
          "Please log in to use the chatbot.",
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert("Chatbot Error", errorMessage);
      }
    } finally {
      setSending(false);
    }
  }, [input, messages, sending, speak]);

  const renderMessage = ({ item }: { item: ChatMessage }) => {
    const isUser = item.role === "user";
    return (
      <View style={[
        chatBotStyles.messageRow, 
        isUser ? chatBotStyles.messageRowEnd : chatBotStyles.messageRowStart
      ]}>
        <View style={[
          chatBotStyles.bubble, 
          isUser ? chatBotStyles.userBubble : chatBotStyles.botBubble
        ]}>
          <Text style={[
            chatBotStyles.messageText, 
            isUser ? chatBotStyles.userText : chatBotStyles.botText
          ]}>
            {item.content}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <ImageBackground
      source={require("@/assets/chatbotAssets/chatbotBG.png")}
      style={chatBotStyles.background}
      resizeMode="cover"
    >
      <SafeAreaView style={chatBotStyles.safeArea} edges={["top"]}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={chatBotStyles.flex}
          keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
        >
          <View style={chatBotStyles.contentContainer}>
            <View style={chatBotStyles.culinaWrapper} pointerEvents="none">
              <Image
                source={currentPose}
                style={chatBotStyles.culinaModel}
                resizeMode="contain"
              />
            </View>
            <View style={chatBotStyles.overlay}>
              <View style={chatBotStyles.controlsContainer}>
                <TouchableOpacity
                  onPress={toggleVoice}
                  style={[
                    chatBotStyles.voiceButton,
                    !voiceEnabled && chatBotStyles.voiceButtonDisabled,
                  ]}
                  activeOpacity={0.8}
                >
                  {voiceEnabled ? (
                    <Volume2 size={18} color="#f8fafc" />
                  ) : (
                    <VolumeX size={18} color="#94a3b8" />
                  )}
                  <Text style={chatBotStyles.voiceLabel}>
                    {voiceEnabled ? "Voice ON" : "Voice OFF"}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={toggleExpanded}
                  style={chatBotStyles.expandButton}
                  activeOpacity={0.8}
                >
                  {expanded ? (
                    <ChevronDown size={20} color="#f8fafc" />
                  ) : (
                    <ChevronUp size={20} color="#f8fafc" />
                  )}
                </TouchableOpacity>
              </View>

              {!expanded && displayedMessages.length > 0 && (
                <View style={chatBotStyles.collapsedMessageContainer}>
                  <View style={chatBotStyles.collapsedBubble}>
                    <Text style={chatBotStyles.collapsedText}>{displayedMessages[0].content}</Text>
                  </View>
                </View>
              )}

              <View
                style={[
                  chatBotStyles.chatPanel,
                  expanded ? chatBotStyles.chatPanelExpanded : chatBotStyles.chatPanelCollapsed,
                ]}
              >
                <View style={expanded ? chatBotStyles.messagesWrapper : chatBotStyles.messagesPlaceholder}>
                  {expanded && (
                    <FlatList
                      ref={listRef}
                      data={displayedMessages}
                      keyExtractor={(item) => item.id}
                      renderItem={renderMessage}
                      contentContainerStyle={chatBotStyles.messages}
                      style={chatBotStyles.messageList}
                      showsVerticalScrollIndicator={false}
                    />
                  )}
                </View>

                <View style={chatBotStyles.inputContainer}>
                  <TextInput
                    style={chatBotStyles.input}
                    placeholder="Share what you're cooking or ask me question! I am here for you!"
                    placeholderTextColor="#94a3b8"
                    value={input}
                    onChangeText={setInput}
                    multiline
                  />
                  <TouchableOpacity
                    style={[
                      chatBotStyles.sendButton,
                      (!input.trim() || sending) && chatBotStyles.sendButtonDisabled,
                    ]}
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
