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
}

export const EmptyAnalysisState = React.memo(function EmptyAnalysisState({
  title,
  message,
  retryLabel,
  onRetry,
  iconName = "search-outline",
}: EmptyAnalysisStateProps) {
  const colors = useColors();

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
});
