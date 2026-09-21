import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Linking,
  Platform,
} from "react-native";
import { Icon } from "@/components/Icon";
import { isRTL } from "@/lib/i18n";
import { UnifiedSubscriptionDetails } from "@/hooks/useSubscriptionDetails";

interface ProfileSubscriptionCardProps {
  subscription: UnifiedSubscriptionDetails;
  onUpgrade?: () => void;
}

export function ProfileSubscriptionCard({
  subscription,
  onUpgrade,
}: ProfileSubscriptionCardProps) {
  const rtl = isRTL();

  const handleManageSubscription = async () => {
    const url =
      subscription.managementURL ||
      (Platform.OS === "android"
        ? "https://play.google.com/store/account/subscriptions"
        : "https://apps.apple.com/account/subscriptions");
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        await Linking.openURL("https://play.google.com/store/account/subscriptions");
      }
    } catch {
      await Linking.openURL("https://play.google.com/store/account/subscriptions");
    }
  };

  // 1. Free user — do not render subscription dates
  if (subscription.status === "FREE") {
    return null;
  }

  // 2. Error state — graceful, non-blocking fallback
  if (subscription.status === "ERROR") {
    return (
      <View style={[styles.card, styles.cardError]}>
        <View style={[styles.errorRow, { flexDirection: rtl ? "row-reverse" : "row" }]}>
          <Icon name="alert-circle-outline" size={22} color="#EF4444" />
          <Text style={styles.errorText}>تعذر تحميل معلومات الاشتراك</Text>
        </View>
        <TouchableOpacity
          style={styles.retryBtn}
          onPress={() => subscription.refetch()}
          activeOpacity={0.7}
        >
          <Text style={styles.retryBtnText}>إعادة المحاولة</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const {
    status,
    planName,
    formattedStartDate,
    formattedExpirationDate,
    formattedRemainingDays,
    autoRenew,
  } = subscription;

  const isBillingIssue = status === "BILLING_ISSUE";
  const isExpired = status === "EXPIRED";
  const isCancelled = status === "CANCELLED"; // Auto-renew turned off

  return (
    <View style={styles.card}>
      {/* Header Row: Title + Plan Name Badge */}
      <View style={[styles.headerRow, { flexDirection: rtl ? "row-reverse" : "row" }]}>
        <View style={[styles.titleGroup, { flexDirection: rtl ? "row-reverse" : "row" }]}>
          <Icon name="ribbon-outline" size={20} color="#16A34A" />
          <Text style={styles.cardTitle}>اشتراكك الحالي</Text>
        </View>

        {/* Plan Badge */}
        <View style={styles.planBadge}>
          <Icon name="star" size={13} color="#F59E0B" />
          <Text style={styles.planBadgeText}>
            {planName === "Tayyibati Premium" ? "Premium" : planName}
          </Text>
        </View>
      </View>

      {/* State-specific Notice / Status Banner */}
      {isBillingIssue && (
        <View style={[styles.alertBanner, styles.alertBannerDanger, { flexDirection: rtl ? "row-reverse" : "row" }]}>
          <Icon name="warning" size={18} color="#EF4444" />
          <View style={[styles.alertTextWrap, { alignItems: rtl ? "flex-end" : "flex-start" }]}>
            <Text style={[styles.alertTitle, { color: "#B91C1C", textAlign: rtl ? "right" : "left" }]}>
              تعذر تجديد اشتراكك
            </Text>
            <Text style={[styles.alertDesc, { color: "#EF4444", textAlign: rtl ? "right" : "left" }]}>
              يرجى تحديث طريقة الدفع.
            </Text>
          </View>
        </View>
      )}

      {isCancelled && (
        <View style={[styles.alertBanner, styles.alertBannerWarning, { flexDirection: rtl ? "row-reverse" : "row" }]}>
          <Icon name="time-outline" size={18} color="#D97706" />
          <View style={[styles.alertTextWrap, { alignItems: rtl ? "flex-end" : "flex-start" }]}>
            <Text style={[styles.alertTitle, { color: "#B45309", textAlign: rtl ? "right" : "left" }]}>
              {formattedExpirationDate
                ? `ينتهي اشتراكك في ${formattedExpirationDate}`
                : "ينتهي اشتراكك قريباً"}
            </Text>
            <Text style={[styles.alertDesc, { color: "#D97706", textAlign: rtl ? "right" : "left" }]}>
              التجديد التلقائي غير مفعّل
            </Text>
          </View>
        </View>
      )}

      {isExpired && (
        <View style={[styles.alertBanner, styles.alertBannerMuted, { flexDirection: rtl ? "row-reverse" : "row" }]}>
          <Icon name="alert-circle-outline" size={18} color="#6B7280" />
          <View style={[styles.alertTextWrap, { alignItems: rtl ? "flex-end" : "flex-start" }]}>
            <Text style={[styles.alertTitle, { color: "#374151", textAlign: rtl ? "right" : "left" }]}>
              انتهى اشتراكك
            </Text>
            {formattedExpirationDate && (
              <Text style={[styles.alertDesc, { color: "#6B7280", textAlign: rtl ? "right" : "left" }]}>
                انتهت الصلاحية في {formattedExpirationDate}
              </Text>
            )}
          </View>
        </View>
      )}

      {/* Subscription Details Grid */}
      <View style={styles.detailsGrid}>
        {/* Row: Status */}
        <View style={[styles.detailRow, { flexDirection: rtl ? "row-reverse" : "row" }]}>
          <Text style={styles.detailLabel}>حالة الاشتراك</Text>
          <View
            style={[
              styles.statusPill,
              status === "ACTIVE" && styles.statusPillActive,
              isCancelled && styles.statusPillWarning,
              (isBillingIssue || isExpired) && styles.statusPillDanger,
              { flexDirection: rtl ? "row-reverse" : "row" },
            ]}
          >
            <View
              style={[
                styles.statusDot,
                status === "ACTIVE" && { backgroundColor: "#16A34A" },
                isCancelled && { backgroundColor: "#F59E0B" },
                (isBillingIssue || isExpired) && { backgroundColor: "#EF4444" },
              ]}
            />
            <Text
              style={[
                styles.statusText,
                status === "ACTIVE" && { color: "#15803D" },
                isCancelled && { color: "#B45309" },
                (isBillingIssue || isExpired) && { color: "#B91C1C" },
              ]}
            >
              {status === "ACTIVE"
                ? "نشط"
                : isCancelled
                ? "ينتهي قريباً"
                : isBillingIssue
                ? "مشكلة في الدفع"
                : "منتهي"}
            </Text>
          </View>
        </View>

        {/* Row: Start Date */}
        {formattedStartDate ? (
          <View style={[styles.detailRow, { flexDirection: rtl ? "row-reverse" : "row" }]}>
            <Text style={styles.detailLabel}>تاريخ الاشتراك</Text>
            <Text style={styles.detailValue}>{formattedStartDate}</Text>
          </View>
        ) : null}

        {/* Row: Next Renewal OR Expiry Date */}
        {formattedExpirationDate ? (
          <View style={[styles.detailRow, { flexDirection: rtl ? "row-reverse" : "row" }]}>
            <Text style={styles.detailLabel}>
              {autoRenew ? "موعد التجديد القادم" : "تاريخ الانتهاء"}
            </Text>
            <Text style={styles.detailValue}>{formattedExpirationDate}</Text>
          </View>
        ) : null}

        {/* Row: Remaining Days */}
        {!isExpired && formattedRemainingDays ? (
          <View style={[styles.detailRow, { flexDirection: rtl ? "row-reverse" : "row" }]}>
            <Text style={styles.detailLabel}>متبقي</Text>
            <View style={[styles.remainingBadge, { flexDirection: rtl ? "row-reverse" : "row" }]}>
              <Icon name="time-outline" size={14} color="#16A34A" />
              <Text style={styles.remainingText}>{formattedRemainingDays}</Text>
            </View>
          </View>
        ) : null}
      </View>

      {/* Action CTA Button */}
      <View style={styles.actionRow}>
        {isExpired ? (
          <TouchableOpacity
            style={styles.primaryActionBtn}
            onPress={onUpgrade}
            activeOpacity={0.8}
          >
            <Icon name="sparkles" size={16} color="#FFFFFF" />
            <Text style={styles.primaryActionText}>تجديد الاشتراك</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.manageBtn}
            onPress={handleManageSubscription}
            activeOpacity={0.8}
          >
            <Icon name="settings-outline" size={16} color="#16A34A" />
            <Text style={styles.manageBtnText}>
              {isBillingIssue ? "تحديث طريقة الدفع / إدارة الاشتراك" : "إدارة الاشتراك"}
            </Text>
            <Icon
              name={rtl ? "chevron-back" : "chevron-forward"}
              size={14}
              color="#16A34A"
            />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E2F2E9",
    padding: 18,
    marginHorizontal: 16,
    marginTop: 12,
    shadowColor: "#0D764E",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    gap: 14,
  },
  cardError: {
    borderColor: "#FCA5A5",
    backgroundColor: "#FEF2F2",
    alignItems: "center",
    paddingVertical: 20,
    gap: 10,
  },
  errorRow: {
    alignItems: "center",
    gap: 8,
  },
  errorText: {
    fontSize: 14,
    fontFamily: "Tajawal_700Bold",
    color: "#EF4444",
  },
  retryBtn: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#FCA5A5",
  },
  retryBtnText: {
    fontSize: 12,
    fontFamily: "Tajawal_500Medium",
    color: "#DC2626",
  },
  headerRow: {
    alignItems: "center",
    justifyContent: "space-between",
  },
  titleGroup: {
    alignItems: "center",
    gap: 8,
  },
  cardTitle: {
    fontSize: 16,
    fontFamily: "Tajawal_700Bold",
    color: "#0F172A",
  },
  planBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#FFFBEB",
    borderColor: "#FDE68A",
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
  },
  planBadgeText: {
    fontSize: 12,
    fontFamily: "Tajawal_700Bold",
    color: "#D97706",
  },
  alertBanner: {
    padding: 12,
    borderRadius: 12,
    alignItems: "center",
    gap: 10,
  },
  alertBannerDanger: {
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FCA5A5",
  },
  alertBannerWarning: {
    backgroundColor: "#FFFBEB",
    borderWidth: 1,
    borderColor: "#FDE68A",
  },
  alertBannerMuted: {
    backgroundColor: "#F3F4F6",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  alertTextWrap: {
    flex: 1,
    gap: 2,
  },
  alertTitle: {
    fontSize: 13,
    fontFamily: "Tajawal_700Bold",
  },
  alertDesc: {
    fontSize: 12,
    fontFamily: "Tajawal_400Regular",
  },
  detailsGrid: {
    gap: 10,
    paddingVertical: 2,
  },
  detailRow: {
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: "#F1F5F9",
  },
  detailLabel: {
    fontSize: 13,
    fontFamily: "Tajawal_400Regular",
    color: "#64748B",
  },
  detailValue: {
    fontSize: 14,
    fontFamily: "Tajawal_700Bold",
    color: "#0F172A",
  },
  statusPill: {
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
    backgroundColor: "#F1F5F9",
  },
  statusPillActive: {
    backgroundColor: "#DCFCE7",
  },
  statusPillWarning: {
    backgroundColor: "#FEF3C7",
  },
  statusPillDanger: {
    backgroundColor: "#FEE2E2",
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#64748B",
  },
  statusText: {
    fontSize: 12,
    fontFamily: "Tajawal_700Bold",
  },
  remainingBadge: {
    alignItems: "center",
    gap: 4,
    backgroundColor: "#F0FDF4",
    borderColor: "#BBF7D0",
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  remainingText: {
    fontSize: 12,
    fontFamily: "Tajawal_700Bold",
    color: "#16A34A",
  },
  actionRow: {
    marginTop: 4,
  },
  manageBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "#F0FDF4",
    borderWidth: 1,
    borderColor: "#86EFAC",
  },
  manageBtnText: {
    fontSize: 13,
    fontFamily: "Tajawal_700Bold",
    color: "#16A34A",
  },
  primaryActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: "#16A34A",
  },
  primaryActionText: {
    fontSize: 14,
    fontFamily: "Tajawal_700Bold",
    color: "#FFFFFF",
  },
});
