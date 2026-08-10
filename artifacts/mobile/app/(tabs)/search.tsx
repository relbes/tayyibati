import React, { useRef, useCallback } from "react";
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
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon } from "@/components/Icon";
import { useColors } from "@/hooks/useColors";
import { LoadingOverlay } from "@/components/LoadingOverlay";
import { AnalysisResultCard } from "@/components/AnalysisResultCard";
import { UsageWarningBanner } from "@/components/UsageWarningBanner";
import { AuthRequiredDialog } from "@/components/AuthRequiredDialog";
import { useFoodSearch } from "@/hooks/useFoodSearch";
import { FoodSearchInput } from "@/components/FoodSearchInput";
import { RefinementSuggestions } from "@/components/RefinementSuggestions";
import { isRTL } from "@/lib/i18n";

const QUICK_SUGGESTIONS = [
  "بيتزا", "كنتاكي", "همبرغر", "شاورما", "كباب", "فول مدمس",
  "عصير برتقال", "شوكولاته", "جيلي", "هوت دوج", "سوشي",
];

export default function SearchScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const topPadding = Platform.OS === "web" ? 67 : insets.top;
  const rtl = isRTL();

  const {
    query,
    setQuery,
    result,
    suggestions,
    showSuggestions,
    limitReached,
    authModalVisible,
    setAuthModalVisible,
    isAnalyzing,
    handleAnalyze,
    handleSelectDish,
    handleSelectSuggestion,
    clearSearch,
  } = useFoodSearch();

  const inputRef = useRef<TextInput>(null);

  const handleImageSearch = useCallback(() => {
    router.push("/(tabs)/camera");
  }, [router]);

  // Show AnalysisResultCard only for final single-entity results.
  // Multiple-dishes shows the selection UI via RefinementSuggestions.
  const showResultCard =
    !!result &&
    result.resultMode !== "MULTIPLE_DISHES" &&
    !result.requiresSelection;

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
          <View
            style={[
              styles.header,
              { paddingTop: topPadding + 12, backgroundColor: colors.card, borderBottomColor: colors.border },
            ]}
          >
            <Text style={[styles.title, { color: colors.foreground, textAlign: rtl ? "right" : "left" }]}>
              بحث عن طعام
            </Text>
            <Text style={[styles.subtitle, { color: colors.mutedForeground, textAlign: rtl ? "right" : "left" }]}>
              أدخل اسم الطعام أو الوجبة أو المنتج
            </Text>

            <View style={{ zIndex: 999 }}>
              <FoodSearchInput
                query={query}
                setQuery={setQuery}
                onSearch={handleAnalyze}
                onCameraPress={handleImageSearch}
                suggestions={suggestions}
                showSuggestions={showSuggestions}
                onSelectSuggestion={handleSelectSuggestion}
                isAnalyzing={isAnalyzing}
              />
            </View>
          </View>

          <View style={styles.content}>
            {/* Usage warnings */}
            {!limitReached && <UsageWarningBanner type="text" />}

            {limitReached && (
              <View style={[styles.limitBanner, { backgroundColor: colors.error + "15", borderColor: colors.error + "40" }]}>
                <Text style={[styles.limitBannerTitle, { color: colors.error, textAlign: rtl ? "right" : "left" }]}>
                  وصلت إلى الحد الشهري للبحث النصي
                </Text>
                <Text style={[styles.limitBannerSub, { color: colors.mutedForeground, textAlign: rtl ? "right" : "left" }]}>
                  يتجدد في أول الشهر القادم — أو اشترك في بريميوم للوصول غير المحدود
                </Text>
                <TouchableOpacity
                  style={[styles.limitBannerBtn, { backgroundColor: colors.accent, alignSelf: rtl ? "flex-start" : "flex-end" }]}
                  onPress={() => router.push("/pricing")}
                >
                  <Text style={styles.limitBannerBtnText}>اشترك الآن</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Search tip + quick chips — only when idle */}
            {!result && !limitReached && (
              <View style={[styles.tipCard, { backgroundColor: colors.primary + "12", borderColor: colors.primary + "30", flexDirection: rtl ? "row-reverse" : "row", alignItems: "flex-start" }]}>
                <Text style={styles.tipEmoji}>💡</Text>
                <Text style={[styles.tipText, { color: colors.primary, flex: 1, textAlign: rtl ? "right" : "left" }]}>
                  للحصول على نتائج دقيقة، اكتب اسم المادة بوضوح باللغة العربية أو الإنجليزية
                </Text>
              </View>
            )}

            {!result && !query.trim() && (
              <>
                <Text style={[styles.sectionLabel, { color: colors.mutedForeground, textAlign: rtl ? "right" : "left", width: "100%" }]}>
                  اقتراحات سريعة
                </Text>
                <View style={[styles.suggestionsWrap, { justifyContent: rtl ? "flex-end" : "flex-start" }]}>
                  {QUICK_SUGGESTIONS.map((s) => (
                    <TouchableOpacity
                      key={s}
                      style={[styles.chip, { backgroundColor: colors.secondary, borderColor: colors.border }]}
                      onPress={() => {
                        setQuery(s);
                        handleAnalyze(s);
                      }}
                    >
                      <Text style={[styles.chipText, { color: colors.secondaryForeground }]}>{s}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}

            {/* Results */}
            {result && (
              <View style={styles.resultContainer}>
                {showResultCard && (
                  <>
                    {!result.notFound && (
                      <View style={[styles.resultHeader, { flexDirection: rtl ? "row-reverse" : "row" }]}>
                        <Text style={[styles.resultLabel, { color: colors.foreground }]}>نتيجة التحليل</Text>
                        <TouchableOpacity onPress={clearSearch}>
                          <Icon name="refresh" size={20} color={colors.mutedForeground} />
                        </TouchableOpacity>
                      </View>
                    )}
                    <AnalysisResultCard report={result} onRetry={clearSearch} />
                  </>
                )}

                {/* Multiple-dish selection UI */}
                <RefinementSuggestions
                  result={result}
                  onSelect={handleSelectDish}
                  colors={colors}
                />
              </View>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
      <AuthRequiredDialog visible={authModalVisible} onClose={() => setAuthModalVisible(false)} />
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
  title: { fontSize: 22, fontFamily: "Tajawal_700Bold", width: "100%" },
  subtitle: { fontSize: 14, fontFamily: "Tajawal_400Regular", marginBottom: 8, width: "100%" },
  content: { padding: 16, gap: 12 },
  sectionLabel: { fontSize: 13, fontFamily: "Tajawal_500Medium" },
  suggestionsWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  chipText: { fontSize: 14, fontFamily: "Tajawal_500Medium" },
  tipCard: { borderWidth: 1, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 16, gap: 8 },
  tipEmoji: { fontSize: 18 },
  tipText: { lineHeight: 24, fontFamily: "Tajawal_500Medium", fontSize: 13 },
  limitBanner: { borderRadius: 14, borderWidth: 1, padding: 16, gap: 6 },
  limitBannerTitle: { fontSize: 15, fontFamily: "Tajawal_700Bold", width: "100%" },
  limitBannerSub: { fontSize: 13, fontFamily: "Tajawal_400Regular", lineHeight: 20, width: "100%" },
  limitBannerBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10, marginTop: 4 },
  limitBannerBtnText: { color: "#fff", fontFamily: "Tajawal_700Bold", fontSize: 14 },
  resultContainer: { gap: 10 },
  resultHeader: { justifyContent: "space-between", alignItems: "center" },
  resultLabel: { fontSize: 16, fontFamily: "Tajawal_700Bold" },
});
