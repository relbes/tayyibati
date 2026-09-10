import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Icon } from "@/components/Icon";
import { useColors } from "@/hooks/useColors";

export interface EmptyAnalysisStateProps {
  title: string;
  message: string;
  retryLabel: string;
  onRetry: () => void;
  iconName?: string;
  suggestions?: Array<{
    canonicalId: number;
    canonicalEntityType: "food" | "dish";
    nameAr: string;
    nameEn: string;
  }>;
  onSelectSuggestion?: (queryText: string) => void;
  isAnalyzing?: boolean;
}

export const EmptyAnalysisState = React.memo(function EmptyAnalysisState({
  title,
  message,
  retryLabel,
  onRetry,
  iconName = "search-outline",
  suggestions,
  onSelectSuggestion,
  isAnalyzing = false,
}: EmptyAnalysisStateProps) {
  const colors = useColors();
  const hasSuggestions = suggestions && suggestions.length > 0;

  return (
    <View
      style={[styles.container, { backgroundColor: colors.card, borderColor: colors.border }]}
      accessibilityRole="summary"
      accessibilityLabel={`${title}. ${message}`}
    >
      <View style={[styles.iconCircle, { backgroundColor: colors.muted }]}>
        <Icon name={iconName as any} size={36} color={colors.mutedForeground} />
      </View>

      <Text style={[styles.title, { color: colors.foreground }]}>{title}</Text>
      <Text style={[styles.description, { color: colors.foreground }]}>{message}</Text>

      {hasSuggestions && (
        <View style={styles.suggestionsContainer}>
          <Text style={[styles.suggestionsHeader, { color: colors.foreground }]}>
            لم نجد هذا الطعام بالاسم نفسه، لكن ربما تقصد:
          </Text>
          <View style={styles.suggestionsList}>
            {suggestions.map((item, idx) => (
              <TouchableOpacity
                key={`${item.canonicalEntityType}_${item.canonicalId}_${idx}`}
                style={[
                  styles.suggestionChip,
                  { backgroundColor: colors.secondary, borderColor: colors.border },
                ]}
                disabled={isAnalyzing}
                onPress={() => onSelectSuggestion?.(item.nameAr)}
                activeOpacity={0.7}
              >
                <View style={styles.chipContent}>
                  <Text style={[styles.chipText, { color: colors.foreground }]}>
                    {item.nameAr}
                  </Text>
                  <Text style={[styles.chipBadge, { color: colors.mutedForeground }]}>
                    {item.canonicalEntityType === "dish" ? "طبق" : "صنف"}
                  </Text>
                </View>
                <Icon name="chevron-back-outline" size={16} color={colors.primary} />
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      <TouchableOpacity
        style={[styles.retryBtn, { backgroundColor: colors.primary }]}
        onPress={onRetry}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel={retryLabel}
      >
        <Icon name="refresh-outline" size={18} color={colors.primaryForeground} />
        <Text style={[styles.retryBtnText, { color: colors.primaryForeground }]}>{retryLabel}</Text>
      </TouchableOpacity>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    padding: 28,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 20,
    gap: 12,
  },
  iconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  title: {
    fontSize: 19,
    fontFamily: "Tajawal_700Bold",
    textAlign: "center",
  },
  description: {
    fontSize: 16,
    fontFamily: "Tajawal_500Medium",
    textAlign: "center",
    lineHeight: 25,
  },
  retryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 24,
    height: 48,
    borderRadius: 14,
    marginTop: 8,
  },
  retryBtnText: {
    fontSize: 15,
    fontFamily: "Tajawal_700Bold",
  },
  suggestionsContainer: {
    width: "100%",
    marginTop: 16,
    marginBottom: 8,
    gap: 10,
  },
  suggestionsHeader: {
    fontSize: 15,
    fontFamily: "Tajawal_700Bold",
    textAlign: "right",
    marginBottom: 4,
  },
  suggestionsList: {
    width: "100%",
    gap: 8,
  },
  suggestionChip: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  chipContent: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
  },
  chipText: {
    fontSize: 15,
    fontFamily: "Tajawal_700Bold",
  },
  chipBadge: {
    fontSize: 12,
    fontFamily: "Tajawal_500Medium",
  },
});
