import React, { useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Platform,
  KeyboardAvoidingView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContext";
import { useAnalysis } from "@/context/AnalysisContext";
import { analyzeText } from "@/lib/api";
import { LoadingOverlay } from "@/components/LoadingOverlay";
import { AnalysisResultCard } from "@/components/AnalysisResultCard";

const SUGGESTIONS = [
  "بيتزا", "كنتاكي", "همبرغر", "شاورما", "كباب", "فول مدمس",
  "عصير برتقال", "شوكولاته", "جيلي", "هوت دوج", "سوشي",
];

export default function SearchScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { setCurrentReport, isAnalyzing, setIsAnalyzing } = useAnalysis();
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<any>(null);
  const inputRef = useRef<TextInput>(null);
  const topPadding = Platform.OS === "web" ? 67 : insets.top;

  const handleAnalyze = async (q?: string) => {
    const text = (q ?? query).trim();
    if (!text) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsAnalyzing(true);
    setResult(null);
    try {
      const report = await analyzeText(text, user?.id);
      setResult(report);
      setCurrentReport(report);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {isAnalyzing && <LoadingOverlay />}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={{ paddingBottom: 120 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={[styles.header, { paddingTop: topPadding + 12, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
            <Text style={[styles.title, { color: colors.foreground }]}>بحث عن طعام</Text>
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
              أدخل اسم الطعام أو الوجبة أو المنتج
            </Text>

            {/* Search Input */}
            <View style={[styles.searchRow, { backgroundColor: colors.muted, borderColor: colors.border }]}>
              <TextInput
                ref={inputRef}
                style={[styles.input, { color: colors.foreground, fontFamily: "Inter_400Regular" }]}
                placeholder="مثال: بيتزا، شاورما، كنتاكي..."
                placeholderTextColor={colors.mutedForeground}
                value={query}
                onChangeText={setQuery}
                textAlign="right"
                returnKeyType="search"
                onSubmitEditing={() => handleAnalyze()}
              />
              <TouchableOpacity
                style={[styles.searchBtn, { backgroundColor: query.trim() ? colors.primary : colors.border }]}
                onPress={() => handleAnalyze()}
                disabled={!query.trim() || isAnalyzing}
              >
                <Ionicons name="search" size={20} color={query.trim() ? "#fff" : colors.mutedForeground} />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.content}>
            {/* Suggestions */}
            {!result && (
              <>
                <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>اقتراحات سريعة</Text>
                <View style={styles.suggestionsWrap}>
                  {SUGGESTIONS.map((s) => (
                    <TouchableOpacity
                      key={s}
                      style={[styles.suggestionChip, { backgroundColor: colors.secondary, borderColor: colors.border }]}
                      onPress={() => { setQuery(s); handleAnalyze(s); }}
                    >
                      <Text style={[styles.suggestionText, { color: colors.secondaryForeground }]}>{s}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}

            {/* Result */}
            {result && (
              <View style={styles.resultContainer}>
                <View style={styles.resultHeader}>
                  <Text style={[styles.resultLabel, { color: colors.foreground }]}>نتيجة التحليل</Text>
                  <TouchableOpacity onPress={() => setResult(null)}>
                    <Ionicons name="refresh" size={20} color={colors.mutedForeground} />
                  </TouchableOpacity>
                </View>
                <AnalysisResultCard report={result} />
              </View>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flex: 1 },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    gap: 6,
  },
  title: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    textAlign: "right",
  },
  subtitle: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "right",
    marginBottom: 8,
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 1,
    paddingLeft: 8,
    overflow: "hidden",
  },
  input: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 10,
    fontSize: 16,
  },
  searchBtn: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    margin: 4,
  },
  content: {
    padding: 16,
    gap: 12,
  },
  sectionLabel: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    textAlign: "right",
  },
  suggestionsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    justifyContent: "flex-end",
  },
  suggestionChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  suggestionText: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
  resultContainer: {
    gap: 10,
  },
  resultHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  resultLabel: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    textAlign: "right",
  },
});
