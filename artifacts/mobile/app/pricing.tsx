import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
  Modal,
  Pressable,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Icon } from "@/components/Icon";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContext";
import { useSubscription } from "@/lib/revenuecat";

export default function PricingScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, updatePremium } = useAuth();
  const { offerings, isSubscribed, isLoading, purchase, restore, isPurchasing, isRestoring } =
    useSubscription();
  const topPadding = Platform.OS === "web" ? 67 : insets.top;

  const [confirmVisible, setConfirmVisible] = useState(false);
  const [selectedPkg, setSelectedPkg] = useState<any>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const currentOffering = offerings?.current;
  const packages = currentOffering?.availablePackages ?? [];

  const handleUpgrade = (pkg: any) => {
    if (!user) {
      setStatusMsg("يجب تسجيل الدخول أولاً للاشتراك.");
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSelectedPkg(pkg);
    setConfirmVisible(true);
  };

  const confirmPurchase = async () => {
    if (!selectedPkg) return;
    setConfirmVisible(false);
    try {
      await purchase(selectedPkg);
      updatePremium(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setStatusMsg("تم الاشتراك بنجاح! 🎉 أصبحت الآن مشتركاً في الباقة المميزة.");
    } catch (err: any) {
      if (err?.userCancelled) return;
      setStatusMsg("حدث خطأ أثناء الاشتراك. حاول مرة أخرى.");
    }
  };

  const handleRestore = async () => {
    try {
      await restore();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setStatusMsg("تم استعادة مشترياتك السابقة ✓");
    } catch {
      setStatusMsg("لم يتم العثور على مشتريات سابقة.");
    }
  };

  const premiumFeatures = [
    "تحليلات غير محدودة يومياً",
    "بحث بالنص والصورة",
    "تحليل ملصقات المنتجات",
    "سجل كامل للتحليلات",
    "أولوية في المعالجة",
    "دعم متميز",
  ];

  const freeFeatures = [
    "10 تحليلات يومياً",
    "بحث بالنص",
    "تحليل الصور",
    "سجل التحليلات",
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPadding + 8, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Icon name="arrow-back" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.foreground }]}>الباقات</Text>
        <View style={{ width: 44 }} />
      </View>

      {isLoading || isPurchasing || isRestoring ? (
        <View style={styles.loadingCenter}>
          <ActivityIndicator color={colors.primary} size="large" />
          <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>
            {isPurchasing ? "جاري إتمام الاشتراك..." : isRestoring ? "جاري استعادة المشتريات..." : "جاري التحميل..."}
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60, gap: 16 }} showsVerticalScrollIndicator={false}>

          {/* Status message */}
          {statusMsg && (
            <View style={[styles.statusBox, { backgroundColor: statusMsg.includes("🎉") || statusMsg.includes("✓") ? colors.allowed + "20" : "#fdecea" }]}>
              <Text style={[styles.statusText, { color: statusMsg.includes("🎉") || statusMsg.includes("✓") ? colors.allowed : "#c0392b" }]}>
                {statusMsg}
              </Text>
              <TouchableOpacity onPress={() => setStatusMsg(null)}>
                <Icon name="close" size={16} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>
          )}

          {/* Free plan */}
          <View style={[styles.planCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.planName, { color: colors.foreground }]}>مجاني</Text>
            <View style={styles.priceRow}>
              <Text style={[styles.planAmount, { color: colors.foreground }]}>0</Text>
              <Text style={[styles.planCurrency, { color: colors.mutedForeground }]}> ريال / شهر</Text>
            </View>
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <Text style={[styles.limitBadge, { color: colors.primary, backgroundColor: colors.primary + "15" }]}>
              10 تحليلات يومياً
            </Text>
            {freeFeatures.map((f) => (
              <View key={f} style={styles.featureRow}>
                <Text style={[styles.featureText, { color: colors.mutedForeground }]}>{f}</Text>
                <Icon name="checkmark-circle" size={18} color={colors.allowed} />
              </View>
            ))}
            {!isSubscribed && (
              <View style={[styles.currentBadge, { backgroundColor: colors.muted }]}>
                <Text style={[styles.currentText, { color: colors.mutedForeground }]}>✓ خطتك الحالية</Text>
              </View>
            )}
          </View>

          {/* Premium plan(s) from RevenueCat */}
          {packages.length > 0 ? packages.map((pkg) => {
            const price = pkg.product.priceString;
            const period = pkg.product.subscriptionPeriod;
            const periodLabel = period === "P1M" ? "شهر" : period === "P1Y" ? "سنة" : period ?? "شهر";

            return (
              <View key={pkg.identifier} style={[styles.planCard, styles.premiumCard, { borderColor: colors.accent }]}>
                <LinearGradient
                  colors={[colors.accent + "22", colors.primary + "11"]}
                  style={StyleSheet.absoluteFill}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                />
                <View style={[styles.popularBadge, { backgroundColor: colors.accent }]}>
                  <Text style={styles.popularText}>الأكثر شيوعاً ⭐</Text>
                </View>
                <Icon name="star" size={32} color={colors.accent} />
                <Text style={[styles.planName, { color: colors.foreground, marginTop: 8 }]}>بريميوم</Text>
                <View style={styles.priceRow}>
                  <Text style={[styles.planAmount, { color: colors.accent }]}>{price}</Text>
                  <Text style={[styles.planCurrency, { color: colors.mutedForeground }]}> / {periodLabel}</Text>
                </View>
                <View style={[styles.divider, { backgroundColor: colors.accent + "40" }]} />
                <Text style={[styles.limitBadge, { color: colors.accent, backgroundColor: colors.accent + "15" }]}>
                  ∞ تحليلات غير محدودة
                </Text>
                {premiumFeatures.map((f) => (
                  <View key={f} style={styles.featureRow}>
                    <Text style={[styles.featureText, { color: colors.foreground }]}>{f}</Text>
                    <Icon name="checkmark-circle" size={18} color={colors.accent} />
                  </View>
                ))}
                {isSubscribed ? (
                  <View style={[styles.currentBadge, { backgroundColor: colors.accent + "30" }]}>
                    <Text style={[styles.currentText, { color: colors.accent }]}>✓ خطتك الحالية</Text>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={[styles.upgradeBtn, { backgroundColor: colors.accent }]}
                    onPress={() => handleUpgrade(pkg)}
                  >
                    <Text style={styles.upgradeBtnText}>اشترك الآن — {price}</Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          }) : (
            /* Fallback if RevenueCat offerings not loaded */
            <View style={[styles.planCard, styles.premiumCard, { borderColor: colors.accent }]}>
              <LinearGradient
                colors={[colors.accent + "22", colors.primary + "11"]}
                style={StyleSheet.absoluteFill}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              />
              <View style={[styles.popularBadge, { backgroundColor: colors.accent }]}>
                <Text style={styles.popularText}>الأكثر شيوعاً ⭐</Text>
              </View>
              <Icon name="star" size={32} color={colors.accent} />
              <Text style={[styles.planName, { color: colors.foreground, marginTop: 8 }]}>بريميوم</Text>
              <View style={[styles.divider, { backgroundColor: colors.accent + "40" }]} />
              <Text style={[styles.limitBadge, { color: colors.accent, backgroundColor: colors.accent + "15" }]}>
                ∞ تحليلات غير محدودة
              </Text>
              {premiumFeatures.map((f) => (
                <View key={f} style={styles.featureRow}>
                  <Text style={[styles.featureText, { color: colors.foreground }]}>{f}</Text>
                  <Icon name="checkmark-circle" size={18} color={colors.accent} />
                </View>
              ))}
              <View style={[styles.currentBadge, { backgroundColor: colors.muted }]}>
                <Text style={[styles.currentText, { color: colors.mutedForeground }]}>غير متوفر حالياً</Text>
              </View>
            </View>
          )}

          {/* Restore purchases */}
          <TouchableOpacity onPress={handleRestore} style={styles.restoreBtn}>
            <Text style={[styles.restoreText, { color: colors.mutedForeground }]}>استعادة المشتريات السابقة</Text>
          </TouchableOpacity>

        </ScrollView>
      )}

      {/* Purchase confirmation modal */}
      <Modal visible={confirmVisible} transparent animationType="fade" onRequestClose={() => setConfirmVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { backgroundColor: colors.card }]}>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>تأكيد الاشتراك</Text>
            <Text style={[styles.modalBody, { color: colors.mutedForeground }]}>
              سيتم خصم {selectedPkg?.product.priceString ?? ""} من حسابك عبر متجر التطبيقات.
            </Text>
            <View style={styles.modalButtons}>
              <Pressable
                style={[styles.modalBtn, { backgroundColor: colors.muted }]}
                onPress={() => setConfirmVisible(false)}
              >
                <Text style={[styles.modalBtnText, { color: colors.foreground }]}>إلغاء</Text>
              </Pressable>
              <Pressable
                style={[styles.modalBtn, { backgroundColor: colors.accent }]}
                onPress={confirmPurchase}
              >
                <Text style={[styles.modalBtnText, { color: "#fff" }]}>اشترك الآن</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
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
  loadingCenter: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  loadingText: { fontSize: 14, fontFamily: "Tajawal_400Regular" },
  statusBox: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 12,
    borderRadius: 12,
    gap: 8,
  },
  statusText: { flex: 1, fontSize: 14, fontFamily: "Tajawal_500Medium", textAlign: "right" },
  planCard: {
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
    gap: 10,
    overflow: "hidden",
  },
  premiumCard: { borderWidth: 2, position: "relative", paddingTop: 48 },
  popularBadge: {
    position: "absolute",
    top: 14,
    left: 14,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  popularText: { color: "#fff", fontSize: 11, fontFamily: "Tajawal_700Bold" },
  planName: { fontSize: 22, fontFamily: "Tajawal_700Bold", textAlign: "right" },
  priceRow: { flexDirection: "row", alignItems: "flex-end", justifyContent: "flex-end" },
  planAmount: { fontSize: 36, fontFamily: "Tajawal_700Bold" },
  planCurrency: { fontSize: 14, fontFamily: "Tajawal_400Regular", paddingBottom: 6 },
  divider: { height: 1, marginVertical: 4 },
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
  featureText: { fontSize: 14, fontFamily: "Tajawal_400Regular", flex: 1, textAlign: "right" },
  currentBadge: { padding: 10, borderRadius: 10, alignItems: "center", marginTop: 4 },
  currentText: { fontSize: 13, fontFamily: "Tajawal_700Bold" },
  upgradeBtn: { padding: 14, borderRadius: 14, alignItems: "center", marginTop: 4 },
  upgradeBtnText: { color: "#fff", fontFamily: "Tajawal_700Bold", fontSize: 16 },
  restoreBtn: { alignItems: "center", paddingVertical: 8 },
  restoreText: { fontSize: 13, fontFamily: "Tajawal_400Regular", textDecorationLine: "underline" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center", padding: 24 },
  modalBox: { borderRadius: 20, padding: 24, gap: 16, width: "100%" },
  modalTitle: { fontSize: 18, fontFamily: "Tajawal_700Bold", textAlign: "center" },
  modalBody: { fontSize: 14, fontFamily: "Tajawal_400Regular", textAlign: "center", lineHeight: 22 },
  modalButtons: { flexDirection: "row", gap: 12 },
  modalBtn: { flex: 1, padding: 14, borderRadius: 12, alignItems: "center" },
  modalBtnText: { fontFamily: "Tajawal_700Bold", fontSize: 15 },
});
