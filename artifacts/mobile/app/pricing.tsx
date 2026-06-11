import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContext";
import { getPlans, enrollUserPlan, getPublicConfig } from "@/lib/api";

interface Plan {
  id: number;
  name: string;
  nameEn: string;
  dailyLimit: number;
  price: string;
  currency: string;
  billingCycle: string;
  features: string;
  isActive: string;
  sortOrder: number;
}

export default function PricingScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, updatePremium, refreshUser } = useAuth();
  const topPadding = Platform.OS === "web" ? 67 : insets.top;
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [subscriptionEnabled, setSubscriptionEnabled] = useState(true);

  useEffect(() => {
    getPublicConfig()
      .then((cfg) => setSubscriptionEnabled(cfg.subscription_enabled !== "false"))
      .catch(() => {});
    getPlans()
      .then((data: Plan[]) => setPlans(data.filter((p) => p.isActive === "true")))
      .catch(() => {
        setPlans([
          {
            id: 0,
            name: "مجاني",
            nameEn: "Free",
            dailyLimit: 10,
            price: "0",
            currency: "SAR",
            billingCycle: "free",
            features: JSON.stringify(["10 تحليلات يومياً", "بحث بالنص", "تحليل الصور", "مسح الملصقات", "سجل التحليلات"]),
            isActive: "true",
            sortOrder: 0,
          },
          {
            id: -1,
            name: "بريميوم",
            nameEn: "Premium",
            dailyLimit: -1,
            price: "9.99",
            currency: "SAR",
            billingCycle: "monthly",
            features: JSON.stringify(["تحليلات غير محدودة", "بحث بالنص", "تحليل الصور", "مسح الملصقات", "سجل كامل", "أولوية معالجة", "دعم متميز"]),
            isActive: "true",
            sortOrder: 1,
          },
        ]);
      })
      .finally(() => setLoading(false));
  }, []);

  const isPremiumPlan = (plan: Plan) => plan.dailyLimit < 0 || plan.dailyLimit > 20;

  const getFeatures = (plan: Plan): string[] => {
    try {
      const parsed = JSON.parse(plan.features);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return plan.features ? plan.features.split(",").map((f) => f.trim()) : [];
    }
  };

  const handleUpgrade = (plan: Plan) => {
    if (!subscriptionEnabled) {
      Alert.alert("غير متوفر", "خاصية الاشتراك معطلة حالياً. حاول لاحقاً.");
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (!user) {
      Alert.alert(
        "تسجيل الدخول مطلوب",
        "يجب تسجيل الدخول أولاً للاشتراك في باقة بريميوم",
        [
          { text: "إلغاء", style: "cancel" },
          { text: "تسجيل الدخول", onPress: () => router.push("/auth") },
        ]
      );
      return;
    }
    const price = parseFloat(plan.price) > 0
      ? `${plan.price} ${plan.currency} / ${plan.billingCycle === "monthly" ? "شهر" : "سنة"}`
      : "مجاناً";
    Alert.alert(
      `الاشتراك في ${plan.name}`,
      `سيتم الاشتراك في الخطة مقابل ${price}`,
      [
        { text: "إلغاء", style: "cancel" },
        {
          text: "اشترك الآن",
          onPress: async () => {
            updatePremium(true);
            try {
              await enrollUserPlan(user.id, plan.id, true);
              await refreshUser();
            } catch {
              // local premium still applied; backend sync can retry later
            }
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            Alert.alert("تم الاشتراك ✓", `أصبحت الآن مشتركاً في خطة ${plan.name}!`);
            router.back();
          },
        },
      ]
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPadding + 8, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.foreground }]}>الباقات</Text>
        <View style={{ width: 44 }} />
      </View>

      {loading ? (
        <View style={styles.loadingCenter}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 60, gap: 16 }}
          showsVerticalScrollIndicator={false}
        >
          {plans.map((plan, idx) => {
            const isPremium = isPremiumPlan(plan);
            const features = getFeatures(plan);
            const isCurrentPlan = isPremium ? !!user?.isPremium : !user?.isPremium;
            const priceNum = parseFloat(plan.price);

            return isPremium ? (
              <View
                key={plan.id}
                style={[styles.planCard, styles.premiumCard, { borderColor: colors.accent }]}
              >
                <LinearGradient
                  colors={[colors.accent + "22", colors.primary + "11"]}
                  style={StyleSheet.absoluteFill}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                />
                <View style={[styles.popularBadge, { backgroundColor: colors.accent }]}>
                  <Text style={styles.popularText}>الأكثر شيوعاً ⭐</Text>
                </View>
                <Ionicons name="star" size={32} color={colors.accent} style={{ marginTop: 24 }} />
                <Text style={[styles.planName, { color: colors.foreground }]}>{plan.name}</Text>
                {priceNum > 0 ? (
                  <Text style={[styles.planPrice, { color: colors.foreground }]}>
                    <Text style={[styles.planAmount, { color: colors.accent }]}>{plan.price}</Text>
                    <Text style={[styles.planCurrency, { color: colors.mutedForeground }]}>
                      {" "}{plan.currency} / {plan.billingCycle === "monthly" ? "شهر" : "سنة"}
                    </Text>
                  </Text>
                ) : (
                  <Text style={[styles.planPrice, { color: colors.mutedForeground }]}>مجاناً</Text>
                )}
                <View style={[styles.divider, { backgroundColor: colors.accent + "40" }]} />
                <Text style={[styles.limitBadge, { color: colors.accent, backgroundColor: colors.accent + "15" }]}>
                  {plan.dailyLimit < 0 ? "∞ تحليلات غير محدودة" : `${plan.dailyLimit} تحليل يومياً`}
                </Text>
                {features.map((f) => (
                  <View key={f} style={styles.featureRow}>
                    <Text style={[styles.featureText, { color: colors.foreground }]}>{f}</Text>
                    <Ionicons name="checkmark-circle" size={18} color={colors.accent} />
                  </View>
                ))}
                {isCurrentPlan ? (
                  <View style={[styles.currentBadge, { backgroundColor: colors.accent + "30" }]}>
                    <Text style={[styles.currentText, { color: colors.accent }]}>✓ خطتك الحالية</Text>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={[styles.upgradeBtn, { backgroundColor: colors.accent }]}
                    onPress={() => handleUpgrade(plan)}
                  >
                    <Text style={styles.upgradeBtnText}>اشترك الآن</Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : (
              <View
                key={plan.id}
                style={[styles.planCard, { backgroundColor: colors.card, borderColor: colors.border }]}
              >
                <Text style={[styles.planName, { color: colors.foreground }]}>{plan.name}</Text>
                <Text style={[styles.planPrice, { color: colors.foreground }]}>
                  <Text style={styles.planAmount}>0</Text>
                  <Text style={[styles.planCurrency, { color: colors.mutedForeground }]}> ريال / شهر</Text>
                </Text>
                <View style={styles.divider} />
                <Text style={[styles.limitBadge, { color: colors.primary, backgroundColor: colors.primary + "15" }]}>
                  {plan.dailyLimit} تحليل يومياً
                </Text>
                {features.map((f) => (
                  <View key={f} style={styles.featureRow}>
                    <Text style={[styles.featureText, { color: colors.mutedForeground }]}>{f}</Text>
                    <Ionicons name="checkmark-circle" size={18} color={colors.allowed} />
                  </View>
                ))}
                {isCurrentPlan && (
                  <View style={[styles.currentBadge, { backgroundColor: colors.muted }]}>
                    <Text style={[styles.currentText, { color: colors.mutedForeground }]}>✓ خطتك الحالية</Text>
                  </View>
                )}
              </View>
            );
          })}
        </ScrollView>
      )}
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
  backBtn: { width: 44, alignItems: "flex-start" },
  title: { fontSize: 18, fontFamily: "Tajawal_700Bold", textAlign: "center" },
  loadingCenter: { flex: 1, alignItems: "center", justifyContent: "center" },
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
  popularText: { color: "#fff", fontSize: 11, fontFamily: "Tajawal_700Bold" },
  planName: { fontSize: 22, fontFamily: "Tajawal_700Bold", textAlign: "right", marginTop: 8 },
  planPrice: { textAlign: "right" },
  planAmount: { fontSize: 36, fontFamily: "Tajawal_700Bold" },
  planCurrency: { fontSize: 14, fontFamily: "Tajawal_400Regular" },
  divider: { height: 1, backgroundColor: "#e5e5e5", marginVertical: 4 },
  limitBadge: {
    fontSize: 13,
    fontFamily: "Tajawal_700Bold",
    textAlign: "center",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    overflow: "hidden",
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 10,
  },
  featureText: {
    fontSize: 14,
    fontFamily: "Tajawal_400Regular",
    flex: 1,
    textAlign: "right",
  },
  currentBadge: {
    padding: 10,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 4,
  },
  currentText: { fontSize: 13, fontFamily: "Tajawal_700Bold" },
  upgradeBtn: {
    padding: 14,
    borderRadius: 14,
    alignItems: "center",
    marginTop: 4,
  },
  upgradeBtnText: { color: "#fff", fontFamily: "Tajawal_700Bold", fontSize: 16 },
});
