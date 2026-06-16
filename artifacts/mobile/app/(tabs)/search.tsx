import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Platform,
  KeyboardAvoidingView,
  FlatList,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon } from "@/components/Icon";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContext";
import { useAnalysis } from "@/context/AnalysisContext";
import { analyzeText, listFoods } from "@/lib/api";
import { LoadingOverlay } from "@/components/LoadingOverlay";
import { AnalysisResultCard } from "@/components/AnalysisResultCard";

const QUICK_SUGGESTIONS = [
  "بيتزا", "كنتاكي", "همبرغر", "شاورما", "كباب", "فول مدمس",
  "عصير برتقال", "شوكولاته", "جيلي", "هوت دوج", "سوشي",
];

type FoodSuggestion = { id: number; nameAr: string; nameEn: string; status: string };

const STATUS_COLORS: Record<string, string> = {
  allowed: "#16a34a",
  forbidden: "#dc2626",
  conditional: "#d97706",
};

const STATUS_DOT: Record<string, string> = {
  allowed: "#22c55e",
  forbidden: "#ef4444",
  conditional: "#f59e0b",
};

export default function SearchScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { setCurrentReport, isAnalyzing, setIsAnalyzing } = useAnalysis();
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<any>(null);
  const [suggestions, setSuggestions] = useState<FoodSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isFetchingSuggestions, setIsFetchingSuggestions] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const topPadding = Platform.OS === "web" ? 67 : insets.top;

  const fetchSuggestions = useCallback(async (text: string) => {
    if (text.trim().length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    setIsFetchingSuggestions(true);
    try {
      const foods = await listFoods({ search: text.trim(), limit: 8 });
      setSuggestions(foods ?? []);
      setShowSuggestions((foods?.length ?? 0) > 0);
    } catch {
      setSuggestions([]);
      setShowSuggestions(false);
    } finally {
      setIsFetchingSuggestions(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    debounceRef.current = setTimeout(() => {
      fetchSuggestions(query);
    }, 280);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, fetchSuggestions]);

  const handleAnalyze = async (q?: string) => {
    const text = (q ?? query).trim();
    if (!text) return;
    setShowSuggestions(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsAnalyzing(true);
    setResult(null);
    try {
      const report = await analyzeText(text);
      setResult(report);
      setCurrentReport(report);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSelectSuggestion = (food: FoodSuggestion) => {
    const name = food.nameAr;
    setQuery(name);
    setShowSuggestions(false);
    handleAnalyze(name);
  };

  const handleChangeText = (text: string) => {
    setQuery(text);
    if (!text.trim()) {
      setResult(null);
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

            {/* Search Input + Autocomplete */}
            <View>
              <View style={[styles.searchRow, { backgroundColor: colors.muted, borderColor: showSuggestions ? colors.primary : colors.border }]}>
                <TextInput
                  ref={inputRef}
                  style={[styles.input, { color: colors.foreground, fontFamily: "Tajawal_400Regular" }]}
                  placeholder="مثال: بيتزا، شاورما، كنتاكي..."
                  placeholderTextColor={colors.mutedForeground}
                  value={query}
                  onChangeText={handleChangeText}
                  textAlign="right"
                  returnKeyType="search"
                  onSubmitEditing={() => handleAnalyze()}
                  onFocus={() => query.trim().length >= 2 && setShowSuggestions(suggestions.length > 0)}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                />
                {query.length > 0 && (
                  <TouchableOpacity
                    style={styles.clearBtn}
                    onPress={() => { setQuery(""); setSuggestions([]); setShowSuggestions(false); setResult(null); }}
                  >
                    <Icon name="close-circle" size={18} color={colors.mutedForeground} />
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={[styles.searchBtn, { backgroundColor: query.trim() ? colors.primary : colors.border }]}
                  onPress={() => handleAnalyze()}
                  disabled={!query.trim() || isAnalyzing}
                >
                  <Icon name="search" size={20} color={query.trim() ? "#fff" : colors.mutedForeground} />
                </TouchableOpacity>
              </View>

              {/* Suggestions dropdown */}
              {showSuggestions && suggestions.length > 0 && (
                <View style={[styles.dropdown, { backgroundColor: colors.card, borderColor: colors.border, shadowColor: colors.foreground }]}>
                  {suggestions.map((food, idx) => (
                    <TouchableOpacity
                      key={food.id}
                      style={[
                        styles.suggestionRow,
                        idx < suggestions.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border },
                      ]}
                      onPress={() => handleSelectSuggestion(food)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.suggestionLeft}>
                        <View style={[styles.statusDot, { backgroundColor: STATUS_DOT[food.status] ?? "#94a3b8" }]} />
                        <View style={styles.suggestionNames}>
                          <Text style={[styles.suggestionAr, { color: colors.foreground }]}>{food.nameAr}</Text>
                          <Text style={[styles.suggestionEn, { color: colors.mutedForeground }]}>{food.nameEn}</Text>
                        </View>
                      </View>
                      <Text style={[styles.statusLabel, { color: STATUS_COLORS[food.status] ?? colors.mutedForeground }]}>
                        {food.status === "allowed" ? "مسموح" : food.status === "forbidden" ? "ممنوع" : "مشروط"}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          </View>

          <View style={styles.content}>
            {/* Quick suggestions */}
            {!result && !query.trim() && (
              <>
                <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>اقتراحات سريعة</Text>
                <View style={styles.suggestionsWrap}>
                  {QUICK_SUGGESTIONS.map((s) => (
                    <TouchableOpacity
                      key={s}
                      style={[styles.chip, { backgroundColor: colors.secondary, borderColor: colors.border }]}
                      onPress={() => { setQuery(s); handleAnalyze(s); }}
                    >
                      <Text style={[styles.chipText, { color: colors.secondaryForeground }]}>{s}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}

            {/* Result */}
            {result && (
              <View style={styles.resultContainer}>
                {!result.notFound && (
                  <View style={styles.resultHeader}>
                    <Text style={[styles.resultLabel, { color: colors.foreground }]}>نتيجة التحليل</Text>
                    <TouchableOpacity onPress={() => { setResult(null); setQuery(""); }}>
                      <Icon name="refresh" size={20} color={colors.mutedForeground} />
                    </TouchableOpacity>
                  </View>
                )}
                <AnalysisResultCard
                  report={result}
                  onRetry={() => { setResult(null); setQuery(""); }}
                />
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
    fontFamily: "Tajawal_700Bold",
    textAlign: "right",
  },
  subtitle: {
    fontSize: 14,
    fontFamily: "Tajawal_400Regular",
    textAlign: "right",
    marginBottom: 8,
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 1.5,
    paddingLeft: 8,
    overflow: "visible",
  },
  input: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 10,
    fontSize: 16,
  },
  clearBtn: {
    paddingHorizontal: 6,
    justifyContent: "center",
    alignItems: "center",
  },
  searchBtn: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    margin: 4,
  },
  dropdown: {
    position: "absolute",
    top: "100%",
    left: 0,
    right: 0,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 4,
    zIndex: 100,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 8,
    overflow: "hidden",
  },
  suggestionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  suggestionLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  suggestionNames: {
    flex: 1,
    alignItems: "flex-end",
  },
  suggestionAr: {
    fontSize: 14,
    fontFamily: "Tajawal_500Medium",
    textAlign: "right",
  },
  suggestionEn: {
    fontSize: 11,
    fontFamily: "Tajawal_400Regular",
    textAlign: "right",
    marginTop: 1,
  },
  statusLabel: {
    fontSize: 11,
    fontFamily: "Tajawal_700Bold",
    marginLeft: 8,
  },
  content: {
    padding: 16,
    gap: 12,
  },
  sectionLabel: {
    fontSize: 13,
    fontFamily: "Tajawal_500Medium",
    textAlign: "right",
  },
  suggestionsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    justifyContent: "flex-end",
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 14,
    fontFamily: "Tajawal_500Medium",
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
    fontFamily: "Tajawal_700Bold",
    textAlign: "right",
  },
});
