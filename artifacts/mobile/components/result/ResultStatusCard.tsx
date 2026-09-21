import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Icon } from "@/components/Icon";

export interface ResultStatusCardProps {
  recognizedName: string;
  status: "allowed" | "forbidden" | "conditional" | "unknown";
  inputType?: "text" | "camera";
  analysisType?: "text" | "image" | "label";
  isSingleFood?: boolean;
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
  status,
  analysisType = "text",
  isSingleFood = false,
  summaryText,
}: ResultStatusCardProps) {
  // Status configuration mapping matching the Tayyibati design system
  const statusConfig = {
    allowed: {
      decisionText: "مسموح",
      topBadgeText: "متوافق مع نظام الطيبات",
      topBadgeIcon: "leaf" as const,
      color: "#16A34A",
      circleBg: "#16A34A",
      topBadgeBg: "#DCFCE7",
      topBadgeBorder: "#BBF7D0",
      topBadgeTextColor: "#16A34A",
      icon: "checkmark" as const,
      defaultSummary: isSingleFood
        ? "هذا المكون متوافق مع نظام الطيبات."
        : "هذا الطعام متوافق مع نظام الطيبات.",
    },
    conditional: {
      decisionText: "مشروط",
      topBadgeText: "يحتوي على مكونات بحاجة لمراجعة",
      topBadgeIcon: "alert-circle" as const,
      color: "#F59E0B",
      circleBg: "#F59E0B",
      topBadgeBg: "#FEF3C7",
      topBadgeBorder: "#FDE68A",
      topBadgeTextColor: "#D97706",
      icon: "remove" as const,
      defaultSummary: "يحتوي هذا الطعام على مكونات بحاجة إلى مراجعة.",
    },
    forbidden: {
      decisionText: "ممنوع",
      topBadgeText: "يحتوي على مكونات غير مسموحة",
      topBadgeIcon: "alert-circle" as const,
      color: "#EF4444",
      circleBg: "#EF4444",
      topBadgeBg: "#FEE2E2",
      topBadgeBorder: "#FECACA",
      topBadgeTextColor: "#EF4444",
      icon: "close" as const,
      defaultSummary:
        analysisType === "label"
          ? "يحتوي هذا المنتج على مكونات غير مسموحة في نظام الطيبات."
          : "تحتوي هذه الوجبة على مكونات غير مسموحة في نظام الطيبات.",
    },
    unknown: {
      decisionText: "غير محدد",
      topBadgeText: "يتطلب تدقيقاً إضافياً",
      topBadgeIcon: "help-circle" as const,
      color: "#6B7280",
      circleBg: "#6B7280",
      topBadgeBg: "#F1F5F9",
      topBadgeBorder: "#E2E8F0",
      topBadgeTextColor: "#64748B",
      icon: "help" as const,
      defaultSummary: "لم نتمكن من تحديد حالة جميع المكونات بدقة كافية.",
    },
  };

  const currentStatus = status && statusConfig[status] ? status : "unknown";
  const cfg = statusConfig[currentStatus];

  return (
    <View
      style={styles.card}
      accessibilityRole="header"
      accessibilityLabel={`نتيجة التحليل لـ ${recognizedName}: ${cfg.decisionText}`}
    >
      {/* 1. Top Status Warning Badge Row (RTL: aligned to right) */}
      <View style={styles.topBadgeRow}>
        <View
          style={[
            styles.topBadge,
            {
              backgroundColor: cfg.topBadgeBg,
              borderColor: cfg.topBadgeBorder,
            },
          ]}
        >
          <Icon name={cfg.topBadgeIcon} size={14} color={cfg.topBadgeTextColor} />
          <Text style={[styles.topBadgeText, { color: cfg.topBadgeTextColor }]}>
            {cfg.topBadgeText}
          </Text>
        </View>
      </View>

      {/* 2. Main Content Row: Text Stack on Right + Large Emblem on Left */}
      <View style={styles.heroRow}>
        {/* Right: Meal Title + Status text */}
        <View style={styles.heroTextContainer}>
          <Text style={styles.mealTitle} numberOfLines={2}>
            {recognizedName}
          </Text>
          <Text style={[styles.statusText, { color: cfg.color }]}>
            {cfg.decisionText}
          </Text>
        </View>

        {/* Left: Prominent Circular Status Emblem */}
        <View style={[styles.heroEmblem, { backgroundColor: cfg.circleBg }]}>
          <Icon name={cfg.icon} size={28} color="#FFFFFF" strokeWidth={3} />
        </View>
      </View>

      {/* 3. Reason / Explanation Text */}
      <Text style={styles.summaryText}>
        {summaryText || cfg.defaultSummary}
      </Text>
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 18,
    gap: 12,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  topBadgeRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
  },
  topBadge: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
  },
  topBadgeText: {
    fontSize: 12,
    fontFamily: "Tajawal_700Bold",
  },
  heroRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
    marginTop: 2,
  },
  heroTextContainer: {
    flex: 1,
    alignItems: "flex-end",
    gap: 4,
  },
  mealTitle: {
    fontSize: 22,
    fontFamily: "Tajawal_700Bold",
    color: "#0F172A",
    textAlign: "right",
    lineHeight: 28,
  },
  statusText: {
    fontSize: 18,
    fontFamily: "Tajawal_700Bold",
    textAlign: "right",
  },
  heroEmblem: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3,
  },
  summaryText: {
    fontSize: 13.5,
    fontFamily: "Tajawal_400Regular",
    color: "#64748B",
    textAlign: "right",
    lineHeight: 20,
  },
});
