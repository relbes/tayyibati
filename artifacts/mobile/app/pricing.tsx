import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContext";

const FREE_FEATURES = [
  "10 تحليلات يومياً",
  "بحث بالنص",
  "تحليل الصور",
  "مسح ملصقات المنتجات",
  "سجل التحليلات",
];

const PREMIUM_FEATURES = [
  "تحليلات غير محدودة",
  "بحث بالنص",
  "تحليل الصور",
  "مسح ملصقات المنتجات",
  "سجل كامل",
  "أولوية في المعالجة",
  "دعم متميز",
];

export default function PricingScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, updatePremium } = useAuth();
  const topPadding = Platform.OS === "web" ? 67 : insets.top;

  const handleUpgrade = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      "الترقية لـ Premium",
      "سيتم الاشتراك في الخطة المميزة مقابل 9.99 ريال / شهر",
      [
        { text: "إلغاء", style: "cancel" },
        {
          text: "اشترك الآن",
          onPress: () => {
            if (user) updatePremium(true);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            Alert.alert("تم الاشتراك", "أصبحت الآن مشتركاً في الخطة المميزة!");
            router.back();
          },
        },
      ]
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPadding + 8, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.foreground }]}>الباقات</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60, gap: 16 }} showsVerticalScrollIndicator={false}>
        {/* Free Plan */}
        <View style={[styles.planCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.planName, { color: colors.foreground }]}>مجاني</Text>
          <Text style={[styles.planPrice, { color: colors.foreground }]}>
            <Text style={styles.planAmount}>0</Text>
            <Text style={[styles.planCurrency, { color: colors.mutedForeground }]}> ريال / شهر</Text>
          </Text>
          <View style={styles.divider} />
          {FREE_FEATURES.map((f) => (
            <View key={f} style={styles.featureRow}>
              <Text style={[styles.featureText, { color: colors.mutedForeground }]}>{f}</Text>
              <Ionicons name="checkmark-circle" size={18} color={colors.allowed} />
            </View>
          ))}
          <View style={[styles.currentBadge, { backgroundColor: colors.muted }]}>
            <Text style={[styles.currentText, { color: colors.mutedForeground }]}>خطتك الحالية</Text>
          </View>
        </View>

        {/* Premium Plan */}
        <View style={[styles.planCard, styles.premiumCard, { borderColor: colors.accent }]}>
          <LinearGradient
            colors={[colors.accent + "22", colors.primary + "11"]}
            style={StyleSheet.absoluteFill}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          />
          <View style={[styles.popularBadge, { backgroundColor: colors.accent }]}>
            <Text style={styles.popularText}>الأكثر شيوعاً</Text>
          </View>
          <Ionicons name="star" size={32} color={colors.accent} />
          <Text style={[styles.planName, { color: colors.foreground }]}>Premium</Text>
          <Text style={[styles.planPrice, { color: colors.foreground }]}>
            <Text style={[styles.planAmount, { color: colors.accent }]}>9.99</Text>
            <Text style={[styles.planCurrency, { color: colors.mutedForeground }]}> ريال / شهر</Text>
          </Text>
          <View style={[styles.divider, { backgroundColor: colors.accent + "30" }]} />
          {PREMIUM_FEATURES.map((f) => (
            <View key={f} style={styles.featureRow}>
              <Text style={[styles.featureText, { color: colors.foreground }]}>{f}</Text>
              <Ionicons name="checkmark-circle" size={18} color={colors.accent} />
            </View>
          ))}
          {!user?.isPremium && (
            <TouchableOpacity style={[styles.upgradeBtn, { backgroundColor: colors.accent }]} onPress={handleUpgrade}>
              <Text style={styles.upgradeBtnText}>اشترك الآن</Text>
            </TouchableOpacity>
          )}
          {user?.isPremium && (
            <View style={[styles.currentBadge, { backgroundColor: colors.accent + "30" }]}>
              <Text style={[styles.currentText, { color: colors.accent }]}>خطتك الحالية</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  title: { fontSize: 18, fontFamily: "Inter_700Bold", textAlign: "center" },
  planCard: {
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
    gap: 10,
    overflow: "hidden",
  },
  premiumCard: {
    borderWidth: 2,
    position: "relative",
  },
  popularBadge: {
    position: "absolute",
    top: 14,
    left: 14,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  popularText: {
    color: "#fff",
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
  },
  planName: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    textAlign: "right",
    marginTop: 8,
  },
  planPrice: {
    textAlign: "right",
  },
  planAmount: {
    fontSize: 36,
    fontFamily: "Inter_700Bold",
  },
  planCurrency: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
  divider: {
    height: 1,
    backgroundColor: "#e5e5e5",
    marginVertical: 4,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 10,
  },
  featureText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    flex: 1,
    textAlign: "right",
  },
  currentBadge: {
    padding: 10,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 4,
  },
  currentText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
  upgradeBtn: {
    padding: 14,
    borderRadius: 14,
    alignItems: "center",
    marginTop: 4,
  },
  upgradeBtnText: {
    color: "#fff",
    fontFamily: "Inter_700Bold",
    fontSize: 16,
  },
});
