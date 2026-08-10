import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Icon } from "@/components/Icon";
import { useColors } from "@/hooks/useColors";

export interface ResultStatusCardProps {
  recognizedName: string;
  status: "allowed" | "forbidden" | "conditional" | "unknown";
  inputType: "text" | "camera";
  summaryText?: string;
  confidence?: number | null;
  compatibilityScore?: number | null;
  allowedCount?: number;
  forbiddenCount?: number;
  conditionalCount?: number;
  unresolvedCount?: number;
}

export const ResultStatusCard = React.memo(function ResultStatusCard({
  recognizedName,
  inputType,
  summaryText,
  confidence,
  allowedCount = 0,
  forbiddenCount = 0,
  conditionalCount = 0,
  unresolvedCount = 0,
}: ResultStatusCardProps) {
  const colors = useColors();

  // Total ingredient count calculation
  const totalIngredients = allowedCount + forbiddenCount + conditionalCount + unresolvedCount;

  // Decision cases logic (UI Presentation ONLY)
  const is100Allowed = totalIngredients > 0 && allowedCount === totalIngredients;
  const is100Forbidden = totalIngredients > 0 && forbiddenCount === totalIngredients;
  const isMixedMeal = !is100Allowed && !is100Forbidden;

  // Card theme styling based on pure decision or mixed meal
  const cardStyle = is100Allowed
    ? { bg: colors.allowed + "14", border: colors.allowed + "40" }
    : is100Forbidden
    ? { bg: colors.forbidden + "14", border: colors.forbidden + "40" }
    : { bg: colors.card, border: colors.border };

  // Calculate percentages cleanly
  const allowedPct = totalIngredients > 0 ? Math.round((allowedCount / totalIngredients) * 100) : 0;
  const forbiddenPct = totalIngredients > 0 ? Math.round((forbiddenCount / totalIngredients) * 100) : 0;
  const conditionalPct = totalIngredients > 0 ? Math.round((conditionalCount / totalIngredients) * 100) : 0;
  const unresolvedPct = totalIngredients > 0 ? Math.round((unresolvedCount / totalIngredients) * 100) : 0;

  // System match confidence from backend
  const displayConfidence = typeof confidence === "number" ? Math.round(confidence) : null;

  return (
    <View
      style={[styles.card, { backgroundColor: cardStyle.bg, borderColor: cardStyle.border }]}
      accessibilityRole="header"
      accessibilityLabel={
        is100Allowed
          ? `نتيجة التحليل لـ ${recognizedName}: القرار النهائي مسموح`
          : is100Forbidden
          ? `نتيجة التحليل لـ ${recognizedName}: القرار النهائي محظور`
          : `نتيجة التحليل لـ ${recognizedName}: نسب مكونات الوجبة`
      }
    >
      {/* Top Header Row: Source Badge & Decision Badge (Only for 100% Pure Meals) */}
      <View style={styles.topRow}>
        <View style={[styles.sourceBadge, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Icon
            name={inputType === "camera" ? "camera-outline" : "search-outline"}
            size={14}
            color={colors.mutedForeground}
          />
          <Text style={[styles.sourceBadgeText, { color: colors.foreground }]}>
            {inputType === "camera" ? "تحليل الكاميرا" : "البحث النصي"}
          </Text>
        </View>

        {/* Case A: 100% Allowed */}
        {is100Allowed ? (
          <View style={[styles.statusBadge, { backgroundColor: colors.allowed }]}>
            <Icon name="checkmark-circle-outline" size={14} color={colors.card} />
            <Text style={[styles.statusBadgeText, { color: colors.card }]}>
              القرار النهائي: مسموح
            </Text>
          </View>
        ) : null}

        {/* Case B: 100% Forbidden */}
        {is100Forbidden ? (
          <View style={[styles.statusBadge, { backgroundColor: colors.forbidden }]}>
            <Icon name="close-circle-outline" size={14} color={colors.card} />
            <Text style={[styles.statusBadgeText, { color: colors.card }]}>
              القرار النهائي: محظور
            </Text>
          </View>
        ) : null}

        {/* Case C: Mixed Meal — NO Decision Badge rendered! */}
      </View>

      {/* Main Title & Explanation */}
      <View style={styles.headerBlock}>
        <Text style={[styles.mealTitle, { color: colors.foreground }]}>{recognizedName}</Text>
        <Text style={[styles.summaryText, { color: colors.mutedForeground }]}>
          {summaryText || `تم تقييم حالة هذه الوجبة بناءً على المكونات المسجلة وحكم النظام.`}
        </Text>
      </View>

      {/* INGREDIENT COMPOSITION BREAKDOWN (Pure Composition Focus) */}
      <View style={[styles.compositionContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.compositionHeaderTitle, { color: colors.foreground }]}>
          نسب مكونات الوجبة
        </Text>

        <View style={styles.compositionBarsList}>
          {/* Allowed Ingredients Progress Bar */}
          {allowedCount > 0 ? (
            <View style={styles.barItem}>
              <View style={styles.barLabelRow}>
                <Text style={[styles.percentValue, { color: colors.allowed }]}>🟢 {allowedPct}%</Text>
                <Text style={[styles.barLabelText, { color: colors.foreground }]}>من المكونات مسموحة</Text>
              </View>
              <View style={[styles.barTrack, { backgroundColor: colors.border }]}>
                <View
                  style={[
                    styles.barFill,
                    { width: `${Math.min(100, Math.max(0, allowedPct))}%`, backgroundColor: colors.allowed },
                  ]}
                />
              </View>
            </View>
          ) : null}

          {/* Forbidden Ingredients Progress Bar */}
          {forbiddenCount > 0 ? (
            <View style={styles.barItem}>
              <View style={styles.barLabelRow}>
                <Text style={[styles.percentValue, { color: colors.forbidden }]}>🔴 {forbiddenPct}%</Text>
                <Text style={[styles.barLabelText, { color: colors.foreground }]}>من المكونات محظورة</Text>
              </View>
              <View style={[styles.barTrack, { backgroundColor: colors.border }]}>
                <View
                  style={[
                    styles.barFill,
                    { width: `${Math.min(100, Math.max(0, forbiddenPct))}%`, backgroundColor: colors.forbidden },
                  ]}
                />
              </View>
            </View>
          ) : null}

          {/* Conditional Ingredients Progress Bar */}
          {conditionalCount > 0 ? (
            <View style={styles.barItem}>
              <View style={styles.barLabelRow}>
                <Text style={[styles.percentValue, { color: colors.conditional }]}>🟡 {conditionalPct}%</Text>
                <Text style={[styles.barLabelText, { color: colors.foreground }]}>من المكونات مشروطة</Text>
              </View>
              <View style={[styles.barTrack, { backgroundColor: colors.border }]}>
                <View
                  style={[
                    styles.barFill,
                    { width: `${Math.min(100, Math.max(0, conditionalPct))}%`, backgroundColor: colors.conditional },
                  ]}
                />
              </View>
            </View>
          ) : null}

          {/* Unresolved Ingredients Progress Bar */}
          {unresolvedCount > 0 ? (
            <View style={styles.barItem}>
              <View style={styles.barLabelRow}>
                <Text style={[styles.percentValue, { color: colors.unknown }]}>⚪ {unresolvedPct}%</Text>
                <Text style={[styles.barLabelText, { color: colors.foreground }]}>من المكونات غير معروفة</Text>
              </View>
              <View style={[styles.barTrack, { backgroundColor: colors.border }]}>
                <View
                  style={[
                    styles.barFill,
                    { width: `${Math.min(100, Math.max(0, unresolvedPct))}%`, backgroundColor: colors.unknown },
                  ]}
                />
              </View>
            </View>
          ) : null}
        </View>
      </View>

      {/* System Confidence Bar from backend */}
      {displayConfidence !== null ? (
        <View style={styles.confidenceWrap}>
          <View style={styles.confidenceHeader}>
            <Icon
              name="shield-checkmark-outline"
              size={14}
              color={is100Allowed ? colors.allowed : is100Forbidden ? colors.forbidden : colors.primary}
            />
            <Text style={[styles.confidenceLabel, { color: colors.mutedForeground }]}>
              ثقة المطابقة (من النظام):
            </Text>
            <Text
              style={[
                styles.confidenceValue,
                { color: is100Allowed ? colors.allowed : is100Forbidden ? colors.forbidden : colors.foreground },
              ]}
            >
              {displayConfidence}%
            </Text>
          </View>
          <View style={[styles.progressTrack, { backgroundColor: colors.border }]}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${Math.min(100, Math.max(0, displayConfidence))}%`,
                  backgroundColor: is100Allowed
                    ? colors.allowed
                    : is100Forbidden
                    ? colors.forbidden
                    : colors.primary,
                },
              ]}
            />
          </View>
        </View>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
    gap: 16,
    marginVertical: 4,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sourceBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 16,
    borderWidth: 1,
  },
  sourceBadgeText: {
    fontSize: 12,
    fontFamily: "Tajawal_500Medium",
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
  },
  statusBadgeText: {
    fontSize: 13,
    fontFamily: "Tajawal_700Bold",
  },
  headerBlock: {
    gap: 4,
  },
  mealTitle: {
    fontSize: 22,
    fontFamily: "Tajawal_700Bold",
    textAlign: "right",
    lineHeight: 28,
  },
  summaryText: {
    fontSize: 13,
    fontFamily: "Tajawal_400Regular",
    textAlign: "right",
    lineHeight: 19,
  },
  compositionContainer: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    gap: 12,
  },
  compositionHeaderTitle: {
    fontSize: 14,
    fontFamily: "Tajawal_700Bold",
    textAlign: "right",
  },
  compositionBarsList: {
    gap: 10,
  },
  barItem: {
    gap: 4,
  },
  barLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  percentValue: {
    fontSize: 14,
    fontFamily: "Tajawal_700Bold",
  },
  barLabelText: {
    fontSize: 13,
    fontFamily: "Tajawal_500Medium",
  },
  barTrack: {
    height: 8,
    borderRadius: 4,
    overflow: "hidden",
  },
  barFill: {
    height: "100%",
    borderRadius: 4,
  },
  confidenceWrap: {
    gap: 4,
  },
  confidenceHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  confidenceLabel: {
    fontSize: 11,
    fontFamily: "Tajawal_500Medium",
  },
  confidenceValue: {
    fontSize: 12,
    fontFamily: "Tajawal_700Bold",
  },
  progressTrack: {
    height: 5,
    borderRadius: 3,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 3,
  },
});
