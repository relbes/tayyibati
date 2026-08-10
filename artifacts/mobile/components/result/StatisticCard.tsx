import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Icon } from "@/components/Icon";
import { useColors } from "@/hooks/useColors";

export interface StatisticItem {
  key: string;
  label: string;
  value: number;
  icon: string;
  color: string;
  bg: string;
}

export interface StatisticCardProps {
  statistics: {
    totalIngredients: number;
    allowedCount: number;
    forbiddenCount: number;
    conditionalCount: number;
    unresolvedCount: number;
  };
}

export const StatisticCard = React.memo(function StatisticCard({ statistics }: StatisticCardProps) {
  const colors = useColors();

  // Core required 3 statistics cards: Total, Allowed, Forbidden
  const items: StatisticItem[] = [
    {
      key: "total",
      label: "المكونات",
      value: statistics.totalIngredients,
      icon: "pie-chart-outline",
      color: colors.primary,
      bg: colors.secondary,
    },
    {
      key: "allowed",
      label: "مسموح",
      value: statistics.allowedCount,
      icon: "checkmark-circle-outline",
      color: colors.allowed,
      bg: colors.allowed + "15",
    },
    {
      key: "forbidden",
      label: "محظور",
      value: statistics.forbiddenCount,
      icon: "close-circle-outline",
      color: colors.forbidden,
      bg: colors.forbidden + "15",
    },
  ];

  // Dynamically include Conditional ONLY if conditionalCount > 0
  if (statistics.conditionalCount > 0) {
    items.push({
      key: "conditional",
      label: "مشروط",
      value: statistics.conditionalCount,
      icon: "alert-circle-outline",
      color: colors.conditional,
      bg: colors.conditional + "15",
    });
  }

  // Dynamically include Unresolved ONLY if unresolvedCount > 0
  if (statistics.unresolvedCount > 0) {
    items.push({
      key: "unresolved",
      label: "غير محدد",
      value: statistics.unresolvedCount,
      icon: "help-circle-outline",
      color: colors.unknown,
      bg: colors.muted,
    });
  }

  return (
    <View
      style={styles.grid}
      accessibilityRole="summary"
      accessibilityLabel={`إحصائيات المكونات: إجمالي ${statistics.totalIngredients}، ${statistics.allowedCount} مسموح، ${statistics.forbiddenCount} محظور`}
    >
      {items.map((item) => (
        <View
          key={item.key}
          style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
        >
          <View style={[styles.iconWrap, { backgroundColor: item.bg }]}>
            <Icon name={item.icon as any} size={20} color={item.color} />
          </View>
          <Text style={[styles.value, { color: colors.foreground }]}>{item.value}</Text>
          <Text style={[styles.label, { color: colors.mutedForeground }]}>{item.label}</Text>
        </View>
      ))}
    </View>
  );
});

const styles = StyleSheet.create({
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginVertical: 4,
  },
  card: {
    flex: 1,
    minWidth: "28%",
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 14,
    paddingHorizontal: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  value: {
    fontSize: 20,
    fontFamily: "Tajawal_700Bold",
  },
  label: {
    fontSize: 12,
    fontFamily: "Tajawal_500Medium",
    marginTop: 2,
  },
});
