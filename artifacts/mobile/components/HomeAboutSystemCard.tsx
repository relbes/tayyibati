import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { Icon } from "@/components/Icon";
import { isRTL } from "@/lib/i18n";

export function HomeAboutSystemCard() {
  const router = useRouter();
  const rtl = isRTL();

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[
          styles.card,
          { flexDirection: rtl ? "row-reverse" : "row" },
        ]}
        activeOpacity={0.82}
        onPress={() => router.push("/about-system")}
      >
        {/* Leading Icon Circle */}
        <View style={styles.iconCircle}>
          <Icon name="tayyibat-system" size={28} color="#008C5A" />
        </View>

        {/* Text Content */}
        <View style={[styles.textContainer, { alignItems: rtl ? "flex-end" : "flex-start" }]}>
          <Text style={[styles.title, { textAlign: rtl ? "right" : "left" }]}>
            عن نظام الطيبات
          </Text>
          <Text style={[styles.description, { textAlign: rtl ? "right" : "left" }]}>
            تعرّف على نظام الطيبات وكيف يساعدك على اختيار الأطعمة المتوافقة معه.
          </Text>
        </View>

        {/* Trailing Chevron Button */}
        <View style={styles.chevronWrap}>
          <Icon
            name={rtl ? "chevron-back" : "chevron-forward"}
            size={14}
            color="#008C5A"
            strokeWidth={2.5}
          />
        </View>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 14,
    paddingHorizontal: 16,
    width: "100%",
  },
  card: {
    backgroundColor: "#F4FAF5",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#DCFCE7",
    paddingHorizontal: 16,
    paddingVertical: 14,
    alignItems: "center",
    gap: 12,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#DCFCE7",
    alignItems: "center",
    justifyContent: "center",
  },
  textContainer: {
    flex: 1,
    gap: 3,
  },
  title: {
    fontSize: 16.5,
    fontFamily: "Tajawal_700Bold",
    color: "#11674E",
  },
  description: {
    fontSize: 13,
    fontFamily: "Tajawal_500Medium",
    color: "#4B5563",
    lineHeight: 19,
  },
  chevronWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#DCFCE7",
    alignItems: "center",
    justifyContent: "center",
  },
});
