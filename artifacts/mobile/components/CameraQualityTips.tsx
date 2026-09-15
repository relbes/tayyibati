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
        <Icon name="information-circle-outline" size={22} color="#008C5A" strokeWidth={2.2} />
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
            <View style={[styles.iconCircle, { backgroundColor: "#E6F6F0" }]}>
              <Icon name={tip.icon} size={24} color="#008C5A" />
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
    gap: 8,
    width: "100%",
  },
  sectionTitle: {
    fontSize: 17,
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
    paddingVertical: 16,
    paddingHorizontal: 10,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  tipLabel: {
    fontSize: 14.5,
    fontFamily: "Tajawal_700Bold",
    lineHeight: 20,
  },
});
