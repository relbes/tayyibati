import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Icon } from "@/components/Icon";

export interface AllowedPercentageCardProps {
  allowedPercentage: number;
  allowedCount: number;
  totalCount: number;
  status?: "allowed" | "forbidden" | "conditional" | "unknown";
}

export const AllowedPercentageCard = React.memo(function AllowedPercentageCard({
  allowedPercentage,
  allowedCount,
  totalCount,
  status = "unknown",
}: AllowedPercentageCardProps) {
  const clampedPct = Math.min(100, Math.max(0, Math.round(allowedPercentage)));
  const percentColor =
    status === "allowed"
      ? "#16A34A"
      : status === "conditional"
      ? "#F59E0B"
      : status === "forbidden"
      ? "#EF4444"
      : "#16A34A";

  return (
    <View style={styles.card}>
      {/* Header: Title on Right, Percentage on Left */}
      <View style={styles.headerRow}>
        <View style={styles.titleGroup}>
          <Icon name="leaf-outline" size={20} color="#0F172A" />
          <Text style={styles.title}>نسبة المكونات المسموحة</Text>
        </View>
        <Text style={[styles.percentText, { color: percentColor }]}>
          {clampedPct}%
        </Text>
      </View>

      {/* Horizontal Progress Bar */}
      <View style={styles.progressTrack}>
        <View
          style={[
            styles.progressFill,
            {
              width: `${clampedPct}%`,
              backgroundColor: "#16A34A",
            },
          ]}
        />
      </View>

      {/* Subtitle Underneath Progress Bar */}
      <Text style={styles.subText}>
        {allowedCount} من أصل {totalCount} مكون مسموح
      </Text>
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 16,
    gap: 12,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 2,
  },
  headerRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
  },
  titleGroup: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
  },
  title: {
    fontSize: 15,
    fontFamily: "Tajawal_700Bold",
    color: "#0F172A",
  },
  percentText: {
    fontSize: 18,
    fontFamily: "Tajawal_700Bold",
  },
  progressTrack: {
    height: 9,
    borderRadius: 4.5,
    backgroundColor: "#E2E8F0",
    overflow: "hidden",
    width: "100%",
  },
  progressFill: {
    height: "100%",
    borderRadius: 4.5,
  },
  subText: {
    fontSize: 13,
    fontFamily: "Tajawal_500Medium",
    color: "#64748B",
    textAlign: "right",
  },
});
