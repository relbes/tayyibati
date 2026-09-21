import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Linking,
  Platform,
  LayoutAnimation,
} from "react-native";
import Purchases from "react-native-purchases";
import { Icon } from "@/components/Icon";

export interface SubscriptionNoticeBannerProps {
  onDismiss?: () => void;
  onUpdate?: () => void;
  style?: any;
}

export function SubscriptionNoticeBanner({
  onDismiss,
  onUpdate,
  style,
}: SubscriptionNoticeBannerProps) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  const handleUpdate = async () => {
    if (onUpdate) {
      onUpdate();
      return;
    }
    try {
      const customerInfo = await Purchases.getCustomerInfo();
      if (customerInfo?.managementURL) {
        await Linking.openURL(customerInfo.managementURL);
        return;
      }
    } catch {
      // Fallback below
    }

    try {
      if (Platform.OS === "android") {
        await Linking.openURL("https://play.google.com/store/account/subscriptions");
      } else if (Platform.OS === "ios") {
        await Linking.openURL("https://apps.apple.com/account/subscriptions");
      }
    } catch (err) {
      console.warn("[SubscriptionNoticeBanner] Failed to open subscription management URL:", err);
    }
  };

  const handleDismiss = () => {
    try {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    } catch {}
    setDismissed(true);
    if (onDismiss) {
      onDismiss();
    }
  };

  return (
    <View style={[styles.container, style]}>
      {/* Right side in RTL: Alert Icon + Message */}
      <View style={styles.contentGroup}>
        <View style={styles.iconCircle}>
          <Icon name="alert-circle" size={18} color="#D97706" />
        </View>
        <Text style={styles.messageText}>
          تعذر تجديد اشتراكك. يرجى تحديث طريقة الدفع.
        </Text>
      </View>

      {/* Left side in RTL: Update Button + Dismiss Button */}
      <View style={styles.actionGroup}>
        <TouchableOpacity
          style={styles.updateButton}
          onPress={handleUpdate}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="تحديث طريقة الدفع"
        >
          <Text style={styles.updateButtonText}>تحديث</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.dismissButton}
          onPress={handleDismiss}
          activeOpacity={0.6}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessibilityRole="button"
          accessibilityLabel="إغلاق التنبيه"
        >
          <Icon name="close" size={16} color="#64748B" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginHorizontal: 16,
    marginBottom: 8,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 3,
    gap: 8,
  },
  contentGroup: {
    flexDirection: "row-reverse",
    alignItems: "center",
    flex: 1,
    gap: 8,
  },
  iconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#FEF3C7",
    alignItems: "center",
    justifyContent: "center",
  },
  messageText: {
    fontSize: 12.5,
    fontFamily: "Tajawal_500Medium",
    color: "#0F172A",
    textAlign: "right",
    flex: 1,
    lineHeight: 18,
  },
  actionGroup: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 6,
  },
  updateButton: {
    backgroundColor: "#16A34A",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  updateButtonText: {
    fontSize: 12.5,
    fontFamily: "Tajawal_700Bold",
    color: "#FFFFFF",
  },
  dismissButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#F1F5F9",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    alignItems: "center",
    justifyContent: "center",
  },
});
