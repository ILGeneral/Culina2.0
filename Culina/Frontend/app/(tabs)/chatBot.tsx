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
  ScrollView,
  Keyboard,
  TouchableWithoutFeedback,
} from "react-native";
import chatBotStyles from "@/styles/chat/chatBotStyles";
import type { ImageSourcePropType } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Send, Volume2, VolumeX, ChevronUp, ChevronDown } from "lucide-react-native";
import * as Speech from "expo-speech";
import { auth } from "@/lib/firebaseConfig";
import { useFocusEffect } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Animated, {
  FadeIn,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  Easing,
  withDelay,
} from "react-native-reanimated";

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

const CHAT_STORAGE_KEY = '@culina/chatbot_messages';
const MAX_STORED_MESSAGES = 50; // Limit stored messages to prevent excessive storage usage

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
  const [messagesLoaded, setMessagesLoaded] = useState(false);
  const listRef = useRef<FlatList<ChatMessage>>(null);

  // Animation values
  const pulseScale = useSharedValue(1);
  const shimmerOpacity = useSharedValue(0.3);
  const typingDot1 = useSharedValue(0);
  const typingDot2 = useSharedValue(0);
  const typingDot3 = useSharedValue(0);

  // Load messages from AsyncStorage on mount
  useEffect(() => {
    const loadMessages = async () => {
      try {
        const user = auth.currentUser;
        if (!user) {
          setMessagesLoaded(true);
          return;
        }

        const storageKey = `${CHAT_STORAGE_KEY}_${user.uid}`;
        const storedMessages = await AsyncStorage.getItem(storageKey);

        if (storedMessages) {
          const parsed = JSON.parse(storedMessages) as ChatMessage[];
          if (Array.isArray(parsed) && parsed.length > 0) {
            setMessages(parsed);
          }
        }
      } catch (error) {
        console.error('Failed to load chat messages:', error);
      } finally {
        setMessagesLoaded(true);
      }
    };

    loadMessages();
  }, []);

  // Save messages to AsyncStorage whenever they change
  useEffect(() => {
    if (!messagesLoaded) return; // Don't save until initial load is complete

    const saveMessages = async () => {
      try {
        const user = auth.currentUser;
        if (!user) return;

        const storageKey = `${CHAT_STORAGE_KEY}_${user.uid}`;
        // Keep only the most recent messages to prevent excessive storage usage
        const messagesToStore = messages.slice(-MAX_STORED_MESSAGES);
        await AsyncStorage.setItem(storageKey, JSON.stringify(messagesToStore));
      } catch (error) {
        console.error('Failed to save chat messages:', error);
      }
    };

    saveMessages();
  }, [messages, messagesLoaded]);

  useEffect(() => {
    return () => {
      Speech.stop();
      setSpeaking(false);
    };
  }, []);

  // Stop TTS when navigating away from the screen
  useFocusEffect(
    useCallback(() => {
      return () => {
        Speech.stop();
        setSpeaking(false);
      };
    }, [])
  );

  // Pulse animation for speaking or new messages
  useEffect(() => {
    if (speaking || sending) {
      pulseScale.value = withRepeat(
        withSequence(
          withTiming(1.05, { duration: 800, easing: Easing.inOut(Easing.ease) }),
          withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        false
      );
    } else {
      pulseScale.value = withTiming(1, { duration: 300 });
    }
  }, [speaking, sending]);

  // Shimmer animation for collapsed bubble - only when speaking or sending
  useEffect(() => {
    if (!expanded && (speaking || sending)) {
      shimmerOpacity.value = withRepeat(
        withSequence(
          withTiming(0.7, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.3, { duration: 1500, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        false
      );
    } else {
      shimmerOpacity.value = withTiming(0.8, { duration: 300 });
    }
  }, [expanded, speaking, sending]);

  // Typing indicator animation
  useEffect(() => {
    if (sending) {
      typingDot1.value = withRepeat(
        withSequence(
          withDelay(0, withTiming(-8, { duration: 400 })),
          withTiming(0, { duration: 400 })
        ),
        -1,
        false
      );
      typingDot2.value = withRepeat(
        withSequence(
          withDelay(150, withTiming(-8, { duration: 400 })),
          withTiming(0, { duration: 400 })
        ),
        -1,
        false
      );
      typingDot3.value = withRepeat(
        withSequence(
          withDelay(300, withTiming(-8, { duration: 400 })),
          withTiming(0, { duration: 400 })
        ),
        -1,
        false
      );
    } else {
      typingDot1.value = withTiming(0, { duration: 200 });
      typingDot2.value = withTiming(0, { duration: 200 });
      typingDot3.value = withTiming(0, { duration: 200 });
    }
  }, [sending]);

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
      // Get auth token before making request
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
        // Handle rate limit error (429)
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

      // Error msges
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

  // Animated styles
  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
  }));

  const shimmerStyle = useAnimatedStyle(() => ({
    opacity: shimmerOpacity.value,
  }));

  const typingDot1Style = useAnimatedStyle(() => ({
    transform: [{ translateY: typingDot1.value }],
  }));

  const typingDot2Style = useAnimatedStyle(() => ({
    transform: [{ translateY: typingDot2.value }],
  }));

  const typingDot3Style = useAnimatedStyle(() => ({
    transform: [{ translateY: typingDot3.value }],
  }));

  // Enhanced text renderer for formatted messages
  const renderFormattedText = (content: string, isUser: boolean) => {
    const lines = content.split('\n');
    const elements: React.ReactElement[] = [];

    lines.forEach((line, index) => {
      // Skip empty lines
      if (!line.trim()) {
        elements.push(<View key={`space-${index}`} style={{ height: 8 }} />);
        return;
      }

      const textStyle = isUser ? chatBotStyles.userText : chatBotStyles.botText;

      // Bold headers (e.g., **Title:**)
      if (line.includes('**')) {
        const parts = line.split('**');
        elements.push(
          <Text key={`line-${index}`} style={textStyle}>
            {parts.map((part, i) =>
              i % 2 === 1 ? (
                <Text key={`bold-${i}`} style={{ fontWeight: '700', fontSize: 16 }}>{part}</Text>
              ) : (
                <Text key={`normal-${i}`}>{part}</Text>
              )
            )}
          </Text>
        );
      }
      // Bullet points
      else if (line.trim().startsWith('•')) {
        elements.push(
          <View key={`bullet-${index}`} style={{ flexDirection: 'row', marginLeft: 8, marginVertical: 2 }}>
            <Text style={[textStyle, { marginRight: 8 }]}>•</Text>
            <Text style={[textStyle, { flex: 1 }]}>{line.trim().substring(1).trim()}</Text>
          </View>
        );
      }
      // Numbered lists
      else if (/^\d+\./.test(line.trim())) {
        const match = line.trim().match(/^(\d+\.)\s*(.*)$/);
        if (match) {
          elements.push(
            <View key={`number-${index}`} style={{ flexDirection: 'row', marginLeft: 8, marginVertical: 2 }}>
              <Text style={[textStyle, { marginRight: 8, fontWeight: '600' }]}>{match[1]}</Text>
              <Text style={[textStyle, { flex: 1 }]}>{match[2]}</Text>
            </View>
          );
        }
      }
      // Regular text
      else {
        elements.push(
          <Text key={`line-${index}`} style={[textStyle, { marginVertical: 2 }]}>
            {line}
          </Text>
        );
      }
    });

    return <View>{elements}</View>;
  };

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
          {renderFormattedText(item.content, isUser)}
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
          <View style={chatBotStyles.contentContainer}>
            {/* Component 1: Culina Image (Independent - Absolute) */}
            <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
              <View style={chatBotStyles.culinaWrapper} pointerEvents="box-none">
                <Image
                  source={currentPose}
                  style={chatBotStyles.culinaModel}
                  resizeMode="contain"
                />
              </View>
            </TouchableWithoutFeedback>

            {/* Component 2: Top Controls (Independent - Absolute) */}
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

            {/* Component 3: Collapsed Message (Independent - Absolute) */}
            {!expanded && displayedMessages.length > 0 && (
              <View style={chatBotStyles.collapsedMessageContainer} pointerEvents="box-none">
                <Animated.View style={[chatBotStyles.collapsedBubble, pulseStyle, shimmerStyle]}>
                  {sending ? (
                    <View style={chatBotStyles.typingIndicatorContainer}>
                      <Text style={chatBotStyles.typingText}>Culina is typing</Text>
                      <View style={chatBotStyles.typingDotsContainer}>
                        <Animated.View style={[chatBotStyles.typingDot, typingDot1Style]} />
                        <Animated.View style={[chatBotStyles.typingDot, typingDot2Style]} />
                        <Animated.View style={[chatBotStyles.typingDot, typingDot3Style]} />
                      </View>
                    </View>
                  ) : (
                    <ScrollView
                      style={chatBotStyles.collapsedScrollView}
                      contentContainerStyle={{ paddingVertical: 4 }}
                      showsVerticalScrollIndicator={true}
                      nestedScrollEnabled={true}
                      scrollEnabled={true}
                      bounces={true}
                    >
                      <Animated.Text
                        entering={FadeIn.duration(400).delay(100)}
                        style={chatBotStyles.collapsedText}
                      >
                        {displayedMessages[0]?.content || ''}
                      </Animated.Text>
                    </ScrollView>
                  )}
                </Animated.View>
              </View>
            )}

            {/* Component 4: Chat Panel with Keyboard Handling (Independent - Absolute with KeyboardAvoidingView) */}
            <KeyboardAvoidingView
              behavior={Platform.OS === "ios" ? "padding" : "height"}
              style={{ position: 'absolute', bottom: 0, left: 0, right: 0 }}
              keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
            >
              <View
                style={[
                  chatBotStyles.chatPanel,
                  expanded ? chatBotStyles.chatPanelExpanded : chatBotStyles.chatPanelCollapsed,
                ]}
              >
                {expanded ? (
                  <View style={chatBotStyles.messagesWrapper}>
                    <FlatList
                      ref={listRef}
                      data={displayedMessages}
                      keyExtractor={(item) => item.id}
                      renderItem={renderMessage}
                      contentContainerStyle={chatBotStyles.messages}
                      style={chatBotStyles.messageList}
                      showsVerticalScrollIndicator={true}
                      keyboardShouldPersistTaps="handled"
                      scrollEnabled={true}
                      nestedScrollEnabled={true}
                      bounces={true}
                      alwaysBounceVertical={true}
                      keyboardDismissMode="interactive"
                    />
                  </View>
                ) : (
                  <View style={chatBotStyles.messagesPlaceholder} />
                )}

                <View style={chatBotStyles.inputContainer}>
                  <TextInput
                    style={chatBotStyles.input}
                    placeholder="Share what you're cooking or ask me question! I am here for you!"
                    placeholderTextColor="#94a3b8"
                    value={input}
                    onChangeText={setInput}
                    multiline
                    maxLength={500}
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
            </KeyboardAvoidingView>
          </View>
      </SafeAreaView>
    </ImageBackground>
  );
};

export default ChatBotScreen;