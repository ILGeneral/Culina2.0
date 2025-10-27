import React, { useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeft, Users, Flame } from "lucide-react-native";
import Background from "@/components/Background";
import type { Recipe } from "@/types/recipe";

const extractRecipe = (raw?: string | string[]): Recipe | null => {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value) return null;
  try {
    return JSON.parse(decodeURIComponent(value)) as Recipe;
  } catch (err) {
    console.error("Failed to parse recipe payload:", err);
    return null;
  }
};

const GeneratedRecipeDetailsScreen = () => {
  const router = useRouter();
  const params = useLocalSearchParams<{ data?: string | string[] }>();

  const recipe = useMemo(() => extractRecipe(params.data), [params.data]);

  if (!recipe) {
    return (
      <Background>
        <SafeAreaView style={styles.container}>
          <View style={styles.center}>
            <Text style={styles.errorTitle}>Recipe unavailable</Text>
            <Text style={styles.errorSubtitle}>
              We couldn't load this recipe. Please try generating recipes again.
            </Text>
            <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
              <Text style={styles.backButtonText}>Go Back</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Background>
    );
  }

  return (
    <Background>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.headerIcon} onPress={() => router.back()}>
            <ArrowLeft color="#0284c7" size={28} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Recipe Details</Text>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.card}>
            <Text style={styles.title}>{recipe.title}</Text>

            {!!recipe.description && (
              <Text style={styles.description}>{recipe.description}</Text>
            )}

            <View style={styles.metaRow}>
              {!!recipe.servings && (
                <View style={[styles.metaPill, styles.servingsPill]}>
                  <Users size={16} color="#0284c7" />
                  <Text style={styles.metaText}>Serves {recipe.servings}</Text>
                </View>
              )}
              {!!recipe.estimatedCalories && (
                <View style={[styles.metaPill, styles.caloriesPill]}>
                  <Flame size={16} color="#f97316" />
                  <Text style={styles.metaText}>{recipe.estimatedCalories} kcal</Text>
                </View>
              )}
              <View style={[styles.metaPill, styles.sourcePill]}>
                <Text style={styles.metaText}>{recipe.source || "AI Generated"}</Text>
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Ingredients</Text>
              {recipe.ingredients?.map((ingredient, idx) => {
                const name = typeof ingredient === "string" ? ingredient : ingredient.name;
                const qty = typeof ingredient === "string" ? undefined : ingredient.qty?.trim();
                const unit = typeof ingredient === "string" ? undefined : ingredient.unit?.trim();

                // Helper to check if unit is in qty (handles plural/singular)
                const unitInQty = (q: string, u: string): boolean => {
                  if (q.includes(u)) return true;
                  // Check singular/plural variants
                  if (u.endsWith('s') && q.includes(u.slice(0, -1))) return true;
                  if (!u.endsWith('s') && q.includes(u + 's')) return true;
                  return false;
                };

                // Check if unit is already in qty to avoid duplication
                let suffix = '';
                if (qty && unit) {
                  const qtyLower = qty.toLowerCase();
                  const unitLower = unit.toLowerCase();
                  // If unit is already in qty, just use qty
                  suffix = unitInQty(qtyLower, unitLower) ? qty : `${qty} ${unit}`;
                } else {
                  suffix = [qty, unit].filter(Boolean).join(" ");
                }

                return (
                  <Text key={idx} style={styles.listItem}>
                    • {name}
                    {suffix ? <Text style={styles.listItemQty}> — {suffix}</Text> : null}
                  </Text>
                );
              }) || (
                <Text style={styles.emptyText}>Ingredients were not provided.</Text>
              )}
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Instructions</Text>
              {recipe.instructions?.length ? (
                recipe.instructions.map((step, idx) => (
                  <Text key={idx} style={styles.listItem}>
                    {idx + 1}. {step}
                  </Text>
                ))
              ) : (
                <Text style={styles.emptyText}>Instructions were not provided.</Text>
              )}
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </Background>
  );
};

export default GeneratedRecipeDetailsScreen;

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  headerIcon: { padding: 4 },
  headerTitle: {
    marginLeft: 12,
    fontSize: 24,
    fontWeight: "700",
    color: "#0f172a",
  },
  scroll: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 20,
    shadowColor: "#94a3b8",
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 5 },
    shadowRadius: 15,
    elevation: 6,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  title: { fontSize: 26, fontWeight: "700", color: "#0f172a" },
  description: {
    marginTop: 12,
    fontSize: 16,
    lineHeight: 24,
    color: "#475569",
  },
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 20,
  },
  metaPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  servingsPill: { backgroundColor: "#e0f2fe" },
  caloriesPill: { backgroundColor: "#fff7ed" },
  sourcePill: { backgroundColor: "#f1f5f9" },
  metaText: { fontSize: 14, fontWeight: "500", color: "#334155" },
  section: { marginTop: 24 },
  sectionTitle: { fontSize: 18, fontWeight: "600", color: "#0f172a", marginBottom: 12 },
  listItem: { fontSize: 15, color: "#334155", lineHeight: 22, marginBottom: 8 },
  listItemQty: { fontSize: 15, color: "#64748b" },
  emptyText: { fontSize: 15, color: "#6b7280" },
  center: { flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 24 },
  errorTitle: { fontSize: 22, fontWeight: "700", color: "#0f172a", textAlign: "center" },
  errorSubtitle: { marginTop: 12, fontSize: 15, color: "#64748b", textAlign: "center" },
  backButton: {
    marginTop: 20,
    backgroundColor: "#128AFA",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 999,
  },
  backButtonText: { color: "#fff", fontWeight: "bold", fontSize: 16 },
});
