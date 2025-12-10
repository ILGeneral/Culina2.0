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
const MAX_STORED_MESSAGES = 50;

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

  // --- EFFECTS (Keep your existing effects logic here) ---
  // (Loading, Saving, Speech Cleanup, Animations)
  // Re-pasting standard logic to ensure completeness
  useEffect(() => {
    const loadMessages = async () => {
      try {
        const user = auth.currentUser;
        if (!user) { setMessagesLoaded(true); return; }
        const storageKey = `${CHAT_STORAGE_KEY}_${user.uid}`;
        const storedMessages = await AsyncStorage.getItem(storageKey);
        if (storedMessages) {
          const parsed = JSON.parse(storedMessages) as ChatMessage[];
          if (Array.isArray(parsed) && parsed.length > 0) setMessages(parsed);
        }
      } catch (error) { console.error(error); } finally { setMessagesLoaded(true); }
    };
    loadMessages();
  }, []);

  useEffect(() => {
    if (!messagesLoaded) return;
    const saveMessages = async () => {
      try {
        const user = auth.currentUser;
        if (!user) return;
        const storageKey = `${CHAT_STORAGE_KEY}_${user.uid}`;
        const messagesToStore = messages.slice(-MAX_STORED_MESSAGES);
        await AsyncStorage.setItem(storageKey, JSON.stringify(messagesToStore));
      } catch (error) { console.error(error); }
    };
    saveMessages();
  }, [messages, messagesLoaded]);

  useEffect(() => { return () => { Speech.stop(); setSpeaking(false); }; }, []);

  useFocusEffect(useCallback(() => { return () => { Speech.stop(); setSpeaking(false); }; }, []));

  useEffect(() => {
    if (speaking || sending) {
      pulseScale.value = withRepeat(withSequence(withTiming(1.05, { duration: 800 }), withTiming(1, { duration: 800 })), -1, false);
    } else { pulseScale.value = withTiming(1, { duration: 300 }); }
  }, [speaking, sending]);

  useEffect(() => {
    if (!expanded && (speaking || sending)) {
      shimmerOpacity.value = withRepeat(withSequence(withTiming(0.7, { duration: 1500 }), withTiming(0.3, { duration: 1500 })), -1, false);
    } else { shimmerOpacity.value = withTiming(0.8, { duration: 300 }); }
  }, [expanded, speaking, sending]);

  useEffect(() => {
    if (sending) {
      typingDot1.value = withRepeat(withSequence(withDelay(0, withTiming(-8, { duration: 400 })), withTiming(0, { duration: 400 })), -1, false);
      typingDot2.value = withRepeat(withSequence(withDelay(150, withTiming(-8, { duration: 400 })), withTiming(0, { duration: 400 })), -1, false);
      typingDot3.value = withRepeat(withSequence(withDelay(300, withTiming(-8, { duration: 400 })), withTiming(0, { duration: 400 })), -1, false);
    } else {
      typingDot1.value = withTiming(0, { duration: 200 });
      typingDot2.value = withTiming(0, { duration: 200 });
      typingDot3.value = withTiming(0, { duration: 200 });
    }
  }, [sending]);

  useEffect(() => {
    if (!messages.length) return;
    setTimeout(() => { listRef.current?.scrollToEnd({ animated: true }); }, 100);
  }, [messages, expanded]);

  // --- HANDLERS ---
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
      return options.length === 0 ? prev : options[Math.floor(Math.random() * options.length)];
    });
  }, []);

  const toggleVoice = useCallback(() => setVoiceEnabled(prev => { if(prev) Speech.stop(); return !prev; }), []);
  const toggleExpanded = useCallback(() => { Keyboard.dismiss(); setExpanded(prev => !prev); }, []);

  const displayedMessages = useMemo(() => {
    if (expanded) return messages;
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      if (messages[i].role === "assistant") return [messages[i]];
    }
    return messages.length > 0 ? [messages[messages.length - 1]] : [];
  }, [expanded, messages]);

  const handleSend = useCallback(async () => {
    if (!input.trim() || sending) return;
    const trimmed = input.trim();
    const userMessage: ChatMessage = { id: `${Date.now()}-user`, role: "user", content: trimmed };
    const historyPayload = [...messages.map(({ role, content }) => ({ role, content })), { role: "user", content: trimmed }];

    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setSending(true);

    try {
      const user = auth.currentUser;
      if (!user) throw new Error('Please log in');
      const token = await user.getIdToken();
      const response = await fetch(`${API_BASE}/chatbot`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ message: trimmed, history: historyPayload }),
      });

      if (!response.ok) {
         const data = await response.json().catch(() => ({}));
         throw new Error(data.error || "Chatbot request failed");
      }
      const data = await response.json();
      const replyText = typeof data?.reply === "string" && data.reply.trim() ? data.reply.trim() : "I'm here for you!";
      
      const assistantMessage: ChatMessage = { id: `${Date.now()}-assistant`, role: "assistant", content: replyText };
      setMessages(prev => [...prev, assistantMessage]);
      switchPose();
      speak(replyText);
    } catch (error: any) {
      Alert.alert("Error", error.message);
    } finally {
      setSending(false);
    }
  }, [input, messages, sending, speak]);

  // --- ANIMATED STYLES ---
  const pulseStyle = useAnimatedStyle(() => ({ transform: [{ scale: pulseScale.value }] }));
  const shimmerStyle = useAnimatedStyle(() => ({ opacity: shimmerOpacity.value }));
  const typingDot1Style = useAnimatedStyle(() => ({ transform: [{ translateY: typingDot1.value }] }));
  const typingDot2Style = useAnimatedStyle(() => ({ transform: [{ translateY: typingDot2.value }] }));
  const typingDot3Style = useAnimatedStyle(() => ({ transform: [{ translateY: typingDot3.value }] }));

  // --- RENDERERS ---
  const renderFormattedText = (content: string, isUser: boolean) => {
    const lines = content.split('\n');
    return <View>{lines.map((line, i) => <Text key={i} style={isUser ? chatBotStyles.userText : chatBotStyles.botText}>{line}</Text>)}</View>;
  };

  const renderMessage = ({ item }: { item: ChatMessage }) => {
    const isUser = item.role === "user";
    return (
      <View style={[chatBotStyles.messageRow, isUser ? chatBotStyles.messageRowEnd : chatBotStyles.messageRowStart]}>
        <View style={[chatBotStyles.bubble, isUser ? chatBotStyles.userBubble : chatBotStyles.botBubble]}>
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
      <SafeAreaView style={chatBotStyles.safeArea} edges={["top", "left", "right"]}>
        
        {/* === LAYER 1: STATIC IMAGE (Absolute, Ignore Keyboard) === */}
        <View style={chatBotStyles.culinaWrapper} pointerEvents="none">
          <Image source={currentPose} style={chatBotStyles.culinaModel} resizeMode="contain" />
        </View>

        {/* === LAYER 2: KEYBOARD HANDLING === */}
        {/* We use behavior 'padding' on iOS and standard behavior on Android */}
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={chatBotStyles.keyboardContainer}
          keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
        >
          {/* This container pushes content to the bottom using justifyContent: 'flex-end' */}
          <View style={chatBotStyles.contentContainer}>
            
            {/* Top Empty Space - Touch to dismiss */}
            <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
              <View style={{ flex: 1, width: '100%' }} pointerEvents="box-none">

                {/* Controls (Absolute top right) */}
                <View style={chatBotStyles.controlsContainer}>
                  <TouchableOpacity onPress={toggleVoice} style={[chatBotStyles.voiceButton, !voiceEnabled && chatBotStyles.voiceButtonDisabled]}>
                    {voiceEnabled ? <Volume2 size={18} color="#f8fafc" /> : <VolumeX size={18} color="#94a3b8" />}
                    <Text style={chatBotStyles.voiceLabel}>{voiceEnabled ? "Voice ON" : "Voice OFF"}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={toggleExpanded} style={chatBotStyles.expandButton}>
                    {expanded ? <ChevronDown size={20} color="#f8fafc" /> : <ChevronUp size={20} color="#f8fafc" />}
                  </TouchableOpacity>
                </View>

                {/* Collapsed Bubble - Shows only when NOT expanded */}
                {!expanded && displayedMessages.length > 0 && (
                  <View style={chatBotStyles.collapsedMessageContainer}>
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
                          showsVerticalScrollIndicator={true}
                          scrollEnabled={true}
                          nestedScrollEnabled={true}
                          bounces={true}
                        >
                          <Animated.Text entering={FadeIn.duration(400)} style={chatBotStyles.collapsedText}>
                            {displayedMessages[0]?.content || ''}
                          </Animated.Text>
                        </ScrollView>
                      )}
                    </Animated.View>
                  </View>
                )}

              </View>
            </TouchableWithoutFeedback>

            {/* Chat Panel - Naturally sits at the bottom */}
            <View style={[
              chatBotStyles.chatPanel,
              expanded ? chatBotStyles.chatPanelExpanded : chatBotStyles.chatPanelCollapsed
            ]}>
              {expanded && (
                <View style={chatBotStyles.messagesWrapper}>
                  <FlatList
                    ref={listRef}
                    data={displayedMessages}
                    keyExtractor={(item) => item.id}
                    renderItem={renderMessage}
                    contentContainerStyle={chatBotStyles.messages}
                    style={chatBotStyles.messageList}
                    onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
                  />
                </View>
              )}

              <View style={chatBotStyles.inputContainer}>
                <TextInput
                  style={chatBotStyles.input}
                  placeholder="Share what you're cooking!"
                  placeholderTextColor="#94a3b8"
                  value={input}
                  onChangeText={setInput}
                  multiline
                  maxLength={500}
                />
                <TouchableOpacity
                  style={[chatBotStyles.sendButton, (!input.trim() || sending) && chatBotStyles.sendButtonDisabled]}
                  onPress={handleSend}
                  disabled={!input.trim() || sending}
                >
                  {sending ? <ActivityIndicator color="#fff" size="small" /> : <Send size={20} color="#fff" />}
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