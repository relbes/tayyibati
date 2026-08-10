import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Icon } from "@/components/Icon";
import { useColors } from "@/hooks/useColors";
import { isRTL } from "@/lib/i18n";

export function CameraQualityTips() {
  const colors = useColors();
  const rtl = isRTL();

  const tips = [
    { icon: "bulb", label: "إضاءة جيدة" },
    { icon: "camera", label: "صورة واضحة" },
    { icon: "search", label: "قرّب الكاميرا" },
    { icon: "image-outline", label: "أظهر جميع المكونات" },
  ];

  return (
    <View style={styles.container}>
      {/* Section Header */}
      <View style={[styles.headerRow, { flexDirection: rtl ? "row-reverse" : "row" }]}>
        <Icon name="information-circle-outline" size={18} color={colors.primary} />
        <Text style={[styles.sectionTitle, { color: colors.foreground, textAlign: rtl ? "right" : "left" }]}>
          نصائح للحصول على نتيجة أدق
        </Text>
      </View>

      {/* 2x2 Responsive Grid */}
      <View style={[styles.grid, { flexDirection: rtl ? "row-reverse" : "row" }]}>
        {tips.map((tip, idx) => (
          <View
            key={idx}
            style={[
              styles.tipCard,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
              },
            ]}
          >
            <View style={[styles.iconCircle, { backgroundColor: colors.primary + "12" }]}>
              <Icon name={tip.icon} size={20} color={colors.primary} />
            </View>
            <Text
              style={[
                styles.tipLabel,
                { color: colors.foreground, textAlign: "center" },
              ]}
              numberOfLines={2}
            >
              {tip.label}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 8,
    gap: 12,
    width: "100%",
  },
  headerRow: {
    alignItems: "center",
    gap: 6,
    width: "100%",
  },
  sectionTitle: {
    fontSize: 15,
    fontFamily: "Tajawal_700Bold",
  },
  grid: {
    flexWrap: "wrap",
    gap: 10,
    justifyContent: "space-between",
    width: "100%",
  },
  tipCard: {
    width: "48%",
    paddingVertical: 14,
    paddingHorizontal: 10,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  tipLabel: {
    fontSize: 13,
    fontFamily: "Tajawal_500Medium",
    lineHeight: 18,
  },
});
