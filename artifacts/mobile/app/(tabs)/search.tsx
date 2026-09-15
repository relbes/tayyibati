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
import { BackButton } from "@/components/BackButton";
import { PageHeader } from "@/components/PageHeader";
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
  const topPadding = Platform.OS === "web" ? 16 : Math.max(insets.top, 12);
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
    <View style={styles.container}>
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
          {/* Standardized Botanical Header */}
          <PageHeader
            title="بحث عن طعام"
            subtitle="أدخل اسم الطعام أو الوجبة أو المنتج"
            badgeType="search"
          />

          <View style={[styles.header, { paddingTop: 0 }]}>
            <View style={styles.searchInputWrapper}>
              <FoodSearchInput
                query={query}
                setQuery={setQuery}
                onSearch={handleAnalyze}
                onCameraPress={handleImageSearch}
                suggestions={suggestions}
                showSuggestions={showSuggestions}
                onSelectSuggestion={handleSelectSuggestion}
                isAnalyzing={isAnalyzing}
                hideCameraIcon={true}
              />
            </View>
          </View>

          <View style={styles.content}>
            {/* Usage warnings */}
            {!limitReached && <UsageWarningBanner type="text" />}

            {limitReached && (
              <View style={styles.limitBanner}>
                <Text
                  style={[
                    styles.limitBannerTitle,
                    { textAlign: rtl ? "right" : "left" },
                  ]}
                >
                  لقد انتهت محاولاتك المتاحة حالياً
                </Text>
                <Text
                  style={[
                    styles.limitBannerSub,
                    { textAlign: rtl ? "right" : "left" },
                  ]}
                >
                  قم بالترقية إلى الباقة المميزة للاستمرار في استخدام التحليل والبحث.
                </Text>
                <TouchableOpacity
                  style={[
                    styles.limitBannerBtn,
                    { alignSelf: rtl ? "flex-start" : "flex-end" },
                  ]}
                  onPress={() => router.push("/pricing")}
                  activeOpacity={0.8}
                >
                  <Text style={styles.limitBannerBtnText}>اشترك الآن</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Search tip + quick chips — only when idle */}
            {!result && !limitReached && (
              <View
                style={[
                  styles.tipCard,
                  { flexDirection: rtl ? "row-reverse" : "row" },
                ]}
              >
                <View style={styles.tipIconBox}>
                  <Icon name="bulb" size={18} color="#008C5A" />
                </View>
                <Text
                  style={[
                    styles.tipText,
                    { textAlign: rtl ? "right" : "left" },
                  ]}
                >
                  للحصول على نتائج دقيقة، اكتب اسم المادة بوضوح باللغة العربية أو الإنجليزية
                </Text>
              </View>
            )}

            {!result && !query.trim() && (
              <View style={styles.suggestionsSection}>
                <View
                  style={[
                    styles.sectionHeaderRow,
                    { flexDirection: rtl ? "row-reverse" : "row" },
                  ]}
                >
                  <View style={styles.sectionDot} />
                  <Text
                    style={[
                      styles.sectionLabel,
                      { textAlign: rtl ? "right" : "left" },
                    ]}
                  >
                    اقتراحات سريعة
                  </Text>
                </View>

                <View
                  style={[
                    styles.suggestionsWrap,
                    { justifyContent: rtl ? "flex-end" : "flex-start" },
                  ]}
                >
                  {QUICK_SUGGESTIONS.map((s) => (
                    <TouchableOpacity
                      key={s}
                      style={styles.chip}
                      onPress={() => {
                        setQuery(s);
                        handleAnalyze(s);
                      }}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.chipText}>{s}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {/* Results */}
            {result && (
              <View style={styles.resultContainer}>
                {showResultCard && (
                  <>
                    {!result.notFound && (
                      <View
                        style={[
                          styles.resultHeader,
                          { flexDirection: rtl ? "row-reverse" : "row" },
                        ]}
                      >
                        <Text style={styles.resultLabel}>نتيجة التحليل</Text>
                        <TouchableOpacity
                          onPress={clearSearch}
                          style={styles.refreshBtn}
                          activeOpacity={0.7}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Icon name="refresh" size={18} color="#008C5A" />
                        </TouchableOpacity>
                      </View>
                    )}
                    <AnalysisResultCard
                      report={result}
                      onRetry={clearSearch}
                      onGoHome={() => {
                        clearSearch();
                        try {
                          router.dismissTo("/(tabs)");
                        } catch {
                          router.navigate("/(tabs)");
                        }
                      }}
                      onSelectSuggestion={(text) => {
                        setQuery(text);
                        handleAnalyze(text);
                      }}
                      isAnalyzing={isAnalyzing}
                    />
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
  container: {
    flex: 1,
    backgroundColor: "#F8FEF9",
  },
  scroll: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    backgroundColor: "#F8FEF9",
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  titleRow: {
    alignItems: "center",
    gap: 12,
  },
  titleTextBox: {
    flex: 1,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#DCFCE7",
    borderColor: "#DCFCE7",
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 24,
    fontFamily: "Tajawal_700Bold",
    color: "#11674E",
  },
  subtitle: {
    fontSize: 13.5,
    fontFamily: "Tajawal_500Medium",
    color: "#4B5563",
    marginTop: 2,
    lineHeight: 19,
  },
  searchInputWrapper: {
    marginTop: 14,
    zIndex: 999,
  },
  content: {
    padding: 16,
    gap: 14,
  },
  tipCard: {
    backgroundColor: "#F0FDF4",
    borderWidth: 1,
    borderColor: "#DCFCE7",
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignItems: "center",
    gap: 10,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 4,
    elevation: 1,
  },
  tipIconBox: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#DCFCE7",
    alignItems: "center",
    justifyContent: "center",
  },
  tipText: {
    flex: 1,
    fontSize: 13.5,
    fontFamily: "Tajawal_500Medium",
    color: "#166534",
    lineHeight: 20,
  },
  suggestionsSection: {
    marginTop: 4,
    gap: 10,
  },
  sectionHeaderRow: {
    alignItems: "center",
    gap: 6,
  },
  sectionDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#008C5A",
  },
  sectionLabel: {
    fontSize: 14,
    fontFamily: "Tajawal_700Bold",
    color: "#11674E",
  },
  suggestionsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#DCFCE7",
    backgroundColor: "#FFFFFF",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 3,
    elevation: 1,
  },
  chipText: {
    fontSize: 13.5,
    fontFamily: "Tajawal_500Medium",
    color: "#15803D",
  },
  limitBanner: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#FECDD3",
    backgroundColor: "#FEF2F2",
    padding: 16,
    gap: 6,
  },
  limitBannerTitle: {
    fontSize: 15.5,
    fontFamily: "Tajawal_700Bold",
    color: "#DC2626",
    width: "100%",
  },
  limitBannerSub: {
    fontSize: 13.5,
    fontFamily: "Tajawal_400Regular",
    color: "#4B5563",
    lineHeight: 20,
    width: "100%",
  },
  limitBannerBtn: {
    backgroundColor: "#16A34A",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    marginTop: 4,
  },
  limitBannerBtnText: {
    color: "#FFFFFF",
    fontFamily: "Tajawal_700Bold",
    fontSize: 14,
  },
  resultContainer: {
    gap: 12,
  },
  resultHeader: {
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 2,
  },
  resultLabel: {
    fontSize: 18,
    fontFamily: "Tajawal_700Bold",
    color: "#11674E",
  },
  refreshBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#DCFCE7",
    borderWidth: 1,
    borderColor: "#DCFCE7",
    alignItems: "center",
    justifyContent: "center",
  },
});
