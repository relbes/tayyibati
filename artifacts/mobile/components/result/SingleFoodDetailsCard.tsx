import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Icon } from "@/components/Icon";

export interface SingleFoodDetailsCardProps {
  nameAr: string;
  categoryAr?: string;
  sourceType?: string;
  status: "allowed" | "forbidden" | "conditional" | "unknown";
}

export const SingleFoodDetailsCard = React.memo(function SingleFoodDetailsCard({
  nameAr,
  categoryAr = "طبيعي",
  sourceType = "نباتي",
  status,
}: SingleFoodDetailsCardProps) {
  const isAllowed = status === "allowed";
  const isConditional = status === "conditional";

  const badgeBg = isAllowed ? "#F0FDF4" : isConditional ? "#FFFBEB" : "#FEF2F2";
  const badgeBorder = isAllowed ? "#86EFAC" : isConditional ? "#FDE047" : "#FCA5A5";
  const badgeTextColor = isAllowed ? "#16A34A" : isConditional ? "#D97706" : "#DC2626";
  const badgeLabel = isAllowed ? "مسموح" : isConditional ? "مشروط" : "ممنوع";

  const rows = [
    { label: "الاسم", value: nameAr },
    { label: "النوع", value: categoryAr },
    { label: "المصدر", value: sourceType },
  ];

  return (
    <View style={styles.card}>
      {/* 1. Card Header */}
      <View style={styles.headerRow}>
        <View style={styles.headerRightGroup}>
          <Icon name="list-outline" size={18} color="#0F172A" />
          <Text style={styles.headerTitle}>معلومات المكون</Text>
        </View>
        <Icon name="information-circle-outline" size={18} color="#64748B" />
      </View>

      {/* 2. Table Rows */}
      <View style={styles.tableContainer}>
        {rows.map((row, idx) => (
          <View
            key={row.label}
            style={[styles.tableRow, idx > 0 && styles.tableRowBorder]}
          >
            <Text style={styles.rowLabel}>{row.label}</Text>
            <Text style={styles.rowValue}>{row.value}</Text>
          </View>
        ))}

        {/* Status Row with Badge */}
        <View style={[styles.tableRow, styles.tableRowBorder]}>
          <Text style={styles.rowLabel}>الحالة</Text>
          <View
            style={[
              styles.statusBadge,
              { backgroundColor: badgeBg, borderColor: badgeBorder },
            ]}
          >
            <Text style={[styles.statusBadgeText, { color: badgeTextColor }]}>
              {badgeLabel}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginVertical: 4,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 2,
    gap: 12,
  },
  headerRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  headerRightGroup: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
  },
  headerTitle: {
    fontSize: 15,
    fontFamily: "Tajawal_700Bold",
    color: "#0F172A",
  },
  tableContainer: {
    gap: 0,
  },
  tableRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 11,
  },
  tableRowBorder: {
    borderTopWidth: 1,
    borderTopColor: "#F8FAFC",
  },
  rowLabel: {
    fontSize: 14,
    fontFamily: "Tajawal_400Regular",
    color: "#64748B",
  },
  rowValue: {
    fontSize: 14,
    fontFamily: "Tajawal_700Bold",
    color: "#0F172A",
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
  },
  statusBadgeText: {
    fontSize: 12,
    fontFamily: "Tajawal_700Bold",
  },
});
