import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, LayoutAnimation, Platform, UIManager } from "react-native";
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

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface AnalysisResultCardProps {
  report?: AnalysisReport | null;
  viewModel?: AnalysisResultViewModel | null;
  onRetry?: () => void;
  onGoHome?: () => void;
  onShare?: () => void;
}

export function AnalysisResultCard({
  report,
  viewModel: inputViewModel,
  onRetry,
  onGoHome,
  onShare,
}: AnalysisResultCardProps) {
  const colors = useColors();
  const { isDevMode } = useDeveloperMode();
  const [showDevDetails, setShowDevDetails] = useState<boolean>(false);

  // Construct or use unified ViewModel
  const viewModel: AnalysisResultViewModel | null = inputViewModel
    ? inputViewModel
    : report
    ? createAnalysisResultViewModel(report)
    : null;

  if (!viewModel) return null;

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
        onGoHome={onGoHome || (() => {})}
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
