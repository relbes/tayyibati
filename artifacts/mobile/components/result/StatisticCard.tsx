import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Icon } from "@/components/Icon";

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
  // 3 Equal cards in one horizontal row matching the reference layout:
  // In RTL order: [مسموح (Right)] [مشروط (Middle)] [ممنوع (Left)]
  const cards = [
    {
      key: "allowed",
      label: "مسموح",
      value: statistics.allowedCount,
      icon: "checkmark",
      circleBg: "#16A34A",
      bg: "#F0FDF4",
      border: "#DCFCE7",
      labelColor: "#16A34A",
    },
    {
      key: "conditional",
      label: "مشروط",
      value: statistics.conditionalCount,
      icon: "remove",
      circleBg: "#F59E0B",
      bg: "#FFFBEB",
      border: "#FEF3C7",
      labelColor: "#D97706",
    },
    {
      key: "forbidden",
      label: "ممنوع",
      value: statistics.forbiddenCount,
      icon: "close",
      circleBg: "#EF4444",
      bg: "#FEF2F2",
      border: "#FEE2E2",
      labelColor: "#DC2626",
    },
  ];

  return (
    <View
      style={styles.container}
      accessibilityRole="summary"
      accessibilityLabel={`إحصائيات المكونات: ${statistics.allowedCount} مسموح، ${statistics.conditionalCount} مشروط، ${statistics.forbiddenCount} ممنوع`}
    >
      {cards.map((item) => (
        <View
          key={item.key}
          style={[
            styles.statCard,
            {
              backgroundColor: item.bg,
              borderColor: item.border,
            },
          ]}
        >
          {/* Small circular status icon with white symbol */}
          <View style={[styles.iconCircle, { backgroundColor: item.circleBg }]}>
            <Icon name={item.icon as any} size={15} color="#FFFFFF" strokeWidth={2.8} />
          </View>

          {/* Large number */}
          <Text style={styles.valueText}>{item.value}</Text>

          {/* Short Arabic label */}
          <Text style={[styles.labelText, { color: item.labelColor }]}>
            {item.label}
          </Text>
        </View>
      ))}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
    width: "100%",
  },
  statCard: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 14,
    paddingHorizontal: 8,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 4,
    elevation: 1,
  },
  iconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  valueText: {
    fontSize: 22,
    fontFamily: "Tajawal_700Bold",
    color: "#0F172A",
    lineHeight: 26,
  },
  labelText: {
    fontSize: 13,
    fontFamily: "Tajawal_700Bold",
  },
});
