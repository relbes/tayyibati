import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Icon } from "@/components/Icon";
import { isRTL } from "@/lib/i18n";

export function HomeSearchEducation() {
  const rtl = isRTL();

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.banner,
          {
            flexDirection: rtl ? "row-reverse" : "row",
          },
        ]}
      >
        {/* Right side in RTL: Accuracy & Precision Icon */}
        <View style={styles.iconBox}>
          <Icon name="accuracy" size={32} color="#008C5A" />
        </View>

        {/* Text Container */}
        <View style={{ flex: 1 }}>
          <Text
            style={[
              styles.title,
              { textAlign: rtl ? "right" : "left" },
            ]}
          >
            للحصول على نتيجة أدق ...
          </Text>
          <Text
            style={[
              styles.desc,
              { textAlign: rtl ? "right" : "left" },
            ]}
          >
            ابحث باستخدام الاسم الدقيق للطعام، أو جرب تصويره أو مسح الباركود للتعرف على مكوناته.
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 16,
    paddingHorizontal: 16,
    width: "100%",
  },
  banner: {
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    backgroundColor: "#F0FDF4",
    borderColor: "#DCFCE7",
    alignItems: "center",
    gap: 12,
  },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#DCFCE7",
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 16.5,
    fontFamily: "Tajawal_700Bold",
    color: "#11674E",
    marginBottom: 4,
  },
  desc: {
    fontSize: 13.5,
    fontFamily: "Tajawal_500Medium",
    color: "#4B5563",
    lineHeight: 20,
  },
});
