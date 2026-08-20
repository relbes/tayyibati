import React, { useRef, useCallback, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Platform,
  Animated,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Icon } from "@/components/Icon";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContext";
import { LoadingOverlay } from "@/components/LoadingOverlay";
import { AnalysisResultCard } from "@/components/AnalysisResultCard";
import { FoodSearchInput } from "@/components/FoodSearchInput";
import { useFoodSearch } from "@/hooks/useFoodSearch";
import { AuthRequiredDialog } from "@/components/AuthRequiredDialog";
import { RefinementSuggestions } from "@/components/RefinementSuggestions";
import { LocalizedText } from "@/components/LocalizedText";
import { HeaderNatureBackground } from "@/components/HeaderNatureBackground";
import { t, isRTL } from "@/lib/i18n";
import { TayyibatiTheme } from "@/constants/tayyibatiTheme";

// Home Components
import { HomeImageActions } from "@/components/HomeImageActions";
import { HomeQuickActions } from "@/components/HomeQuickActions";
import { HomePopularSearches } from "@/components/HomePopularSearches";
import { HomeSearchEducation } from "@/components/HomeSearchEducation";
import { HomeRecentAnalyses } from "@/components/HomeRecentAnalyses";

export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const rtl = isRTL();
  const topPadding = Platform.OS === "web" ? 18 : Math.max(insets.top + 6, 18);

  const {
    query,
    setQuery,
    result,
    setResult,
    suggestions,
    showSuggestions,
    setShowSuggestions,
    limitReached,
    authModalVisible,
    setAuthModalVisible,
    isAnalyzing,
    handleAnalyze,
    handleSelectDish,
    handleSelectSuggestion,
  } = useFoodSearch();

  useEffect(() => {
    if (limitReached) {
      Alert.alert(
        "انتهت محاولاتك المتاحة",
        "لقد وصلت إلى الحد المسموح لك حالياً. قم بالترقية إلى الباقة المميزة للاستمرار في استخدام Tayyibati.",
        [
          { text: "لاحقاً", style: "cancel" },
          {
            text: "الترقية إلى الباقة المميزة",
            onPress: () => router.push("/pricing"),
          },
        ]
      );
    }
  }, [limitReached, router]);

  const inputRef = useRef<TextInput>(null);
  const cardAnim = useRef(new Animated.Value(0)).current;

  const handleImageSearch = useCallback(() => {
    router.push("/(tabs)/camera");
  }, [router]);

  const clearSearch = useCallback(() => {
    setQuery("");
    setResult(null);
    setShowSuggestions(false);
  }, [setQuery, setResult, setShowSuggestions]);

  const handleSelectClarificationSuggestion = useCallback(
    (label: string) => {
      setQuery(label);
      handleAnalyze(label);
    },
    [setQuery, handleAnalyze]
  );

  useEffect(() => {
    if (result) {
      Animated.spring(cardAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 60,
        friction: 8,
      }).start();
    } else {
      cardAnim.setValue(0);
    }
  }, [result]);

  const showResultCard =
    !!result &&
    result.resultMode !== "MULTIPLE_DISHES" &&
    !result.requiresSelection;

  return (
    <View style={[styles.container, { backgroundColor: TayyibatiTheme.colors.background }]}>
      {isAnalyzing && <LoadingOverlay message="جاري التحليل..." />}

      {/* 1. Light Premium Header / Tayyibati Branding */}
      <View
        style={[
          styles.lightHeader,
          {
            paddingTop: topPadding + 10,
            backgroundColor: "#11674e",
            borderBottomColor: "#0D523E",
          },
        ]}
      >
        <HeaderNatureBackground />

        <View style={[{ flexDirection: rtl ? "row-reverse" : "row" }, styles.headerTop]}>
          <TouchableOpacity
            style={[
              styles.profileBtn,
              {
                backgroundColor: "rgba(255, 255, 255, 0.15)",
                borderColor: "rgba(243, 246, 244, 0.3)",
              },
            ]}
            onPress={() => router.push("/(tabs)/profile")}
            activeOpacity={0.8}
          >
            <Icon name={user ? "person" : "person-outline"} size={20} color="#f3f6f4" />
          </TouchableOpacity>

          <View style={styles.brandContainer}>
            <View style={[{ flexDirection: rtl ? "row-reverse" : "row" }, styles.brandTitleRow]}>
              <LocalizedText style={styles.appName}>
                {t("home.appName")}
              </LocalizedText>
              <View style={styles.leafDot}>
                <Icon name="leaf" size={14} color="#f3f6f4" />
              </View>
            </View>

            <LocalizedText style={styles.appSub}>
              {t("home.appSub")}
            </LocalizedText>
          </View>

          {/* Balance spacer for perfect centering */}
          <View style={{ width: 42 }} />
        </View>
      </View>

      {/* Scrollable Content */}
      <Animated.ScrollView
        style={styles.content}
        contentContainerStyle={{ paddingBottom: 120, paddingTop: 14 }}
        showsVerticalScrollIndicator={false}
      >
        {/* 2. Main Search Input Area */}
        <View style={{ zIndex: 999, width: "100%", paddingHorizontal: 16 }}>
          <FoodSearchInput
            query={query}
            setQuery={setQuery}
            onSearch={() => handleAnalyze()}
            onCameraPress={handleImageSearch}
            suggestions={suggestions}
            showSuggestions={showSuggestions}
            onSelectSuggestion={handleSelectSuggestion}
            isAnalyzing={isAnalyzing}
            hideCameraIcon={true}
          />
        </View>

        {/* Results area or Dashboard */}
        {result ? (
          <View style={{ paddingHorizontal: 16, paddingTop: 10, paddingBottom: 16 }}>
            {/* Clear button */}
            <View
              style={[
                { flexDirection: rtl ? "row-reverse" : "row", marginBottom: 8 },
                styles.resultHeader,
              ]}
            >
              <TouchableOpacity
                onPress={clearSearch}
                style={[styles.clearBtn, { backgroundColor: colors.muted }]}
              >
                <Icon name="close" size={14} color={colors.mutedForeground} />
                <Text style={{ fontSize: 13, color: colors.mutedForeground, fontFamily: "Tajawal_500Medium" }}>
                  مسح التحليل
                </Text>
              </TouchableOpacity>
            </View>

            {/* Single-entity analysis result */}
            {showResultCard && (
              <AnalysisResultCard
                report={result}
                onRetry={clearSearch}
                onGoHome={clearSearch}
                onSelectSuggestion={handleSelectClarificationSuggestion}
                isAnalyzing={isAnalyzing}
              />
            )}

            {/* Multiple-dish selection OR text refinement suggestions */}
            <RefinementSuggestions
              result={result}
              onSelect={handleSelectDish}
              colors={colors}
            />
          </View>
        ) : (
          /* Dashboard — shown only while no search result active */
          <View style={{ paddingBottom: 60 }}>
            {/* 3. Small Joyful & Lightweight Hero Card */}
            <View style={styles.heroContainer}>
              <View
                style={[
                  styles.heroCard,
                  {
                    backgroundColor: TayyibatiTheme.colors.heroCardBg,
                    borderColor: TayyibatiTheme.colors.heroCardBorder,
                    flexDirection: rtl ? "row-reverse" : "row",
                  },
                ]}
              >
                {/* Decorative background shapes */}
                <View style={styles.heroDecorCircle} />
                <View style={styles.heroDecorCircleSmall} />

                {/* Joyful Multi-Icon Visual Badge */}
                <View style={styles.heroVisualCluster}>
                  <View style={styles.heroIconBadge}>
                    <Icon name="leaf" size={20} color={TayyibatiTheme.colors.primary} />
                  </View>
                  <View style={styles.heroHeartDot}>
                    <Icon name="heart" size={10} color={TayyibatiTheme.colors.orange} />
                  </View>
                </View>

                <View style={{ flex: 1, zIndex: 2 }}>
                  <Text style={[styles.heroTitle, { textAlign: rtl ? "right" : "left" }]}>
                    اختيارك اليوم يصنع فرقاً
                  </Text>
                  <Text style={[styles.heroSubtitle, { textAlign: rtl ? "right" : "left" }]}>
                    تحقق من طعامك بسهولة قبل تناوله
                  </Text>
                </View>
              </View>
            </View>

            {/* 4. Colorful Quick Actions ("طرق سريعة للتحقق") */}
            <HomeQuickActions focusSearch={() => inputRef.current?.focus()} />

            {/* 5. Colorful Image Verification Card ("تحقق باستخدام صورة") */}
            <HomeImageActions />

            {/* 6. Popular Searches Pills */}
            <HomePopularSearches
              onSelect={(q) => {
                setQuery(q);
                handleAnalyze(q);
              }}
            />

            {/* 7. Soft Search Education Card */}
            <HomeSearchEducation />

            {/* 8. Recent Analysis History Rows */}
            <HomeRecentAnalyses />
          </View>
        )}
      </Animated.ScrollView>

      <AuthRequiredDialog
        visible={authModalVisible}
        onClose={() => setAuthModalVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  lightHeader: {
    paddingHorizontal: 16,
    paddingBottom: 20,
    borderBottomWidth: 1,
    position: "relative",
    overflow: "hidden",
  },
  headerDecorCircleRight: {
    position: "absolute",
    right: -20,
    top: -20,
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: TayyibatiTheme.colors.primary + "12",
  },
  headerDecorCircleLeft: {
    position: "absolute",
    left: -15,
    bottom: -15,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: TayyibatiTheme.colors.orange + "0F",
  },
  headerTop: {
    alignItems: "center",
    justifyContent: "space-between",
    zIndex: 2,
  },
  profileBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    ...TayyibatiTheme.shadows.card,
  },
  brandContainer: {
    flex: 1,
    alignItems: "center",
  },
  brandTitleRow: {
    alignItems: "center",
    gap: 4,
  },
  leafDot: {
    marginTop: 2,
  },
  appName: {
    fontSize: 32,
    fontFamily: TayyibatiTheme.typography.fontFamily.bold,
    color: "#f3f6f4",
    textAlign: "center",
  },
  appSub: {
    fontSize: 15.5,
    fontFamily: TayyibatiTheme.typography.fontFamily.medium,
    color: "#E2E8F0",
    textAlign: "center",
    width: "100%",
    marginTop: 2,
  },
  heroContainer: {
    marginTop: 14,
    paddingHorizontal: 16,
  },
  heroCard: {
    paddingVertical: 13,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: "center",
    gap: 12,
    position: "relative",
    overflow: "hidden",
    ...TayyibatiTheme.shadows.card,
  },
  heroDecorCircle: {
    position: "absolute",
    right: -25,
    top: -25,
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: TayyibatiTheme.colors.orange + "14",
  },
  heroDecorCircleSmall: {
    position: "absolute",
    left: -15,
    bottom: -20,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: TayyibatiTheme.colors.primary + "10",
  },
  heroVisualCluster: {
    position: "relative",
    zIndex: 2,
  },
  heroIconBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: TayyibatiTheme.colors.white,
    alignItems: "center",
    justifyContent: "center",
    ...TayyibatiTheme.shadows.card,
  },
  heroHeartDot: {
    position: "absolute",
    top: -2,
    right: -3,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#FFF3D6",
    borderWidth: 1.5,
    borderColor: TayyibatiTheme.colors.white,
    alignItems: "center",
    justifyContent: "center",
  },
  heroTitle: {
    fontSize: TayyibatiTheme.typography.size.md,
    fontFamily: TayyibatiTheme.typography.fontFamily.bold,
    color: "#15803D",
  },
  heroSubtitle: {
    fontSize: TayyibatiTheme.typography.size.sm - 1,
    fontFamily: TayyibatiTheme.typography.fontFamily.regular,
    color: "#4B5563",
    marginTop: 5,
  },
  resultHeader: {
    alignItems: "center",
    justifyContent: "flex-end",
    marginBottom: 8,
  },
  clearBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: TayyibatiTheme.radius.small,
  },
});
