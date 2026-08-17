import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Icon } from "@/components/Icon";
import { useColors } from "@/hooks/useColors";
import type { FoodFamilyViewModel, FoodFamilyMemberVM } from "@/lib/models/AnalysisResultViewModel";

export interface FoodFamilyResultCardProps {
  viewModel: FoodFamilyViewModel;
  onRetry?: () => void;
  onGoHome?: () => void;
}

export function FoodFamilyResultCard({ viewModel, onRetry, onGoHome }: FoodFamilyResultCardProps) {
  const colors = useColors();
  const { familyName, familyStatus, summaryText, allowedVariants, forbiddenVariants, conditionalVariants } = viewModel;

  // Ruling badge styling
  const isAllowed = familyStatus === "allowed";
  const isForbidden = familyStatus === "forbidden";
  const isMixed = familyStatus === "mixed" || familyStatus === "conditional";

  const badgeTheme = isAllowed
    ? { bg: colors.allowed + "14", border: colors.allowed + "40", text: colors.allowed, title: "القرار النهائي: مسموح", icon: "checkmark-circle" }
    : isForbidden
    ? { bg: colors.forbidden + "14", border: colors.forbidden + "40", text: colors.forbidden, title: "القرار النهائي: ممنوع", icon: "close-circle" }
    : { bg: colors.conditional + "14", border: colors.conditional + "40", text: colors.conditional, title: "القرار النهائي: يعتمد على النوع", icon: "warning" };

  return (
    <View style={styles.container}>
      {/* 1. HERO HEADER BANNER */}
      <View style={[styles.heroCard, { backgroundColor: badgeTheme.bg, borderColor: badgeTheme.border }]}>
        <View style={styles.headerTop}>
          <Text style={[styles.searchTitle, { color: colors.foreground }]}>{familyName}</Text>
          <View style={[styles.badge, { backgroundColor: badgeTheme.bg, borderColor: badgeTheme.border }]}>
            <Icon name={badgeTheme.icon as any} size={18} color={badgeTheme.text} />
            <Text style={[styles.badgeText, { color: badgeTheme.text }]}>{badgeTheme.title}</Text>
          </View>
        </View>

        {summaryText ? (
          <Text style={[styles.summaryText, { color: colors.foreground }]}>{summaryText}</Text>
        ) : null}
      </View>

      {/* 2. ALLOWED VARIANTS SECTION */}
      {allowedVariants && allowedVariants.length > 0 && (
        <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionIconBg, { backgroundColor: colors.allowed + "20" }]}>
              <Icon name="checkmark" size={18} color={colors.allowed} />
            </View>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
              الأنواع المسموحة ({allowedVariants.length})
            </Text>
          </View>
          <View style={styles.variantList}>
            {allowedVariants.map((item, idx) => (
              <View key={`allowed_${idx}`} style={[styles.variantRow, { borderColor: colors.border }]}>
                <Icon name="checkmark-circle-outline" size={20} color={colors.allowed} />
                <View style={styles.variantTextCol}>
                  <Text style={[styles.variantName, { color: colors.foreground }]}>{item.nameAr}</Text>
                  {item.reason ? (
                    <Text style={[styles.variantReason, { color: colors.mutedForeground }]}>{item.reason}</Text>
                  ) : item.notes ? (
                    <Text style={[styles.variantReason, { color: colors.mutedForeground }]}>{item.notes}</Text>
                  ) : null}
                </View>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* 3. FORBIDDEN VARIANTS SECTION (HIDDEN IF EMPTY) */}
      {forbiddenVariants && forbiddenVariants.length > 0 && (
        <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionIconBg, { backgroundColor: colors.forbidden + "20" }]}>
              <Icon name="close" size={18} color={colors.forbidden} />
            </View>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
              الأنواع الممنوعة ({forbiddenVariants.length})
            </Text>
          </View>
          <View style={styles.variantList}>
            {forbiddenVariants.map((item, idx) => (
              <View key={`forbidden_${idx}`} style={[styles.variantRow, { borderColor: colors.border }]}>
                <Icon name="close-circle-outline" size={20} color={colors.forbidden} />
                <View style={styles.variantTextCol}>
                  <Text style={[styles.variantName, { color: colors.foreground }]}>{item.nameAr}</Text>
                  {item.reason ? (
                    <Text style={[styles.variantReason, { color: colors.mutedForeground }]}>{item.reason}</Text>
                  ) : item.notes ? (
                    <Text style={[styles.variantReason, { color: colors.mutedForeground }]}>{item.notes}</Text>
                  ) : null}
                </View>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* 4. CONDITIONAL VARIANTS SECTION (HIDDEN IF EMPTY) */}
      {conditionalVariants && conditionalVariants.length > 0 && (
        <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionIconBg, { backgroundColor: colors.conditional + "20" }]}>
              <Icon name="alert-circle-outline" size={18} color={colors.conditional} />
            </View>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
              الأنواع المشروطة ({conditionalVariants.length})
            </Text>
          </View>
          <View style={styles.variantList}>
            {conditionalVariants.map((item, idx) => (
              <View key={`conditional_${idx}`} style={[styles.variantRow, { borderColor: colors.border }]}>
                <Icon name="alert-circle-outline" size={20} color={colors.conditional} />
                <View style={styles.variantTextCol}>
                  <Text style={[styles.variantName, { color: colors.foreground }]}>{item.nameAr}</Text>
                  {item.reason ? (
                    <Text style={[styles.variantReason, { color: colors.mutedForeground }]}>{item.reason}</Text>
                  ) : item.notes ? (
                    <Text style={[styles.variantReason, { color: colors.mutedForeground }]}>{item.notes}</Text>
                  ) : null}
                </View>
              </View>
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    gap: 16,
  },
  heroCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
    gap: 12,
  },
  headerTop: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  searchTitle: {
    fontSize: 24,
    fontWeight: "700",
    textAlign: "right",
  },
  badge: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  badgeText: {
    fontSize: 14,
    fontWeight: "600",
  },
  summaryText: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: "right",
  },
  sectionCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  sectionHeader: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 10,
  },
  sectionIconBg: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "700",
    textAlign: "right",
  },
  variantList: {
    gap: 10,
  },
  variantRow: {
    flexDirection: "row-reverse",
    alignItems: "flex-start",
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  variantTextCol: {
    flex: 1,
    gap: 2,
  },
  variantName: {
    fontSize: 16,
    fontWeight: "600",
    textAlign: "right",
  },
  variantReason: {
    fontSize: 13,
    textAlign: "right",
  },
});
