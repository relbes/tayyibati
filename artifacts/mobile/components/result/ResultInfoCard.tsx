import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Icon } from "@/components/Icon";

export interface ResultInfoCardProps {
  status: "allowed" | "forbidden" | "conditional" | "unknown";
  note?: string | null;
  foodName?: string;
  isSingleFood?: boolean;
}

export const ResultInfoCard = React.memo(function ResultInfoCard({
  status,
  note,
  foodName = "",
  isSingleFood = false,
}: ResultInfoCardProps) {
  // Configuration per status matching the reference design:
  // Allowed: "معلومة مفيدة 💡" (green card)
  // Conditional: "ملاحظة مهمة 💡" (amber card)
  // Forbidden: "تنبيه 🚨" (red card)
  // Unknown: "ملاحظة ℹ️" (slate card)
  const config = {
    allowed: {
      title: "معلومة مفيدة",
      titleEmoji: "💡",
      bg: "#F0FDF4",
      border: "#BBF7D0",
      titleColor: "#15803D",
      textColor: "#166534",
      defaultNote: isSingleFood
        ? `يُعد ${foodName || "هذا المكون"} من الأغذية الطبيعية المتوافقة تماماً مع نظام الطيبات الغذائي الصحي.`
        : `تتكون هذه الوجبة من مكونات طبيعية متوافقة مع إرشادات نظام الطيبات وتدعم التغذية الصحية المتوازنة.`,
    },
    conditional: {
      title: "ملاحظة مهمة",
      titleEmoji: "💡",
      bg: "#FFFBEB",
      border: "#FDE68A",
      titleColor: "#B45309",
      textColor: "#92400E",
      defaultNote:
        "يمكنك جعل هذه الوجبة مسموحة بالكامل بالتحقق من طريقة الطهي وتجنب الزيوت المهدرجة أو المكونات المصنعة.",
    },
    forbidden: {
      title: "تنبيه",
      titleEmoji: "🚨",
      bg: "#FEF2F2",
      border: "#FECACA",
      titleColor: "#B91C1C",
      textColor: "#991B1B",
      defaultNote:
        "يُنصح بتجنب هذا الطعام أو المنتج لاحتوائه على مكونات تخالف قواعد نظام الطيبات وقد تؤثر سلباً على صحة الأمعاء والمناعة.",
    },
    unknown: {
      title: "ملاحظة",
      titleEmoji: "ℹ️",
      bg: "#F8FAFC",
      border: "#E2E8F0",
      titleColor: "#475569",
      textColor: "#334155",
      defaultNote: "يُفضل مراجعة قائمة المكونات وطريقة الإعداد للتأكد من توافقها مع نظام الطيبات.",
    },
  };

  const current = config[status] || config.unknown;
  const content = note && note.trim().length > 0 ? note.trim() : current.defaultNote;

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: current.bg, borderColor: current.border },
      ]}
      accessibilityRole="text"
      accessibilityLabel={`${current.title}: ${content}`}
    >
      {/* Title Row (RTL) */}
      <View style={styles.titleRow}>
        <Text style={[styles.title, { color: current.titleColor }]}>
          {current.title} {current.titleEmoji}
        </Text>
      </View>

      {/* Content Text */}
      <Text style={[styles.text, { color: current.textColor }]}>
        {content}
      </Text>
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginVertical: 4,
    gap: 8,
  },
  titleRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "flex-start",
  },
  title: {
    fontSize: 15,
    fontFamily: "Tajawal_700Bold",
    textAlign: "right",
  },
  text: {
    fontSize: 13,
    fontFamily: "Tajawal_500Medium",
    lineHeight: 20,
    textAlign: "right",
  },
});
