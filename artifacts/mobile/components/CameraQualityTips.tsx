import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Icon } from "@/components/Icon";
import { isRTL } from "@/lib/i18n";

export function CameraQualityTips() {
  const rtl = isRTL();

  // Row 1: Right = Card 1, Left = Card 2
  // Row 2: Right = Card 4, Left = Card 3
  const row1 = [
    {
      title: "إضاءة جيدة",
      description: "احرص على إضاءة جيدة للحصول على نتيجة أدق",
      icon: "bulb",
      iconColor: "#D97706",
      iconBg: "#FEF3C7",
    },
    {
      title: "صورة واضحة",
      description: "تأكد من وضوح الصورة وجودة الإضاءة",
      icon: "camera",
      iconColor: "#059669",
      iconBg: "#DCFCE7",
    },
  ];

  const row2 = [
    {
      title: "قرب الكاميرا",
      description: "اقترب من الطبق للحصول على تفاصيل أوضح",
      icon: "search",
      iconColor: "#0284C7",
      iconBg: "#E0F2FE",
    },
    {
      title: "أظهر جميع المكونات",
      description: "حاول تصوير جميع مكونات الوجبة",
      icon: "image",
      iconColor: "#7C3AED",
      iconBg: "#EDE9FE",
    },
  ];

  const renderCard = (card: typeof row1[0], idx: number) => (
    <View key={idx} style={styles.tipCard}>
      {/* Text block */}
      <View style={styles.cardTextCol}>
        <Text style={styles.cardTitle}>{card.title}</Text>
        <Text style={styles.cardDescription}>{card.description}</Text>
      </View>
      {/* Icon Circle */}
      <View style={[styles.iconCircle, { backgroundColor: card.iconBg }]}>
        <Icon name={card.icon} size={20} color={card.iconColor} strokeWidth={2} />
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Section Heading with decorative green accent lines */}
      <View style={styles.headingContainer}>
        <View style={styles.headingAccentLine} />
        <Text style={styles.headingTitle}>نصائح للحصول على أفضل نتيجة</Text>
        <View style={styles.headingAccentLine} />
      </View>

      {/* Row 1 */}
      <View style={[styles.cardRow, { flexDirection: rtl ? "row" : "row-reverse" }]}>
        {row1.map(renderCard)}
      </View>

      {/* Row 2 */}
      <View style={[styles.cardRow, { flexDirection: rtl ? "row" : "row-reverse" }]}>
        {row2.map(renderCard)}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 8,
    gap: 10,
    width: "100%",
  },
  headingContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    marginBottom: 2,
  },
  headingAccentLine: {
    width: 26,
    height: 3.5,
    borderRadius: 2,
    backgroundColor: "#16A34A",
  },
  headingTitle: {
    fontSize: 16.5,
    fontFamily: "Tajawal_700Bold",
    color: "#0F4F38",
    textAlign: "center",
  },
  cardRow: {
    gap: 10,
    width: "100%",
  },
  tipCard: {
    flex: 1,
    minHeight: 78,
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#EEF3EF",
    paddingVertical: 10,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1.5 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1.5,
  },
  cardTextCol: {
    flex: 1,
    alignItems: "flex-end",
    justifyContent: "center",
  },
  cardTitle: {
    fontSize: 14,
    fontFamily: "Tajawal_700Bold",
    color: "#1F2937",
    textAlign: "right",
    marginBottom: 3,
  },
  cardDescription: {
    fontSize: 11.5,
    fontFamily: "Tajawal_400Regular",
    color: "#6B7280",
    textAlign: "right",
    lineHeight: 16,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
});
