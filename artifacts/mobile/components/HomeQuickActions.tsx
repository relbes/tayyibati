import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, Alert, Image } from "react-native";
import { Icon } from "@/components/Icon";
import { isRTL } from "@/lib/i18n";
import { useRouter } from "expo-router";

interface Props {
  focusSearch?: () => void;
}

export function HomeQuickActions({ focusSearch }: Props) {
  const router = useRouter();
  const rtl = isRTL();

  return (
    <View style={styles.container}>
      {/* 1. Two Equal Quick Action Cards Side-by-Side */}
      <View style={[styles.actionsRow, { flexDirection: rtl ? "row-reverse" : "row" }]}>
        {/* Card 1: افحص طعامك */}
        <TouchableOpacity
          style={[styles.actionCard, styles.cameraCard]}
          activeOpacity={0.82}
          onPress={() => router.push("/(tabs)/camera")}
        >
          <View style={styles.iconContainer}>
            <Icon name="camera" size={36} color="#008C5A" />
          </View>

          <Text style={[styles.actionTitle, { textAlign: rtl ? "right" : "left" }]}>
            افحص طعامك
          </Text>
          <Text style={[styles.actionSubtitle, { textAlign: rtl ? "right" : "left" }]}>
            باستخدام الكاميرا
          </Text>

          <View style={styles.cardArrowCircleAmber}>
            <Icon name={rtl ? "chevron-back" : "chevron-forward"} size={14} color="#F59E0B" strokeWidth={2.5} />
          </View>
        </TouchableOpacity>

        {/* Card 2: امسح الباركود */}
        <TouchableOpacity
          style={[styles.actionCard, styles.barcodeCard]}
          activeOpacity={0.82}
          onPress={() => {
            Alert.alert(
              "هذه الخاصية غير متاحة حاليا",
              "قريباً سيتم تفعيل هذه الخاصية للاشتراك البريميوم"
            );
          }}
        >
          <View style={styles.iconContainer}>
            <Icon name="scan-barcode" size={36} color="#008C5A" strokeWidth={2.2} />
          </View>

          <Text style={[styles.actionTitle, { textAlign: rtl ? "right" : "left" }]}>
            امسح الباركود
          </Text>
          <Text style={[styles.actionSubtitle, { textAlign: rtl ? "right" : "left" }]}>
            للتحقق السريع
          </Text>

          <View style={styles.cardArrowCircleGreen}>
            <Icon name={rtl ? "chevron-back" : "chevron-forward"} size={14} color="#008C5A" strokeWidth={2.5} />
          </View>
        </TouchableOpacity>
      </View>

      {/* 2. Single Wide Horizontal "تصفح الفئات" Card */}
      <TouchableOpacity
        style={[styles.categoryCard, { flexDirection: rtl ? "row-reverse" : "row" }]}
        activeOpacity={0.85}
        onPress={() => router.push("/(tabs)/browse")}
      >
        {/* Right side: Fresh Produce Visual */}
        <Image
          source={require("@/assets/images/browse_produce.png")}
          style={styles.produceImage}
          resizeMode="contain"
        />

        {/* Center: Title & Subtitle */}
        <View style={styles.categoryTextContainer}>
          <Text style={[styles.categoryTitle, { textAlign: rtl ? "right" : "left" }]}>
            تصفح الفئات
          </Text>
          <Text style={[styles.categorySubtitle, { textAlign: rtl ? "right" : "left" }]}>
            قائمة المسموحات والممنوعات
          </Text>
        </View>

        {/* Left side: Circular Arrow on far left, Document Icon next to it */}
        <View style={styles.categoryLeftActions}>
          <View style={styles.staticArrowCircle}>
            <Icon name={rtl ? "chevron-back" : "chevron-forward"} size={14} color="#008C5A" strokeWidth={2.5} />
          </View>
          <View style={styles.docIconBox}>
            <Icon name="document-text-outline" size={20} color="#008C5A" strokeWidth={2} />
          </View>
        </View>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    paddingHorizontal: 16,
    marginTop: 14,
    gap: 12,
  },
  actionsRow: {
    justifyContent: "space-between",
    gap: 12,
  },
  actionCard: {
    flex: 1,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#DCFCE7",
    paddingVertical: 16,
    paddingHorizontal: 14,
    alignItems: "center",
    position: "relative",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  cameraCard: {
    backgroundColor: "#FDFBF7",
  },
  barcodeCard: {
    backgroundColor: "#FFFFFF",
  },
  iconContainer: {
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  actionTitle: {
    fontSize: 16.5,
    fontFamily: "Tajawal_700Bold",
    color: "#11674E",
    marginBottom: 2,
  },
  actionSubtitle: {
    fontSize: 13,
    fontFamily: "Tajawal_500Medium",
    color: "#4B5563",
  },
  cardArrowCircleAmber: {
    position: "absolute",
    bottom: 12,
    left: 10,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#FEF3C7",
    alignItems: "center",
    justifyContent: "center",
  },
  cardArrowCircleGreen: {
    position: "absolute",
    bottom: 12,
    left: 10,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#DCFCE7",
    alignItems: "center",
    justifyContent: "center",
  },
  categoryCard: {
    width: "100%",
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#DCFCE7",
    paddingHorizontal: 14,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "space-between",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  produceImage: {
    width: 70,
    height: 52,
  },
  categoryTextContainer: {
    flex: 1,
    marginHorizontal: 10,
    justifyContent: "center",
  },
  categoryTitle: {
    fontSize: 16.5,
    fontFamily: "Tajawal_700Bold",
    color: "#111827",
    marginBottom: 2,
  },
  categorySubtitle: {
    fontSize: 13,
    fontFamily: "Tajawal_500Medium",
    color: "#4B5563",
  },
  categoryLeftActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  staticArrowCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#DCFCE7",
    alignItems: "center",
    justifyContent: "center",
  },
  docIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#F0FDF4",
    borderWidth: 1,
    borderColor: "#DCFCE7",
    alignItems: "center",
    justifyContent: "center",
  },
});