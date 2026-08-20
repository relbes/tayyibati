import React, { useState, useEffect } from "react";
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
import { BackButton } from "@/components/BackButton";
import { HeaderNatureBackground } from "@/components/HeaderNatureBackground";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContext";
import Purchases from "react-native-purchases";
import { useSubscription, loginRevenueCat, REVENUECAT_ENTITLEMENT_IDENTIFIER } from "@/lib/revenuecat";
import { syncPremium, getPlans } from "@/lib/api";
import { isRTL } from "@/lib/i18n";
import { TayyibatiTheme } from "@/constants/tayyibatiTheme";


interface Plan {
  id: number;
  nameAr: string;
  nameEn: string;
  price: string;
  currency: string;
  billingCycle: string;
  descriptionAr: string | null;
  descriptionEn: string | null;
  featuresAr: string[];
  featuresEn: string[];
  dailyLimit: number;
  dailyTextLimit: number;
  dailyImageLimit: number;
  isPopular: boolean;
  sortOrder: number;
  revenueCatProductId: string | null;
  revenueCatEntitlementId: string | null;
}

export default function PricingScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, refreshUser } = useAuth();
  const { offerings, isSubscribed, isLoading, purchase, restore, isPurchasing, isRestoring } =
    useSubscription();
  const topPadding = Platform.OS === "web" ? 67 : insets.top;
  const rtl = isRTL();
  const hasPremium = user?.isPremium === true;

  const [confirmVisible, setConfirmVisible] = useState(false);
  const [selectedPkg, setSelectedPkg] = useState<any>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);

  const currentOffering = offerings?.current;
  const packages = currentOffering?.availablePackages ?? [];

  useEffect(() => {
    getPlans()
      .then((plans: Plan[]) => {
        setPlans(plans);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    refreshUser().catch(() => {});
  }, [refreshUser]);

  const defaultPremiumPlan = plans.find((pl) => pl.billingCycle !== "free");
  const displayPrice = defaultPremiumPlan
    ? `${defaultPremiumPlan.price} ${defaultPremiumPlan.currency}`
    : "$1.99";

  const handleUpgrade = (pkg: any) => {
    if (!user) {
      setStatusMsg("يجب تسجيل الدخول أولاً للاشتراك.");
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSelectedPkg(pkg);
    setConfirmVisible(true);
  };

  const handleUpgradeFallback = () => {
    if (!user) {
      setStatusMsg("يجب تسجيل الدخول أولاً للاشتراك.");
      return;
    }
    setStatusMsg("الاشتراك غير متاح حالياً عبر متجر التطبيقات.");
  };

  const confirmPurchase = async () => {
    if (!selectedPkg) return;
    setConfirmVisible(false);
    try {
      // 0. Ensure Customer ID Binding
      let loggedInCustomerInfo = null;
      if (user?.id) {
        loggedInCustomerInfo = await loginRevenueCat(user.id);
      }

      // 1. Execute RevenueCat Purchase
      const purchasedCustomerInfo = await purchase(selectedPkg);

      // 2. Synchronize with Tayyibati Backend passing diagnostics
      const activeSubs = purchasedCustomerInfo?.activeSubscriptions || [];
      const activeEnts = Object.keys(purchasedCustomerInfo?.entitlements?.active || {});
      const origAppUserId = purchasedCustomerInfo?.originalAppUserId;

      let syncResult = null;
      try {
        syncResult = await syncPremium({
          appUserId: user?.id,
          originalAppUserId: origAppUserId,
          activeSubscriptions: activeSubs,
          activeEntitlements: activeEnts,
        });
        await refreshUser();
      } catch (syncErr) {
        console.warn("[Pricing] Sync after purchase failed:", syncErr);
        setStatusMsg("تم الشراء بنجاح عبر المتجر، ولكن تعذر تحديث الحساب. اضغط 'استعادة المشتريات السابقة' للتفعيل.");
        return;
      }

      // 3. Confirm isPremium was granted server-side
      if (syncResult?.isPremium || user?.isPremium) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setStatusMsg("تم الاشتراك بنجاح! 🎉 أصبحت الآن مشتركاً في الباقة المميزة.");
      } else {
        const reasonMsg = syncResult?.diagnostic?.reason || "الاشتراك في انتظار المزامنة.";
        setStatusMsg(`تم الشراء بنجاح، ولكن تعذر الربط: ${reasonMsg}`);
      }
    } catch (err: any) {
      // 1. Check if error indicates subscription is already owned on Google Play
      const isAlreadyPurchased =
        err?.code === 6 ||
        err?.code === "PRODUCT_ALREADY_PURCHASED" ||
        String(err?.message || "").toLowerCase().includes("already") ||
        String(err?.message || "").toLowerCase().includes("subscribed") ||
        String(err?.name || "").includes("ProductAlreadyPurchased");

      if (isAlreadyPurchased) {
        console.log("[Pricing] Subscription is already owned on Google Play. Auto-triggering handleRestore()...");
        setStatusMsg("ملاحظة: هذا الحساب يملك اشتراكاً فعالاً على المتجر. جاري استعادة الاشتراك وتفعيله بحسابك تلقائياً...");
        await handleRestore();
        return;
      }

      // 2. Only ignore pure user cancellation (e.g. user manually cancelled credit card dialog)
      if (err?.userCancelled) return;

      setStatusMsg(`حدث خطأ أثناء الاشتراك: ${err?.message || "حاول مرة أخرى."}`);
    }
  };

  const handleRestore = async () => {
    try {
      if (user?.id) {
        console.log(`[Pricing Restore] Step 1: Binding RevenueCat user ID: '${user.id}'`);
        await loginRevenueCat(user.id);
      }

      const currentRcAppUserId = await Purchases.getAppUserID();
      console.log(`[Pricing Restore] Step 2: Executing Purchases.restorePurchases(). AppUserID: '${currentRcAppUserId}'`);
      const customerInfo = await restore();

      const activeSubs = customerInfo?.activeSubscriptions || [];
      const activeEnts = Object.keys(customerInfo?.entitlements?.active || {});
      const origAppUserId = customerInfo?.originalAppUserId;
      const entitlementObj = customerInfo?.entitlements?.active?.[REVENUECAT_ENTITLEMENT_IDENTIFIER] || null;
      const productIdentifier = entitlementObj?.productIdentifier || activeSubs[0] || null;

      console.log(`[Pricing Restore] Step 3: Diagnostic Data Logged:`);
      console.log(`  - Tayyibati User ID: '${user?.id}'`);
      console.log(`  - RevenueCat Current App User ID: '${currentRcAppUserId}'`);
      console.log(`  - RevenueCat Original App User ID: '${origAppUserId}'`);
      console.log(`  - Active Subscriptions: ${JSON.stringify(activeSubs)}`);
      console.log(`  - Active Entitlements: ${JSON.stringify(activeEnts)}`);
      console.log(`  - Active Entitlement Identifier: '${REVENUECAT_ENTITLEMENT_IDENTIFIER}'`);
      console.log(`  - Product Identifier: '${productIdentifier}'`);

      // Step 4: Trigger Backend Sync
      console.log("[Pricing Restore] Step 4: Calling /api/users/me/sync-premium...");
      let syncResult = null;
      try {
        syncResult = await syncPremium({
          appUserId: currentRcAppUserId,
          originalAppUserId: origAppUserId,
          activeSubscriptions: activeSubs,
          activeEntitlements: activeEnts,
        });
        console.log(`[Pricing Restore] Step 5: sync-premium API response: ${JSON.stringify(syncResult)}`);
        await refreshUser();
      } catch (syncErr: any) {
        console.warn("[Pricing Restore] Backend sync after restore failed:", syncErr);
      }

      console.log(`[Pricing Restore] Step 6: Final User Premium State -> user.isPremium: ${user?.isPremium}, user.planId: ${user?.planId}, syncIsPremium: ${syncResult?.isPremium}`);

      if (syncResult?.isPremium || user?.isPremium) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setStatusMsg("تم استعادة وتأكيد اشتراكك بنجاح ✓");
      } else {
        const diag = syncResult?.diagnostic;
        if (diag?.reason) {
          setStatusMsg(`نتائج الاستعادة: ${diag.reason}`);
        } else if (activeSubs.length > 0 || activeEnts.length > 0) {
          setStatusMsg(`تم العثور على اشتراك (${activeSubs.join(", ")}), ولكن تعذر ربطه بالمستخدم (${user?.id}). (Original User: ${origAppUserId})`);
        } else {
          setStatusMsg(`لم يرجع المتجر أي اشتراك فعّال للمستخدم (${user?.id}). (Original AppUserID: ${origAppUserId})`);
        }
      }
    } catch (err: any) {
      console.error("[Pricing Restore] Restore purchases exception:", err);
      setStatusMsg(`خطأ أثناء استعادة المشتريات: ${err?.message || "تعذر الاتصال بالمتجر"}`);
    }
  };

  const freePlan = plans.find((p) => p.billingCycle === "free");
  const premiumPlans = plans.filter((p) => p.billingCycle !== "free");

  const freePlanName = freePlan ? (rtl ? freePlan.nameAr : freePlan.nameEn) : "مجاني";
  const freePlanDescription = freePlan
    ? (rtl ? (freePlan.descriptionAr || freePlan.descriptionEn) : (freePlan.descriptionEn || freePlan.descriptionAr))
    : null;
  const freePlanFeaturesList = freePlan
    ? (rtl
        ? (freePlan.featuresAr && freePlan.featuresAr.length > 0 ? freePlan.featuresAr : freePlan.featuresEn)
        : (freePlan.featuresEn && freePlan.featuresEn.length > 0 ? freePlan.featuresEn : freePlan.featuresAr)) || []
    : [];
  const freeLimitText = freePlan
    ? (rtl
        ? `${freePlan.dailyTextLimit} نصي + ${freePlan.dailyImageLimit} صور / يوم`
        : `${freePlan.dailyTextLimit} text + ${freePlan.dailyImageLimit} image / day`)
    : "15 نصي + 3 صور / شهر";

  const isFreeCurrent = freePlan ? (user?.planId === freePlan.id || (!user?.planId && !hasPremium)) : !hasPremium;

  const PremiumCard = ({ plan, pkg }: { plan: Plan | null; pkg?: any }) => {
    const planName = plan ? (rtl ? plan.nameAr : plan.nameEn) : (rtl ? "بريميوم" : "Premium");
    const planDescription = plan
      ? (rtl ? (plan.descriptionAr || plan.descriptionEn) : (plan.descriptionEn || plan.descriptionAr))
      : null;
    const planPrice = plan ? `${plan.price} ${plan.currency}` : "$1.99";
    const planFeatures = plan
      ? (rtl
          ? (plan.featuresAr && plan.featuresAr.length > 0 ? plan.featuresAr : plan.featuresEn)
          : (plan.featuresEn && plan.featuresEn.length > 0 ? plan.featuresEn : plan.featuresAr)) || []
      : [];
    const isPopular = plan ? plan.isPopular : true;
    const isCurrentPlan = plan
      ? (user?.planId === plan.id || (!user?.planId && hasPremium && plan.billingCycle !== "free"))
      : hasPremium;

    return (
      <View style={[styles.planCard, styles.premiumCard, { borderColor: colors.accent, alignItems: rtl ? "flex-end" : "flex-start" }]}>
        <LinearGradient
          colors={[colors.accent + "22", colors.primary + "11"]}
          style={StyleSheet.absoluteFill}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
        {isPopular && (
          <View
            style={[
              styles.popularBadge,
              {
                backgroundColor: colors.accent,
                right: rtl ? undefined : 14,
                left: rtl ? 14 : undefined,
              },
            ]}
          >
            <Text style={styles.popularText}>الأكثر شيوعاً ⭐</Text>
          </View>
        )}
        <Icon name="star" size={32} color={colors.accent} />
        <Text style={[styles.planName, { color: colors.foreground, marginTop: 8, textAlign: rtl ? "right" : "left", width: "100%" }]}>{planName}</Text>
        {!!planDescription?.trim() && (
          <Text style={[styles.planDescription, { color: colors.mutedForeground, textAlign: rtl ? "right" : "left", width: "100%" }]}>
            {planDescription.trim()}
          </Text>
        )}
        <View style={[styles.priceRow, { flexDirection: rtl ? "row-reverse" : "row" }]}>
          <Text style={[styles.planAmount, { color: colors.accent }]}>{plan ? plan.price : "$1.99"}</Text>
          <Text style={[styles.planCurrency, { color: colors.mutedForeground }]}> {plan ? plan.currency : "SAR"} / شهر</Text>
        </View>
        <View style={[styles.divider, { backgroundColor: colors.accent + "40" }]} />
        <Text
          style={[
            styles.limitBadge,
            {
              color: colors.accent,
              backgroundColor: colors.accent + "15",
              alignSelf: rtl ? "flex-end" : "flex-start",
              textAlign: rtl ? "right" : "left",
            },
          ]}
        >
          {plan ? (rtl ? `∞ تحليلات غير محدودة` : `∞ Unlimited Analysis`) : `∞ تحليلات غير محدودة`}
        </Text>
        {planFeatures.map((f) => (
          <View key={f} style={[styles.featureRow, { flexDirection: rtl ? "row-reverse" : "row" }]}>
            <Icon name="checkmark-circle" size={21} color={colors.accent} />
            <View style={[styles.featureTextWrap, { alignItems: rtl ? "flex-end" : "flex-start" }]}>
              <Text style={[styles.featureTextText, { color: colors.foreground, textAlign: rtl ? "right" : "left", width: "100%" }]}>{f}</Text>
            </View>
          </View>
        ))}
        {isCurrentPlan ? (
          <View style={[styles.currentBadge, { backgroundColor: colors.accent + "30" }]}>
            <Text style={[styles.currentText, { color: colors.accent, textAlign: "center" }]}>✓ خطتك الحالية</Text>
          </View>
        ) : pkg ? (
          <TouchableOpacity
            style={[styles.upgradeBtn, { backgroundColor: colors.accent }]}
            onPress={() => handleUpgrade(pkg)}
          >
            <Text style={styles.upgradeBtnText}>اشترك الآن — {planPrice} / شهر</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.upgradeBtn, { backgroundColor: colors.accent }]}
            onPress={handleUpgradeFallback}
          >
            <Text style={styles.upgradeBtnText}>اشترك الآن — {planPrice} / شهر</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View
        style={[
          styles.header,
          {
            paddingTop: topPadding + 12,
            backgroundColor: "#11674e",
            borderBottomColor: "#0D523E",
            flexDirection: rtl ? "row-reverse" : "row",
          },
        ]}
      >
        <HeaderNatureBackground />
        <BackButton />
        <Text style={[styles.title, { color: "#f3f6f4", textAlign: rtl ? "right" : "left", flex: 1 }]}>الباقات</Text>
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
            <View
              style={[
                styles.statusBox,
                {
                  backgroundColor: statusMsg.includes("🎉") || statusMsg.includes("✓") ? colors.allowed + "20" : "#fdecea",
                  flexDirection: rtl ? "row-reverse" : "row",
                },
              ]}
            >
              <Text
                style={[
                  styles.statusText,
                  {
                    color: statusMsg.includes("🎉") || statusMsg.includes("✓") ? colors.allowed : "#c0392b",
                    textAlign: rtl ? "right" : "left",
                  },
                ]}
              >
                {statusMsg}
              </Text>
              <TouchableOpacity onPress={() => setStatusMsg(null)}>
                <Icon name="close" size={16} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>
          )}

          {/* Free plan */}
          <View style={[styles.planCard, { backgroundColor: colors.card, borderColor: colors.border, alignItems: rtl ? "flex-end" : "flex-start" }]}>
            <Text style={[styles.planName, { color: colors.foreground, textAlign: rtl ? "right" : "left", width: "100%" }]}>{freePlanName}</Text>
            {!!freePlanDescription?.trim() && (
              <Text style={[styles.planDescription, { color: colors.mutedForeground, textAlign: rtl ? "right" : "left", width: "100%" }]}>
                {freePlanDescription.trim()}
              </Text>
            )}
            <View style={[styles.priceRow, { flexDirection: rtl ? "row-reverse" : "row" }]}>
              <Text style={[styles.planAmount, { color: colors.foreground }]}>{freePlan ? freePlan.price : "0"}</Text>
              <Text style={[styles.planCurrency, { color: colors.mutedForeground }]}> {freePlan ? freePlan.currency : "ريال"} / شهر</Text>
            </View>
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <Text
              style={[
                styles.limitBadge,
                {
                  color: colors.primary,
                  backgroundColor: colors.primary + "15",
                  alignSelf: rtl ? "flex-end" : "flex-start",
                  textAlign: rtl ? "right" : "left",
                },
              ]}
            >
              {freeLimitText}
            </Text>
            {freePlanFeaturesList.map((f) => (
              <View key={f} style={[styles.featureRow, { flexDirection: rtl ? "row-reverse" : "row" }]}>
                <Icon name="checkmark-circle" size={21} color={colors.allowed} />
                <View style={[styles.featureTextWrap, { alignItems: rtl ? "flex-end" : "flex-start" }]}>
                  <Text style={[styles.featureTextText, { color: colors.foreground, textAlign: rtl ? "right" : "left", width: "100%" }]}>{f}</Text>
                </View>
              </View>
            ))}
            {isFreeCurrent && (
              <View style={[styles.currentBadge, { backgroundColor: colors.muted }]}>
                <Text style={[styles.currentText, { color: colors.mutedForeground, textAlign: "center" }]}>✓ خطتك الحالية</Text>
              </View>
            )}
          </View>

          {/* Premium plans */}
          {premiumPlans.length > 0
            ? premiumPlans.map((plan) => {
                const pkg = packages.find(
                  (p) =>
                    (plan.revenueCatProductId &&
                      p.product.identifier === plan.revenueCatProductId) ||
                    p.product.identifier === "tayyibati_premium_monthly"
                );
                return <PremiumCard key={plan.id} plan={plan} pkg={pkg} />;
              })
            : (() => {
                const pkg = packages.find(
                  (p) => p.product.identifier === "tayyibati_premium_monthly"
                );
                return <PremiumCard plan={null} pkg={pkg} />;
              })()
          }

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
              سيتم خصم {selectedPkg?.product.priceString ?? displayPrice} من حسابك عبر متجر التطبيقات.
            </Text>
            <View style={[styles.modalButtons, { flexDirection: rtl ? "row-reverse" : "row" }]}>
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
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  backBtn: { width: 44, paddingVertical: 4 },
  title: { fontSize: 26, fontFamily: "Tajawal_700Bold" },
  loadingCenter: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  loadingText: { fontSize: 14, fontFamily: "Tajawal_400Regular" },
  statusBox: {
    alignItems: "center",
    justifyContent: "flex-start",
    padding: 12,
    borderRadius: 12,
    gap: 8,
  },
  statusText: { flex: 1, fontSize: 14, fontFamily: "Tajawal_500Medium" },
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
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  popularText: { color: "#fff", fontSize: 13.5, fontFamily: "Tajawal_700Bold" },
  planName: { fontSize: 27, fontFamily: "Tajawal_700Bold" },
  planDescription: {
    fontSize: 13.5,
    fontFamily: "Tajawal_400Regular",
    lineHeight: 19,
    marginTop: 2,
    marginBottom: 4,
  },
  priceRow: { alignItems: "flex-end", justifyContent: "flex-start" },
  planAmount: { fontSize: 38, fontFamily: "Tajawal_700Bold" },
  planCurrency: { fontSize: 16.5, fontFamily: "Tajawal_500Medium", paddingBottom: 6 },
  divider: { height: 1, marginVertical: 4, alignSelf: "stretch" },
  limitBadge: {
    fontSize: 15.5,
    fontFamily: "Tajawal_700Bold",
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 8,
    overflow: "hidden",
  },
  featureRow: {
    alignItems: "center",
    justifyContent: "flex-start",
    gap: 10,
    width: "100%",
  },
  featureTextWrap: {
    flex: 1,
  },
  featureTextText: {
    fontSize: 16.5,
    fontFamily: "Tajawal_500Medium",
  },
  currentBadge: { padding: 10, borderRadius: 10, alignItems: "center", marginTop: 4, alignSelf: "stretch" },
  currentText: { fontSize: 14, fontFamily: "Tajawal_700Bold" },
  upgradeBtn: { padding: 14, borderRadius: 14, alignItems: "center", marginTop: 4, alignSelf: "stretch" },
  upgradeBtnText: { color: "#fff", fontFamily: "Tajawal_700Bold", fontSize: 17 },
  restoreBtn: { alignItems: "center", paddingVertical: 8 },
  restoreText: { fontSize: 14, fontFamily: "Tajawal_400Regular", textDecorationLine: "underline" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center", padding: 24 },
  modalBox: { borderRadius: 20, padding: 24, gap: 16, width: "100%" },
  modalTitle: { fontSize: 19.5, fontFamily: "Tajawal_700Bold", textAlign: "center" },
  modalBody: { fontSize: 15, fontFamily: "Tajawal_400Regular", textAlign: "center", lineHeight: 23 },
  modalButtons: { gap: 12 },
  modalBtn: { flex: 1, padding: 14, borderRadius: 12, alignItems: "center" },
  modalBtnText: { fontFamily: "Tajawal_700Bold", fontSize: 16 },
});
