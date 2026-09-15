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
  Image,
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
import { isRTL } from "@/lib/i18n";
import { TayyibatiTheme } from "@/constants/tayyibatiTheme";

// Home Components
import { HomeQuickActions } from "@/components/HomeQuickActions";
import { HomePopularSearches } from "@/components/HomePopularSearches";
import { HomeSearchEducation } from "@/components/HomeSearchEducation";
import { HomeAboutSystemCard } from "@/components/HomeAboutSystemCard";
import { HomeRecentVerifications } from "@/components/HomeRecentVerifications";
import { HomeRecentAnalyses } from "@/components/HomeRecentAnalyses";

export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const rtl = isRTL();
  const topPadding = Platform.OS === "web" ? 12 : Math.max(insets.top, 12);

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

  // Dynamic time-based greeting calculation
  const currentHour = new Date().getHours();
  const isMorning = currentHour >= 4 && currentHour < 17;
  const greetingText = isMorning ? "صباح الخير" : "مساء الخير";
  const greetingIcon = isMorning ? "sun" : "moon";

  return (
    <View style={[styles.container, { backgroundColor: "#F8FEF9" }]}>
      {isAnalyzing && <LoadingOverlay message="جاري التحليل..." />}

      {/* Scrollable Content */}
      <Animated.ScrollView
        style={styles.content}
        contentContainerStyle={{ paddingBottom: 110 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Unified Botanical Header Section with Food/Nature Accents */}
        <View
          style={[
            styles.headerSection,
            {
              paddingTop: topPadding + 4,
            },
          ]}
        >
          {/* Decorative Food Assets (Salad left, Citrus/Avocado right) */}
          <View pointerEvents="none" style={StyleSheet.absoluteFill}>
            <Image
              source={require("@/assets/images/home_header_left.png")}
              style={styles.leftFoodImage}
              resizeMode="contain"
            />
            <Image
              source={require("@/assets/images/home_header_right.png")}
              style={styles.rightFoodImage}
              resizeMode="contain"
            />
          </View>

          {/* Top Bar: Profile, Official Tayyibati Logo, Notification */}
          <View style={styles.headerTop}>
            {/* Left: Profile Button */}
            <TouchableOpacity
              style={styles.profileBtn}
              onPress={() => router.push("/(tabs)/profile")}
              activeOpacity={0.8}
            >
              <Icon name="person" size={22} color="#ffffff" />
            </TouchableOpacity>

            {/* Center: Official Tayyibati Logo */}
            <View style={styles.brandContainer}>
              <Image
                source={require("@/assets/images/home_logo.png")}
                style={styles.headerLogo}
                resizeMode="contain"
              />
            </View>

            {/* Right: Notification Button with Dot */}
            <TouchableOpacity
              style={styles.notificationBtn}
              activeOpacity={0.7}
              onPress={() => {}}
            >
              <Icon name="notifications" size={22} color="#ffffff" />
              <View style={styles.notificationDot} />
            </TouchableOpacity>
          </View>

          {/* Dynamic Greeting Section */}
          <View style={styles.greetingContainer}>
            <View style={styles.greetingTopRow}>
              <Icon name={greetingIcon} size={26} color="#F59E0B" strokeWidth={2} />
              <Text style={styles.greetingTitle}>{greetingText}</Text>
            </View>
            <Text style={styles.greetingSubtitle}>
            خلّينا نتأكد من أكلك اليوم! 🌿</Text>
          </View>

          {/* Main Search Input Area */}
          <View style={styles.searchWrapper}>
            <FoodSearchInput
              query={query}
              setQuery={setQuery}
              onSearch={() => handleAnalyze()}
              onCameraPress={handleImageSearch}
              suggestions={suggestions}
              showSuggestions={showSuggestions}
              onSelectSuggestion={handleSelectSuggestion}
              isAnalyzing={isAnalyzing}
              hideCameraIcon={false}
            />
          </View>
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
          <View style={{ paddingBottom: 30 }}>
            {/* 4. Single Static Hero Banner */}
            <View style={styles.heroContainer}>
              <TouchableOpacity
                activeOpacity={0.92}
                onPress={() => router.push("/(tabs)/browse")}
                style={styles.heroBanner}
              >
                <Image
                  source={require("@/assets/images/home_hero.png")}
                  style={styles.heroImage}
                  resizeMode="cover"
                />
              </TouchableOpacity>
            </View>

            {/* 5 & 6. Two Quick Actions ("افحص طعامك", "امسح الباركود") & "تصفح الفئات" */}
            <HomeQuickActions focusSearch={() => inputRef.current?.focus()} />

            {/* 7. About Tayyibati System ("عن نظام الطيبات") */}
            <HomeAboutSystemCard />

            {/* 8. Most Searched ("الأكثر بحثاً") */}
            <HomePopularSearches
              onSelect={(q) => {
                setQuery(q);
                handleAnalyze(q);
              }}
            />

            {/* 9. Accuracy Information Card */}
            <HomeSearchEducation />

            {/* 10. Recent Verifications ("آخر عمليات التحقق") */}
            <HomeRecentVerifications />

            {/* 11. Recent Analyses ("آخر عمليات البحث") */}
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
  headerSection: {
    backgroundColor: "#F8FEF9",
    position: "relative",
    overflow: "hidden",
    paddingBottom: 6,
  },
  leftFoodImage: {
    position: "absolute",
    left: -42,
    top: 52,
    width: 155,
    height: 205,
    zIndex: 0,
    opacity: 0.55,
  },
  rightFoodImage: {
    position: "absolute",
    right: -32,
    top: 46,
    width: 145,
    height: 205,
    zIndex: 0,
    opacity: 0.55,
  },
  headerTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    zIndex: 2,
  },
  profileBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#008C5A",
    alignItems: "center",
    justifyContent: "center",
  },
  brandContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  headerLogo: {
    width: 82,
    height: 82,
  },
  notificationBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#008C5A",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  notificationDot: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: "#EF4444",
    borderWidth: 1.5,
    borderColor: "#DCFCE7",
  },
  greetingContainer: {
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
    marginBottom: 10,
    zIndex: 2,
  },
  greetingTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  greetingTitle: {
    fontSize: 26,
    fontFamily: "Tajawal_700Bold",
    color: "#11674E",
  },
  greetingSubtitle: {
    fontSize: 15,
    fontFamily: "Tajawal_500Medium",
    color: "#4B5563",
    marginTop: 3,
    textAlign: "center",
  },
  searchWrapper: {
    zIndex: 999,
    width: "100%",
    paddingHorizontal: 16,
    marginTop: 4,
    marginBottom: 6,
  },
  heroContainer: {
    marginTop: 14,
    paddingHorizontal: 16,
  },
  heroBanner: {
    width: "100%",
    aspectRatio: 992 / 488,
    borderRadius: 18,
    overflow: "hidden",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  heroImage: {
    width: "100%",
    height: "100%",
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
