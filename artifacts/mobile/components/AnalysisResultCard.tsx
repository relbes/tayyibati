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
import { SingleFoodDetailsCard } from "./result/SingleFoodDetailsCard";
import { ResultIngredientList } from "./result/ResultIngredientList";
import { AllowedPercentageCard } from "./result/AllowedPercentageCard";
import { ResultInfoCard } from "./result/ResultInfoCard";

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
  onSelectSuggestion?: (queryText: string, candidateId?: number, entityType?: string) => void;
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

  // ── AMBIGUOUS / MULTIPLE_DISHES disambiguation UI ─────────────────────────
  if (report?.resultMode === "MULTIPLE_DISHES" && (report.canonicalResult as any)?.searchOutcome === "AMBIGUOUS") {
    // Prefer candidateDishes (objects with id/nameAr) over plain suggestions strings
    const candidateDishes: Array<{ id?: number; nameAr?: string; entityType?: string }> =
      (report as any).candidateDishes || [];
    const rawSuggestions: unknown[] = (report.suggestions as unknown[]) || [];

    // Build a unified candidate list
    const candidates: Array<{ label: string; id?: number; entityType?: string }> =
      candidateDishes.length > 0
        ? candidateDishes.map((d) => ({
            label: d.nameAr || "",
            id: d.id,
            entityType: d.entityType || "dish",
          }))
        : rawSuggestions.map((s) => ({
            label: typeof s === "string" ? s : (s as any)?.label || "",
          }));

    const handleAmbiguousSelect = (label: string, id?: number, entityType?: string) => {
      if (isAnalyzing) return;
      setSelectedSuggestion(label);
      if (onSelectSuggestion) {
        onSelectSuggestion(label, id, entityType);
      }
    };

    return (
      <View style={[styles.clarificationCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.clarificationHeader}>
          <View style={[styles.clarificationIconContainer, { backgroundColor: colors.primary + "15" }]}>
            <Icon name="search-outline" size={28} color={colors.primary} />
          </View>
          <Text style={[styles.clarificationQuestion, { color: colors.foreground }]}>
            هل تقصد؟
          </Text>
          <Text style={[styles.clarificationSubtitle, { color: colors.mutedForeground }]}>
            وجدنا أكثر من نتيجة مطابقة لبحثك، اختر ما تقصده.
          </Text>
        </View>

        <View style={styles.suggestionsList}>
          {candidates.map((cand, idx) => {
            const emoji = getSuggestionEmoji(undefined, cand.label);
            const isThisLoading = isAnalyzing && selectedSuggestion === cand.label;
            return (
              <TouchableOpacity
                key={`${cand.label}_${idx}`}
                style={[
                  styles.suggestionButton,
                  {
                    backgroundColor: colors.secondary,
                    borderColor: colors.border,
                    opacity: isAnalyzing && selectedSuggestion !== cand.label ? 0.6 : 1,
                  },
                ]}
                onPress={() => handleAmbiguousSelect(cand.label, cand.id, cand.entityType)}
                disabled={isAnalyzing}
                activeOpacity={0.7}
              >
                <View style={styles.suggestionRightPart}>
                  <Text style={styles.suggestionEmoji}>{emoji}</Text>
                  <View style={styles.suggestionTextContainer}>
                    <Text style={[styles.suggestionLabel, { color: colors.foreground }]}>
                      {cand.label}
                    </Text>
                  </View>
                </View>
                {isThisLoading ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <Icon name="chevron-back" size={18} color={colors.mutedForeground} />
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    );
  }

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
          onAnalyzeAnother={onRetry || (() => {})}
          onGoHome={handleGoHome}
          onShare={onShare}
        />
      </View>
    );
  }

  // Handle LIST_CATALOG Presentation Mode (e.g. "أكلات مسموح بيها", "أكلات ممنوعة")
  if (viewModel.presentationMode === "LIST_CATALOG" && viewModel.listCatalogViewModel) {
    const listVM = viewModel.listCatalogViewModel;
    const isAllowed = listVM.catalogType === "allowed";
    const isForbidden = listVM.catalogType === "forbidden";
    const isCategory = listVM.catalogType === "category";
    const headerBg = isAllowed ? "#008C5A" : isForbidden ? "#DC2626" : "#008C5A";
    const badgeBg = isAllowed ? "#DCFCE7" : isForbidden ? "#FEE2E2" : "#DCFCE7";
    const badgeText = isAllowed ? "#15803D" : isForbidden ? "#DC2626" : "#15803D";
    const badgeBorder = isAllowed ? "#86EFAC" : isForbidden ? "#FECDD3" : "#86EFAC";

    return (
      <View style={styles.container}>
        {/* Main Header / Navigation Card */}
        <View style={[styles.listCatalogCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.listCatalogHeader}>
            <View style={[styles.listCatalogIconContainer, { backgroundColor: isAllowed ? "#008C5A15" : isForbidden ? "#DC262615" : "#008C5A15" }]}>
              <Icon name={isAllowed ? "checkmark-circle" : isForbidden ? "close-circle" : "leaf"} size={32} color={headerBg} />
            </View>
            <Text style={[styles.listCatalogTitle, { color: colors.foreground }]}>
              {listVM.title}
            </Text>
            <Text style={[styles.listCatalogDesc, { color: colors.mutedForeground }]}>
              {listVM.description}
            </Text>
          </View>

          {/* Primary Action Button: Navigate to Browse with correct status filter or category */}
          <TouchableOpacity
            style={[styles.browseActionBtn, { backgroundColor: headerBg, marginHorizontal: 0 }]}
            onPress={() => {
              if (listVM.actionRoute) {
                router.push(listVM.actionRoute as any);
              } else if (isCategory) {
                router.push("/(tabs)/browse" as any);
              } else {
                router.push(`/(tabs)/browse?status=${listVM.actionFilter}` as any);
              }
            }}
            activeOpacity={0.8}
          >
            <Icon name="arrow-back" size={18} color="#FFFFFF" />
            <Text style={styles.browseActionBtnText}>{listVM.actionLabel}</Text>
            <Icon name="book-outline" size={20} color="#FFFFFF" />
          </TouchableOpacity>

          {/* Sample / Preview Foods Section */}
          {listVM.sampleFoods.length > 0 && (
            <View style={styles.sampleFoodsSection}>
              <Text style={[styles.sampleFoodsSectionTitle, { color: colors.foreground }]}>
                {isAllowed ? "أمثلة على الأطعمة المسموحة:" : isForbidden ? "أمثلة على الأطعمة الممنوعة:" : "أصناف من هذا القسم:"}
              </Text>
              <View style={styles.sampleFoodsList}>
                {listVM.sampleFoods.map((item, idx) => (
                  <View
                    key={`sample_${idx}`}
                    style={[
                      styles.sampleFoodItem,
                      { backgroundColor: colors.secondary, borderColor: colors.border },
                    ]}
                  >
                    <View style={styles.sampleFoodRightPart}>
                      <Text style={styles.sampleFoodBullet}>
                        {item.status === "allowed" ? "🟢" : item.status === "forbidden" ? "🔴" : "🟡"}
                      </Text>
                      <View style={styles.sampleFoodTextContainer}>
                        <Text style={[styles.sampleFoodName, { color: colors.foreground }]}>
                          {item.nameAr}
                        </Text>
                        {item.reason ? (
                          <Text style={[styles.sampleFoodReason, { color: colors.mutedForeground }]}>
                            {item.reason}
                          </Text>
                        ) : null}
                      </View>
                    </View>
                    <View style={[styles.sampleFoodBadge, { backgroundColor: badgeBg, borderColor: badgeBorder }]}>
                      <Text style={[styles.sampleFoodBadgeText, { color: badgeText }]}>
                        {isAllowed ? "مسموح" : "ممنوع"}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Category Suggestions / Chips if available */}
          {listVM.categorySuggestions.length > 0 && (
            <View style={styles.listSuggestionsRow}>
              <Text style={[styles.listSuggestionsTitle, { color: colors.mutedForeground }]}>
                أقسام مقترحة:
              </Text>
              <View style={styles.listChipsWrap}>
                {listVM.categorySuggestions.map((cat, idx) => (
                  <TouchableOpacity
                    key={`cat_${idx}`}
                    style={[styles.listChip, { backgroundColor: colors.primary + "12", borderColor: colors.primary + "30" }]}
                    onPress={() => {
                      if (onSelectSuggestion) {
                        onSelectSuggestion(cat);
                      }
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.listChipText, { color: colors.primary }]}>{cat}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}
        </View>

        <ResultActionButtons
          onAnalyzeAnother={onRetry || (() => {})}
          onGoHome={handleGoHome}
          onShare={onShare}
        />
      </View>
    );
  }

  // Handle MULTI_ITEM Presentation Mode (e.g. "بطيخ وشمام وتفاح وبرتقال", "الدجاج والبيض والورقيات والبقوليات")
  if (viewModel.presentationMode === "MULTI_ITEM" && viewModel.multiItemViewModel) {
    const multiVM = viewModel.multiItemViewModel;
    return (
      <View style={styles.container}>
        <View style={[styles.listCatalogCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.listCatalogHeader}>
            <View style={[styles.listCatalogIconContainer, { backgroundColor: colors.primary + "15" }]}>
              <Icon name="layers-outline" size={32} color={colors.primary} />
            </View>
            <Text style={[styles.listCatalogTitle, { color: colors.foreground }]}>
              {multiVM.title}
            </Text>
            <Text style={[styles.listCatalogDesc, { color: colors.mutedForeground }]}>
              {multiVM.description}
            </Text>
          </View>

          {/* Render Items */}
          <View style={styles.sampleFoodsSection}>
            {multiVM.items.map((item, idx) => {
              const isAllowed = item.status === "allowed";
              const isForbidden = item.status === "forbidden";
              const isConditional = item.status === "conditional";

              const badgeBg = isAllowed ? "#DCFCE7" : isForbidden ? "#FEE2E2" : isConditional ? "#FEF3C7" : "#F3F4F6";
              const badgeText = isAllowed ? "#15803D" : isForbidden ? "#DC2626" : isConditional ? "#D97706" : "#6B7280";
              const badgeBorder = isAllowed ? "#86EFAC" : isForbidden ? "#FECDD3" : isConditional ? "#FDE68A" : "#E5E7EB";
              const statusLabel = isAllowed ? "مسموح" : isForbidden ? "ممنوع" : isConditional ? "مشروط" : "غير متوفر";
              const bulletEmoji = isAllowed ? "🟢" : isForbidden ? "🔴" : isConditional ? "🟡" : "⚪";

              return (
                <View
                  key={`multi_${idx}`}
                  style={[
                    styles.sampleFoodItem,
                    { backgroundColor: colors.secondary, borderColor: colors.border },
                  ]}
                >
                  <View style={styles.sampleFoodRightPart}>
                    <Text style={styles.sampleFoodBullet}>{bulletEmoji}</Text>
                    <View style={styles.sampleFoodTextContainer}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                        <Text style={[styles.sampleFoodName, { color: colors.foreground }]}>
                          {item.nameAr}
                        </Text>
                        {item.itemType === "category" && (
                          <View style={{ backgroundColor: colors.primary + "15", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                            <Text style={{ fontSize: 10, color: colors.primary, fontFamily: "Cairo-Bold" }}>قسم</Text>
                          </View>
                        )}
                      </View>
                      {item.reason ? (
                        <Text style={[styles.sampleFoodReason, { color: colors.mutedForeground }]}>
                          {item.reason}
                        </Text>
                      ) : null}
                      {item.categoryStats?.exceptions && item.categoryStats.exceptions.length > 0 ? (
                        <Text style={[styles.sampleFoodReason, { color: "#D97706", marginTop: 2 }]}>
                          ⚠️ {item.categoryStats.exceptions.join(" | ")}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                  <View style={[styles.sampleFoodBadge, { backgroundColor: badgeBg, borderColor: badgeBorder }]}>
                    <Text style={[styles.sampleFoodBadgeText, { color: badgeText }]}>
                      {statusLabel}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        </View>

        <ResultActionButtons
          onAnalyzeAnother={onRetry || (() => {})}
          onGoHome={handleGoHome}
          onShare={onShare}
        />
      </View>
    );
  }

  const { inputType, recognizedName, ingredientDecisions, mealDecision, canonicalResult, analysis } = viewModel;

  // Handle Unsupported Questions (Calorie calculation, diet planning, weight loss)
  if (report?.resultMode === "UNSUPPORTED_QUESTION" || (report as any)?.queryIntent === "UNSUPPORTED_QUESTION") {
    return (
      <EmptyAnalysisState
        title="استفسار خارج نطاق الخدمة"
        message={report?.explanation || "تطبيق طيباتي مخصص لتحديد الأطعمة المسموحة والممنوعة والمشروطة وفق القواعد الغذائية المعتمدة، ولا يقدم حالياً خدمة حساب السعرات الحرارية أو وضع جداول الحميات الغذائية والتخسيس."}
        retryLabel="بحث جديد"
        onRetry={onRetry || (() => {})}
        iconName="information-circle-outline"
        suggestions={(report?.suggestions || []).map((s: any) => {
          const name = typeof s === "string" ? s : s.label || s.query || "";
          return {
            canonicalId: 0,
            canonicalEntityType: "food" as const,
            nameAr: name,
            nameEn: name,
          };
        })}
        onSelectSuggestion={(suggestion) => {
          if (onSelectSuggestion) onSelectSuggestion(suggestion);
        }}
        isAnalyzing={isAnalyzing}
      />
    );
  }

  // Handle Empty Analysis State via presentation props
  if (!ingredientDecisions || ingredientDecisions.length === 0) {
    return (
      <EmptyAnalysisState
        title="لم نتمكن من التعرف على الطعام"
        message="عفواً، لم نتمكن من تحديد مكونات هذا الطعام أو الوجبة. يُرجى التأكد من كتابة الاسم بشكل دقيق أو استخدام صورة أوضح ثم إعادة المحاولة."
        retryLabel="إعادة المحاولة"
        onRetry={onRetry || (() => {})}
        iconName="search-outline"
        suggestions={viewModel.fallbackSuggestions || report?.fallbackSuggestions}
        onSelectSuggestion={onSelectSuggestion}
        isAnalyzing={isAnalyzing}
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

  // Determine if this is a single food vs a composite dish/product
  const isSingleFood =
    viewModel.presentationMode === "SPECIFIC_FOOD" ||
    (ingredientDecisions.length <= 1 &&
      !(report as any)?.dish &&
      (report as any)?.entityType !== "dish" &&
      (report as any)?.resultMode !== "COMPOSITE_FOOD" &&
      (report as any)?.resultMode !== "MULTIPLE_DISHES");

  const rawCanonical = (report as any)?.canonicalResult;
  const categoryAr =
    (report?.primaryRuling as any)?.categoryAr ||
    rawCanonical?.category_name_ar ||
    rawCanonical?.categoryNameAr ||
    "طبيعي";

  const isAnimal =
    (report as any)?.proteinCategory === "MEAT" ||
    (report as any)?.proteinCategory === "POULTRY" ||
    (report?.primaryRuling as any)?.proteinCategory === "MEAT" ||
    (report?.primaryRuling as any)?.proteinCategory === "POULTRY" ||
    (report?.primaryRuling as any)?.sourceType === "حيواني" ||
    recognizedName.includes("لحم") ||
    recognizedName.includes("دجاج") ||
    recognizedName.includes("بقر") ||
    recognizedName.includes("غنم");

  const sourceType =
    (report?.primaryRuling as any)?.sourceType ||
    rawCanonical?.source_type ||
    rawCanonical?.sourceType ||
    (isAnimal ? "حيواني" : "نباتي");

  // Ordered ingredients for direct list display: forbidden -> conditional -> allowed -> unknown
  const allIngredientsOrdered = [
    ...forbiddenIngredients,
    ...conditionalIngredients,
    ...allowedIngredients,
    ...ingredientDecisions.filter(
      (i) =>
        i.status !== "forbidden" &&
        i.status !== "conditional" &&
        i.status !== "allowed"
    ),
  ];
  const allAllowed =
    statistics.forbiddenCount === 0 && statistics.conditionalCount === 0;

  // Contextual info/warning note
  const infoNote =
    report?.explanation ||
    (report as any)?.summary ||
    (report as any)?.analysis?.notes ||
    (mealDecision as any)?.reason ||
    report?.primaryRuling?.dbReason ||
    null;

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

  const totalIngredients = statistics.totalIngredients;
  let allowedPct = 0;
  if (totalIngredients > 0) {
    allowedPct = Math.round((statistics.allowedCount / totalIngredients) * 100);
  }

  return (
    <View style={styles.container}>
      {/* SECTION 0: Browse Navigation Action Button (if requested by Intent Engine) */}
      {report?.action?.type === "NAVIGATE_BROWSE" && (
        <TouchableOpacity
          style={styles.browseActionBtn}
          onPress={() => {
            if (report.action?.route) {
              router.push(report.action.route as any);
            } else if (report.action?.filter) {
              router.push(`/(tabs)/browse?status=${report.action.filter}` as any);
            }
          }}
          activeOpacity={0.8}
        >
          <Icon name="arrow-back" size={18} color="#FFFFFF" />
          <Text style={styles.browseActionBtnText}>
            {report.action.label || (report.action.filter === "allowed" ? "عرض دليل الأطعمة المسموحة" : "عرض دليل الأطعمة الممنوعة")}
          </Text>
          <Icon name="book-outline" size={20} color="#FFFFFF" />
        </TouchableOpacity>
      )}

      {/* SECTION 1: Result Hero Card */}
      <ResultStatusCard
        recognizedName={recognizedName}
        status={finalStatus}
        inputType={inputType}
        analysisType={(report?.analysisType === "barcode" ? "label" : report?.analysisType) || "text"}
        isSingleFood={isSingleFood}
        summaryText={infoNote || undefined}
        confidence={backendConfidence}
        compatibilityScore={backendCompatibilityScore}
        allowedCount={statistics.allowedCount}
        forbiddenCount={statistics.forbiddenCount}
        conditionalCount={statistics.conditionalCount}
        unresolvedCount={statistics.unresolvedCount}
      />

      {/* SECTION 2: Single Food Details OR (Percentage + Statistics + Ingredients List) */}
      {isSingleFood ? (
        <>
          <SingleFoodDetailsCard
            nameAr={recognizedName}
            categoryAr={categoryAr}
            sourceType={sourceType}
            status={finalStatus}
          />
          {infoNote ? (
            <ResultInfoCard
              status={finalStatus}
              note={infoNote}
              foodName={recognizedName}
              isSingleFood={isSingleFood}
            />
          ) : null}
        </>
      ) : (
        <>
          <AllowedPercentageCard
            allowedPercentage={allowedPct}
            allowedCount={statistics.allowedCount}
            totalCount={totalIngredients}
            status={finalStatus}
          />
          <StatisticCard statistics={statistics} />
          <ResultIngredientList
            ingredients={allIngredientsOrdered}
            allAllowed={allAllowed}
          />
        </>
      )}

      {/* SECTION 4: Unresolved Ingredients (if any) */}
      {unresolvedInputs.length > 0 && (
        <UnresolvedSection unresolvedInputs={unresolvedInputs} />
      )}

      {/* SECTION 5: Developer Details (Rendered ONLY when __DEV__ AND isDevMode) */}
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

      {/* Action buttons removed from bottom as requested; re-analyze is placed at top */}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 14,
    padding: 0,
    width: "100%",
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
  browseActionBtn: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#008C5A",
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 14,
    gap: 10,
    marginBottom: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  browseActionBtnText: {
    color: "#FFFFFF",
    fontFamily: "Tajawal_700Bold",
    fontSize: 15,
  },
  listCatalogCard: {
    borderRadius: 20,
    borderWidth: 1.5,
    padding: 20,
    gap: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  listCatalogHeader: {
    alignItems: "center",
    gap: 8,
  },
  listCatalogIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  listCatalogTitle: {
    fontSize: 20,
    fontFamily: "Tajawal_700Bold",
    textAlign: "center",
  },
  listCatalogDesc: {
    fontSize: 14,
    fontFamily: "Tajawal_400Regular",
    textAlign: "center",
    lineHeight: 22,
    paddingHorizontal: 8,
  },
  sampleFoodsSection: {
    marginTop: 6,
    gap: 10,
  },
  sampleFoodsSectionTitle: {
    fontSize: 15,
    fontFamily: "Tajawal_700Bold",
    textAlign: "right",
  },
  sampleFoodsList: {
    gap: 8,
  },
  sampleFoodItem: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  sampleFoodRightPart: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  sampleFoodBullet: {
    fontSize: 14,
  },
  sampleFoodTextContainer: {
    flex: 1,
    alignItems: "flex-end",
  },
  sampleFoodName: {
    fontSize: 14.5,
    fontFamily: "Tajawal_700Bold",
    textAlign: "right",
  },
  sampleFoodReason: {
    fontSize: 12,
    fontFamily: "Tajawal_400Regular",
    textAlign: "right",
    marginTop: 2,
  },
  sampleFoodBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
  },
  sampleFoodBadgeText: {
    fontSize: 12,
    fontFamily: "Tajawal_500Medium",
  },
  listSuggestionsRow: {
    marginTop: 6,
    gap: 8,
    alignItems: "flex-end",
  },
  listSuggestionsTitle: {
    fontSize: 13,
    fontFamily: "Tajawal_500Medium",
    textAlign: "right",
  },
  listChipsWrap: {
    flexDirection: "row-reverse",
    flexWrap: "wrap",
    gap: 6,
  },
  listChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
  },
  listChipText: {
    fontSize: 13,
    fontFamily: "Tajawal_500Medium",
  },
});
