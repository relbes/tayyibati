import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, LayoutAnimation, Platform, UIManager, ActivityIndicator } from "react-native";
import { Icon } from "@/components/Icon";
import { useColors } from "@/hooks/useColors";
import type { AnalysisReport } from "@/context/AnalysisContext";
import { AnalysisResultViewModel, createAnalysisResultViewModel } from "@/lib/models/AnalysisResultViewModel";
import { useDeveloperMode } from "@/context/DeveloperModeContext";
import { ResultStatusCard } from "./result/ResultStatusCard";
import { StatisticCard } from "./result/StatisticCard";
import { IngredientSection } from "./result/IngredientSection";
import { UnresolvedSection } from "./result/UnresolvedSection";
import { ResultActionButtons } from "./result/ResultActionButtons";
import { EmptyAnalysisState } from "./result/EmptyAnalysisState";
import { FoodFamilyResultCard } from "./result/FoodFamilyResultCard";

import { useRouter } from "expo-router";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface AnalysisResultCardProps {
  report?: AnalysisReport | null;
  viewModel?: AnalysisResultViewModel | null;
  onRetry?: () => void;
  onGoHome?: () => void;
  onShare?: () => void;
  onSelectSuggestion?: (queryText: string) => void;
  isAnalyzing?: boolean;
}

export function AnalysisResultCard({
  report,
  viewModel: inputViewModel,
  onRetry,
  onGoHome,
  onShare,
  onSelectSuggestion,
  isAnalyzing = false,
}: AnalysisResultCardProps) {
  const colors = useColors();
  const router = useRouter();
  const { isDevMode } = useDeveloperMode();
  const [showDevDetails, setShowDevDetails] = useState<boolean>(false);
  const [selectedSuggestion, setSelectedSuggestion] = useState<string | null>(null);

  const handleGoHome = React.useCallback(() => {
    if (onGoHome) {
      onGoHome();
      return;
    }
    try {
      router.dismissTo("/(tabs)");
    } catch {
      try {
        router.replace("/(tabs)");
      } catch {
        router.navigate("/(tabs)");
      }
    }
  }, [onGoHome, router]);

  // Emojis mapping for specificities
  const SPECIFICITY_EMOJIS: Record<string, string> = {
    LAMB: "🐑",
    BEEF: "🐄",
    BUFFALO: "🐃",
    CAMEL: "🐪",
    PIGEON: "🕊️",
    QUAIL: "🐦",
    CHICKEN: "🐔",
    DUCK: "🦆",
    TURKEY: "🦃",
    OSTRICH: "🦩",
  };

  // Subtitles mapping for specificities conforming to Tayyibati guidelines
  const SPECIFICITY_SUBTITLES: Record<string, string> = {
    LAMB: "الخيار الأول والمفضل بمعدل مرتين أسبوعياً",
    BEEF: "مسموح بشرط أن يكون بلديًا ومغذى طبيعيًا (بمعدل مرة أسبوعياً)",
    BUFFALO: "مسموح بشرط أن يكون بلديًا ومغذى طبيعيًا (بمعدل مرة أسبوعياً)",
    CAMEL: "مسموح بشرط أن يكون بلديًا ومغذى طبيعيًا (بمعدل مرة أسبوعياً)",
    PIGEON: "مسموح (الطيور البرية وغير التجارية مسموحة)",
    QUAIL: "مسموح (الطيور البرية وغير التجارية مسموحة)",
    CHICKEN: "ممنوع (الدجاج التجاري ممنوع في نظام طيباتي)",
    DUCK: "ممنوع (البط التجاري ممنوع في نظام طيباتي)",
    TURKEY: "ممنوع (الديك الرومي التجاري ممنوع في نظام طيباتي)",
    OSTRICH: "ممنوع (النعام التجاري ممنوع في نظام طيباتي)",
  };

  const getSuggestionEmoji = (spec?: string, label?: string): string => {
    if (spec && SPECIFICITY_EMOJIS[spec]) {
      return SPECIFICITY_EMOJIS[spec];
    }
    const text = (label || "").toLowerCase();
    if (text.includes("دجاج") || text.includes("طيور") || text.includes("دواجن")) return "🍗";
    if (text.includes("لحم") || text.includes("بقر") || text.includes("غنم") || text.includes("ضأن") || text.includes("عجل")) return "🥩";
    if (text.includes("سمك") || text.includes("جمبري") || text.includes("روبيان") || text.includes("بحري")) return "🐟";
    if (text.includes("أرز") || text.includes("رز")) return "🍚";
    if (text.includes("حليب") || text.includes("لبن") || text.includes("جبن") || text.includes("قشطة")) return "🥛";
    if (text.includes("خضار") || text.includes("سلطة")) return "🥗";
    if (text.includes("شوربة") || text.includes("حساء")) return "🥣";
    if (text.includes("خبز") || text.includes("معجنات")) return "🍞";
    if (text.includes("فاكهة") || text.includes("فواكه")) return "🍎";
    return "🍲";
  };

  // Handle Clarification Requests
  if (report?.needsClarification) {
    const question = report.questionAr || "أحتاج تحديد النوع حتى أعطيك نتيجة دقيقة";
    const suggestions = report.suggestions || [];

    const handleSelect = (label: string) => {
      if (isAnalyzing) return;
      setSelectedSuggestion(label);
      if (onSelectSuggestion) {
        onSelectSuggestion(label);
      }
    };

    return (
      <View style={[styles.clarificationCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.clarificationHeader}>
          <View style={[styles.clarificationIconContainer, { backgroundColor: colors.primary + "15" }]}>
            <Icon name="help-circle-outline" size={28} color={colors.primary} />
          </View>
          <Text style={[styles.clarificationQuestion, { color: colors.foreground }]}>
            {question}
          </Text>
          <Text style={[styles.clarificationSubtitle, { color: colors.mutedForeground }]}>
            اختر النوع للحصول على تحليل أدق
          </Text>
        </View>

        <View style={styles.suggestionsList}>
          {suggestions.map((sug, idx) => {
            const isObj = typeof sug === "object" && sug !== null && "label" in sug;
            const label = isObj ? (sug as any).label : String(sug);
            const spec = isObj ? (sug as any).proteinSpecificity || "" : "";
            const emoji = getSuggestionEmoji(spec, label);
            const subtitle = SPECIFICITY_SUBTITLES[spec] || "";
            const isThisLoading = isAnalyzing && selectedSuggestion === label;

            return (
              <TouchableOpacity
                key={`${label}_${idx}`}
                style={[
                  styles.suggestionButton,
                  {
                    backgroundColor: colors.secondary,
                    borderColor: colors.border,
                    opacity: isAnalyzing && selectedSuggestion !== label ? 0.6 : 1,
                  },
                ]}
                onPress={() => handleSelect(label)}
                disabled={isAnalyzing}
                activeOpacity={0.7}
              >
                <View style={styles.suggestionRightPart}>
                  <Text style={styles.suggestionEmoji}>{emoji}</Text>
                  <View style={styles.suggestionTextContainer}>
                    <Text style={[styles.suggestionLabel, { color: colors.foreground }]}>
                      {label}
                    </Text>
                    {subtitle ? (
                      <Text style={[styles.suggestionSub, { color: colors.mutedForeground }]}>
                        {subtitle}
                      </Text>
                    ) : null}
                  </View>
                </View>
                {isThisLoading ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <Icon
                    name="chevron-back"
                    size={18}
                    color={colors.mutedForeground}
                  />
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    );
  }

  // Construct or use unified ViewModel
  const viewModel: AnalysisResultViewModel | null = inputViewModel
    ? inputViewModel
    : report
    ? createAnalysisResultViewModel(report)
    : null;

  if (!viewModel) return null;

  // Handle GENERIC_FOOD_FAMILY Presentation Mode (Category Searches e.g. "تمر", "خبز", "أرز")
  if (viewModel.presentationMode === "GENERIC_FOOD_FAMILY" && viewModel.familyViewModel) {
    return (
      <View style={styles.container}>
        <FoodFamilyResultCard
          viewModel={viewModel.familyViewModel}
          onRetry={onRetry}
          onGoHome={handleGoHome}
        />
        <ResultActionButtons
          onRetry={onRetry}
          onGoHome={handleGoHome}
          onShare={onShare}
          isPremium={true}
        />
      </View>
    );
  }

  const { inputType, recognizedName, ingredientDecisions, mealDecision, canonicalResult, analysis } = viewModel;

  // Handle Empty Analysis State via presentation props
  if (!ingredientDecisions || ingredientDecisions.length === 0) {
    return (
      <EmptyAnalysisState
        title="لم يكتمل التحليل"
        message="لم نتمكن من اكتشاف مكونات في هذه الوجبة. يرجى التأكد من اسم الوجبة أو الصورة وإعادة المحاولة."
        retryLabel="إعادة المحاولة"
        onRetry={onRetry || (() => {})}
        iconName="search-outline"
      />
    );
  }

  const finalStatus: "allowed" | "forbidden" | "conditional" | "unknown" =
    mealDecision?.status || "unknown";

  // Group ingredient decisions into categories
  const forbiddenIngredients = ingredientDecisions.filter((i) => i.status === "forbidden");
  const conditionalIngredients = ingredientDecisions.filter((i) => i.status === "conditional");
  const allowedIngredients = ingredientDecisions.filter((i) => i.status === "allowed");
  const unresolvedInputs = ingredientDecisions
    .filter((i) => i.status === "unknown")
    .map((i) => i.input);

  // Statistics Object
  const statistics = {
    totalIngredients: ingredientDecisions.length,
    allowedCount: mealDecision?.allowedCount ?? allowedIngredients.length,
    forbiddenCount: mealDecision?.forbiddenCount ?? forbiddenIngredients.length,
    conditionalCount: mealDecision?.conditionalCount ?? conditionalIngredients.length,
    unresolvedCount: mealDecision?.unknownCount ?? unresolvedInputs.length,
  };

  const toggleDevDetails = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setShowDevDetails(!showDevDetails);
  };

  // Safely extract confidence from backend object if available
  const backendConfidence =
    canonicalResult?.confidence ??
    (analysis as any)?.confidence ??
    (analysis as any)?.searchConfidence ??
    null;

  // Safely extract compatibility score from backend object if available
  const backendCompatibilityScore =
    (analysis as any)?.compatibilityScore ??
    (analysis as any)?.score ??
    null;

  return (
    <View style={styles.container}>
      {/* SECTION 1: Result Hero Card */}
      <ResultStatusCard
        recognizedName={recognizedName}
        status={finalStatus}
        inputType={inputType}
        confidence={backendConfidence}
        compatibilityScore={backendCompatibilityScore}
        allowedCount={statistics.allowedCount}
        forbiddenCount={statistics.forbiddenCount}
        conditionalCount={statistics.conditionalCount}
        unresolvedCount={statistics.unresolvedCount}
      />

      {/* SECTION 2: Statistics (Dynamic 3 to 5 cards) */}
      <StatisticCard statistics={statistics} />

      {/* SECTION 3: Forbidden Ingredients (Hidden if 0) */}
      <IngredientSection
        title="المكونات المحظورة"
        icon="❌"
        status="forbidden"
        ingredients={forbiddenIngredients}
      />

      {/* SECTION 4: Conditional Ingredients (Hidden if 0) */}
      <IngredientSection
        title="المكونات المشروطة"
        icon="⚠️"
        status="conditional"
        ingredients={conditionalIngredients}
      />

      {/* SECTION 5: Allowed Ingredients (Hidden if 0) */}
      <IngredientSection
        title="المكونات المسموحة"
        icon="✅"
        status="allowed"
        ingredients={allowedIngredients}
      />

      {/* SECTION 6: Unresolved Ingredients (Hidden if 0) */}
      <UnresolvedSection unresolvedInputs={unresolvedInputs} />

      {/* SECTION 7: Developer Details (Rendered ONLY when __DEV__ AND isDevMode) */}
      {typeof __DEV__ !== "undefined" && __DEV__ && isDevMode && (
        <View style={[styles.devAccordion, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <TouchableOpacity
            style={styles.devHeader}
            onPress={toggleDevDetails}
            activeOpacity={0.7}
          >
            <View style={styles.devHeaderLeft}>
              <Icon name="code-slash-outline" size={18} color={colors.mutedForeground} />
              <Text style={[styles.devTitle, { color: colors.foreground }]}>تفاصيل المطور (Developer Details)</Text>
            </View>
            <Icon
              name={showDevDetails ? "chevron-up-outline" : "chevron-down-outline"}
              size={18}
              color={colors.mutedForeground}
            />
          </TouchableOpacity>

          {showDevDetails && (
            <View style={[styles.devBody, { borderColor: colors.border }]}>
              {ingredientDecisions.map((item, idx) => (
                <View key={`dev_${idx}`} style={styles.devRow}>
                  <Text style={[styles.devItemText, { color: colors.foreground }]}>
                    ID: {item.canonicalId || 0} | Canonical: {item.canonicalName} | Method: {item.searchMethod || "N/A"}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>
      )}

      {/* SECTION 8: Action Buttons */}
      <ResultActionButtons
        onAnalyzeAnother={onRetry || (() => {})}
        onGoHome={handleGoHome}
        onShare={onShare}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 16,
    padding: 16,
  },
  clarificationCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 20,
    width: "100%",
  },
  clarificationHeader: {
    alignItems: "center",
    gap: 8,
  },
  clarificationIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  clarificationQuestion: {
    fontSize: 20,
    fontFamily: "Tajawal_700Bold",
    textAlign: "center",
    lineHeight: 28,
  },
  clarificationSubtitle: {
    fontSize: 15,
    fontFamily: "Tajawal_500Medium",
    textAlign: "center",
  },
  suggestionsList: {
    gap: 12,
  },
  suggestionButton: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 16,
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
  },
  suggestionRightPart: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  suggestionEmoji: {
    fontSize: 26,
  },
  suggestionTextContainer: {
    flex: 1,
    alignItems: "flex-end",
    gap: 3,
  },
  suggestionLabel: {
    fontSize: 17.5,
    fontFamily: "Tajawal_700Bold",
    textAlign: "right",
  },
  suggestionSub: {
    fontSize: 13.5,
    fontFamily: "Tajawal_500Medium",
    textAlign: "right",
  },
  devAccordion: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
    marginVertical: 4,
  },
  devHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 14,
  },
  devHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  devTitle: {
    fontSize: 14,
    fontFamily: "Tajawal_700Bold",
  },
  devBody: {
    padding: 14,
    borderTopWidth: 1,
    gap: 6,
  },
  devRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  devItemText: {
    fontSize: 12,
    fontFamily: "Tajawal_400Regular",
  },
});
