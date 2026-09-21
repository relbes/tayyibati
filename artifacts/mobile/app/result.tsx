import React, { useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Icon } from "@/components/Icon";
import { BackButton } from "@/components/BackButton";
import { PageHeader } from "@/components/PageHeader";
import { ResultTabBar } from "@/components/result/ResultTabBar";
import { useColors } from "@/hooks/useColors";
import { TayyibatiTheme } from "@/constants/tayyibatiTheme";
import { useAnalysis } from "@/context/AnalysisContext";
import { AnalysisResultCard } from "@/components/AnalysisResultCard";
import { analyzeText, AnalysisError, NetworkError } from "@/lib/api";
import { useSubscription } from "@/lib/revenuecat";
import { SubscriptionNoticeBanner } from "@/components/SubscriptionNoticeBanner";

export default function ResultScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { hasBillingIssue } = useSubscription();
  const { currentReport, setCurrentReport, isAnalyzing, setIsAnalyzing } = useAnalysis();
  const topPadding = Platform.OS === "web" ? 67 : insets.top;
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [currentReport]);

  const handleSelectSuggestion = async (food: string) => {
    if (isAnalyzing) return;
    setIsAnalyzing(true);
    try {
      const report = await analyzeText(food);
      setCurrentReport(report);
    } catch (err) {
      if (err instanceof NetworkError || (err as any)?.isNetworkError) {
        Alert.alert("خطأ في الاتصال", (err as Error).message);
      } else if (err instanceof AnalysisError && err.limitReached) {
        Alert.alert("تنبيه", "لقد انتهت محاولاتك المتاحة حالياً.\nقم بالترقية إلى الباقة المميزة للاستمرار في استخدام التحليل والبحث.", [
          { text: "لاحقاً", style: "cancel" },
          { text: "الترقية", onPress: () => router.push("/pricing") },
        ]);
      } else {
        Alert.alert("خطأ", "فشل التحليل. حاول مجدداً.");
      }
    } finally {
      setIsAnalyzing(false);
    }
  };

  if (!currentReport) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: colors.background }]}>
        <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>لا يوجد نتائج</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={[styles.backLink, { color: colors.primary }]}>العودة</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Derive contextual header values based on report data
  const foodName =
    (currentReport as any).displayQuery ||
    currentReport.query ||
    currentReport.primaryRuling?.nameAr ||
    (currentReport.canonicalResult as any)?.canonical_name ||
    (currentReport.canonicalResult as any)?.canonicalName ||
    "مأكولات ومشروبات";

  const analysisType = currentReport.analysisType || "text";
  const inputType =
    analysisType === "image" || (currentReport as any).inputType === "camera"
      ? "camera"
      : "text";

  const isBarcode = (analysisType as string) === "barcode" || analysisType === "label";
  const isImage = analysisType === "image" || inputType === "camera";

  const headerTitle = isBarcode
    ? "نتيجة المسح"
    : isImage
    ? "نتيجة التحليل"
    : "نتيجة البحث";

  const headerSubtitle = foodName;

  const methodBadgeText = isBarcode
    ? "مسح بالباركود"
    : isImage
    ? "تحليل بالصورة"
    : "بحث عن طعام";

  const methodBadgeIcon = isBarcode
    ? "barcode-outline"
    : isImage
    ? "camera-outline"
    : "search-outline";

  const centerIconType: "search" | "camera" | "barcode" | "food" = isBarcode
    ? "barcode"
    : isImage
    ? "camera"
    : "search";

  const activeTab: "index" | "search" | "camera" | "history" | "profile" = isImage
    ? "camera"
    : "search";

  const handleRetry = () => {
    try {
      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace("/(tabs)");
      }
    } catch {
      router.replace("/(tabs)");
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: "#FAFAF8" }]}>
      {/* Scrollable Body Content with Unified Master PageHeader */}
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={{ paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Standardized Botanical Header (Master Tayyibati PageHeader identical to Search) */}
        <PageHeader
          title="تحليل المكونات"
          subtitle={foodName}
          badgeType="result"
          onRetry={handleRetry}
          onBackPress={() => {
            try {
              if (router.canGoBack()) {
                router.back();
              } else {
                router.replace("/(tabs)");
              }
            } catch {
              router.replace("/(tabs)");
            }
          }}
        />

        <View style={{ paddingHorizontal: 16, paddingTop: 10, gap: 12 }}>
          <AnalysisResultCard
            report={currentReport}
            onRetry={handleRetry}
            onGoHome={() => {
              try {
                router.dismissTo("/(tabs)");
              } catch {
                router.replace("/(tabs)");
              }
            }}
            onSelectSuggestion={handleSelectSuggestion}
            isAnalyzing={isAnalyzing}
          />
        </View>
      </ScrollView>

      {/* 3. Subscription Renewal Notice Banner (Arabic, RTL, lightweight in-app banner) */}
      {hasBillingIssue && (
        <SubscriptionNoticeBanner style={{ marginBottom: 4 }} />
      )}

      {/* 4. Bottom 5-Tab Navigation Bar matching design */}
      <ResultTabBar activeTab={activeTab} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { alignItems: "center", justifyContent: "center" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 26,
    fontFamily: "Tajawal_700Bold",
    textAlign: "center",
  },
  emptyText: {
    fontSize: 16,
    fontFamily: "Tajawal_400Regular",
  },
  backLink: {
    fontSize: 15,
    fontFamily: "Tajawal_700Bold",
    marginTop: 12,
  },
});
