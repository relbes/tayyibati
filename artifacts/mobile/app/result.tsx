import React from "react";
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
import { useColors } from "@/hooks/useColors";
import { useAnalysis } from "@/context/AnalysisContext";
import { AnalysisResultCard } from "@/components/AnalysisResultCard";
import { analyzeText, AnalysisError, NetworkError } from "@/lib/api";

export default function ResultScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { currentReport, setCurrentReport, isAnalyzing, setIsAnalyzing } = useAnalysis();
  const topPadding = Platform.OS === "web" ? 67 : insets.top;

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
        Alert.alert("انتهى الحد المجاني", (err as AnalysisError).message, [
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

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPadding + 8, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Icon name="arrow-back" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.foreground }]}>نتيجة التحليل</Text>
        <View style={{ width: 36 }} />
      </View>
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 60 }}
        showsVerticalScrollIndicator={false}
      >
        <AnalysisResultCard
          report={currentReport}
          onRetry={() => {
            try {
              router.dismissTo("/(tabs)");
            } catch {
              router.replace("/(tabs)");
            }
          }}
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
      </ScrollView>
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
    fontSize: 18,
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
