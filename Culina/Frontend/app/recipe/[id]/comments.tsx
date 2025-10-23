import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { addDoc, collection, doc, onSnapshot, orderBy, query, serverTimestamp } from "firebase/firestore";
import { db, auth } from "@/lib/firebaseConfig";
import Background from "@/components/Background";
import { ArrowLeft, Send } from "lucide-react-native";

interface Comment {
  id: string;
  text: string;
  createdAt?: any;
  userId: string;
  userName?: string;
}

type CommentDoc = Comment & { createdAt?: any };

export default function RecipeCommentsScreen() {
  const router = useRouter();
  const { id, title } = useLocalSearchParams<{ id: string; title?: string }>();
  const [comments, setComments] = useState<CommentDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!id) return;

    const commentsRef = collection(db, "sharedRecipes", String(id), "comments");
    const q = query(commentsRef, orderBy("createdAt", "desc"));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const docs = snapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as CommentDoc[];
        setComments(docs);
        setLoading(false);
      },
      (error) => {
        console.error("Failed to load comments", error);
        setLoading(false);
        Alert.alert("Error", "Failed to load comments.");
      }
    );

    return () => unsubscribe();
  }, [id]);

  const handleSend = useCallback(async () => {
    if (!id || !input.trim() || submitting) return;

    const user = auth.currentUser;
    if (!user) {
      Alert.alert("Login required", "Please sign in to leave a comment.");
      return;
    }

    try {
      setSubmitting(true);
      const commentsRef = collection(db, "sharedRecipes", String(id), "comments");
      await addDoc(commentsRef, {
        text: input.trim(),
        createdAt: serverTimestamp(),
        userId: user.uid,
        userName: user.displayName || user.email || "Anonymous cook",
      });
      setInput("");
    } catch (err) {
      console.error("Failed to post comment", err);
      Alert.alert("Error", "Could not post your comment. Try again later.");
    } finally {
      setSubmitting(false);
    }
  }, [id, input, submitting]);

  const getCommentDateLabel = (createdAt: any) => {
    try {
      if (createdAt?.toDate) {
        return createdAt.toDate().toLocaleString();
      }
      if (createdAt?.seconds) {
        return new Date(createdAt.seconds * 1000).toLocaleString();
      }
    } catch (err) {
      console.warn("Failed to format comment timestamp", err);
    }
    return "Just now";
  };

  const renderComment = ({ item }: { item: CommentDoc }) => {
    return (
      <View style={styles.commentCard}>
        <Text style={styles.commentAuthor}>{item.userName || "Anonymous cook"}</Text>
        <Text style={styles.commentDate}>{getCommentDateLabel(item.createdAt)}</Text>
        <Text style={styles.commentText}>{item.text}</Text>
      </View>
    );
  };

  return (
    <Background>
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={Platform.select({ ios: 90, android: 0 })}
        >
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
              <ArrowLeft color="#0f172a" size={22} />
            </TouchableOpacity>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {title ? `${title} comments` : "Recipe comments"}
            </Text>
            <View style={styles.headerSpacer} />
          </View>

          {loading ? (
            <View style={styles.loading}>
              <ActivityIndicator size="large" color="#128AFA" />
              <Text style={styles.loadingText}>Loading comments...</Text>
            </View>
          ) : (
            <FlatList
              data={comments}
              keyExtractor={(item) => item.id}
              renderItem={renderComment}
              contentContainerStyle={styles.listContent}
              ListEmptyComponent={() => (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyTitle}>No comments yet</Text>
                  <Text style={styles.emptySubtitle}>Be the first to share your thoughts!</Text>
                </View>
              )}
            />
          )}

          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              placeholder="Leave a comment"
              placeholderTextColor="#94a3b8"
              value={input}
              onChangeText={setInput}
              multiline
              numberOfLines={2}
            />
            <TouchableOpacity
              style={[styles.sendButton, (!input.trim() || submitting) && styles.sendDisabled]}
              disabled={!input.trim() || submitting}
              onPress={handleSend}
              activeOpacity={0.8}
            >
              {submitting ? <ActivityIndicator color="#fff" /> : <Send color="#fff" size={18} />}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Background>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 12,
    paddingTop: 8,
  },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(15,23,42,0.06)",
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    flex: 1,
    marginLeft: 12,
    marginRight: 12,
    fontSize: 18,
    fontWeight: "700",
    color: "#0f172a",
  },
  headerSpacer: { width: 40 },
  loading: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: { marginTop: 12, color: "#475569" },
  listContent: { paddingHorizontal: 20, paddingBottom: 24 },
  commentCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#0f172a",
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  commentAuthor: {
    fontWeight: "700",
    color: "#0f172a",
    marginBottom: 4,
  },
  commentDate: {
    fontSize: 12,
    color: "#64748b",
    marginBottom: 8,
  },
  commentText: {
    fontSize: 15,
    color: "#0f172a",
    lineHeight: 20,
  },
  emptyState: { alignItems: "center", padding: 40 },
  emptyTitle: { fontSize: 18, fontWeight: "700", color: "#0f172a" },
  emptySubtitle: { fontSize: 14, color: "#64748b", marginTop: 8 },
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    padding: 20,
    gap: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(15,23,42,0.08)",
    backgroundColor: "rgba(248,250,252,0.95)",
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "#fff",
    color: "#0f172a",
    fontSize: 15,
    shadowColor: "#0f172a",
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  sendButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#128AFA",
  },
  sendDisabled: {
    backgroundColor: "rgba(18,138,250,0.45)",
  },
});
