import React, { useRef, useCallback, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Platform,
  Animated,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Icon } from "@/components/Icon";
import { LinearGradient } from "expo-linear-gradient";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContext";
import { LoadingOverlay } from "@/components/LoadingOverlay";
import { AnalysisResultCard } from "@/components/AnalysisResultCard";
import { FoodSearchInput } from "@/components/FoodSearchInput";
import { useFoodSearch } from "@/hooks/useFoodSearch";
import { AuthRequiredDialog } from "@/components/AuthRequiredDialog";
import { RefinementSuggestions } from "@/components/RefinementSuggestions";
import { LocalizedText } from "@/components/LocalizedText";
import { t, isRTL } from "@/lib/i18n";

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
  const topPadding = Platform.OS === "web" ? 67 : insets.top;

  const {
    query,
    setQuery,
    result,
    setResult,
    suggestions,
    showSuggestions,
    setShowSuggestions,
    authModalVisible,
    setAuthModalVisible,
    isAnalyzing,
    handleAnalyze,
    handleSelectDish,
    handleSelectSuggestion,
  } = useFoodSearch();

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

  // Show the AnalysisResultCard only when we have a final single-entity analysis.
  // MULTIPLE_DISHES stays hidden here — RefinementSuggestions renders the selection UI.
  const showResultCard =
    !!result &&
    result.resultMode !== "MULTIPLE_DISHES" &&
    !result.requiresSelection;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {isAnalyzing && <LoadingOverlay message="جاري التحليل..." />}

      {/* Header */}
      <LinearGradient
        colors={[colors.primary, colors.primary + "E0"]}
        style={[styles.header, { paddingTop: topPadding + 12, zIndex: 10 }]}
      >
        <View style={[{ flexDirection: isRTL() ? "row-reverse" : "row" }, styles.headerTop]}>
          <TouchableOpacity
            style={[
              styles.profileBtn,
              { backgroundColor: "rgba(255,255,255,0.2)" },
              isRTL() ? { marginLeft: 12 } : { marginRight: 12 },
            ]}
            onPress={() => router.push("/(tabs)/profile")}
          >
            <Icon name={user ? "person" : "person-outline"} size={20} color="#fff" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <LocalizedText
              style={[styles.appName, { textAlign: isRTL() ? "right" : "left" }]}
            >
              {t("home.appName")}
            </LocalizedText>
            <LocalizedText
              style={[styles.appSub, { textAlign: isRTL() ? "right" : "left" }]}
            >
              {t("home.appSub")}
            </LocalizedText>
          </View>
        </View>
      </LinearGradient>

      {/* Scrollable content */}
      <Animated.ScrollView
        style={styles.content}
        contentContainerStyle={{ paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      >
        <LocalizedText
          style={[
            styles.greeting,
            { color: colors.foreground, width: "100%", textAlign: isRTL() ? "right" : "left" },
          ]}
        >
          {t("home.greeting")}
        </LocalizedText>

        {/* Search bar */}
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

        {/* Results area */}
        {result ? (
          <View style={{ padding: 16 }}>
            {/* Clear button */}
            <View
              style={[
                { flexDirection: isRTL() ? "row-reverse" : "row" },
                styles.resultHeader,
              ]}
            >
              <TouchableOpacity
                onPress={clearSearch}
                style={[styles.clearBtn, { backgroundColor: colors.muted }]}
              >
                <Icon name="close" size={14} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>

            {/* Single-entity analysis result */}
            {showResultCard && (
              <>
                <AnalysisResultCard report={result} onRetry={clearSearch} />
              </>
            )}

            {/* Multiple-dish selection OR text refinement suggestions */}
            <RefinementSuggestions
              result={result}
              onSelect={handleSelectDish}
              colors={colors}
            />
          </View>
        ) : (
          /* Dashboard — shown only while no result */
          <View style={{ paddingBottom: 120 }}>
            <HomeImageActions />
            <HomeQuickActions focusSearch={() => inputRef.current?.focus()} />
            <HomePopularSearches
              onSelect={(q) => {
                setQuery(q);
                handleAnalyze(q);
              }}
            />
            <HomeSearchEducation />
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
  container: { flex: 1 },
  content: { flex: 1 },
  greeting: {
    fontSize: 20,
    fontFamily: "Tajawal_700Bold",
    marginHorizontal: 16,
    marginVertical: 12,
  },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 20,
    gap: 14,
  },
  headerTop: {
    alignItems: "center",
    justifyContent: "space-between",
  },
  appName: {
    fontSize: 30,
    fontFamily: "Tajawal_700Bold",
    color: "#fff",
    textAlign: "center",
  },
  appSub: {
    fontSize: 14,
    fontFamily: "Tajawal_400Regular",
    color: "rgba(255,255,255,0.75)",
    textAlign: "center",
  },
  profileBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  resultHeader: {
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  clearBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
});
