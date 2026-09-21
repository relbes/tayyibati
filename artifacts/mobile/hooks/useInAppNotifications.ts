import { useState, useEffect, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "@/context/AuthContext";
import { UnifiedSubscriptionDetails } from "./useSubscriptionDetails";
import { formatArabicDate } from "@/lib/dateUtils";

export type NotificationType =
  | "RENEWAL_7_DAYS"
  | "RENEWAL_3_DAYS"
  | "RENEWAL_1_DAY"
  | "EXPIRING_TODAY"
  | "BILLING_FAILED"
  | "GENERAL";

export interface InAppNotification {
  id: string;
  idempotencyKey: string;
  type: NotificationType;
  title: string;
  message: string;
  createdAt: string;
  read: boolean;
  iconName: "notifications" | "warning" | "time-outline" | "checkmark-circle" | "star";
  iconColor: string;
  statusType: "info" | "warning" | "error" | "success";
}

const STORAGE_PREFIX = "@tayyibati_notifications_";

export function useInAppNotifications() {
  const { user } = useAuth();
  const userId = user?.id || "guest";
  const storageKey = `${STORAGE_PREFIX}${userId}`;

  const [notifications, setNotifications] = useState<InAppNotification[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // 1. Load persisted notifications
  const loadNotifications = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setNotifications(parsed);
        }
      } else {
        setNotifications([]);
      }
    } catch {
      // Graceful fallback
    } finally {
      setIsLoading(false);
    }
  }, [storageKey]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  // 2. Save notifications helper
  const saveNotifications = async (updated: InAppNotification[]) => {
    setNotifications(updated);
    try {
      await AsyncStorage.setItem(storageKey, JSON.stringify(updated));
    } catch {
      // Non-blocking
    }
  };

  // 3. Mark single notification as read
  const markAsRead = useCallback(
    async (id: string) => {
      const updated = notifications.map((n) =>
        n.id === id ? { ...n, read: true } : n
      );
      await saveNotifications(updated);
    },
    [notifications, storageKey]
  );

  // 4. Mark all as read
  const markAllAsRead = useCallback(async () => {
    const updated = notifications.map((n) => ({ ...n, read: true }));
    await saveNotifications(updated);
  }, [notifications, storageKey]);

  // 5. Clear all notifications
  const clearAll = useCallback(async () => {
    await saveNotifications([]);
  }, [storageKey]);

  // 6. Evaluate subscription renewal/expiration reminders with strict idempotency
  const evaluateSubscriptionNotifications = useCallback(
    async (sub: UnifiedSubscriptionDetails) => {
      if (sub.status === "FREE" || sub.status === "ERROR") return;

      const subId = sub.planName || "tayyibati_premium";
      const expDate = sub.expirationDate;
      const expDateKey = expDate
        ? new Date(expDate).toISOString().slice(0, 10)
        : "unknown_date";

      const candidates: Array<{
        type: NotificationType;
        idempotencyKey: string;
        title: string;
        message: string;
        iconName: InAppNotification["iconName"];
        iconColor: string;
        statusType: InAppNotification["statusType"];
      }> = [];

      // A. Billing Issue / Payment Failed
      if (sub.billingIssue || sub.status === "BILLING_ISSUE") {
        candidates.push({
          type: "BILLING_FAILED",
          idempotencyKey: `${subId}_BILLING_FAILED_${expDateKey}`,
          title: "مشكلة في تجديد الاشتراك",
          message:
            "تعذر تجديد اشتراكك في Tayyibati Premium. يرجى تحديث طريقة الدفع.",
          iconName: "warning",
          iconColor: "#EF4444",
          statusType: "error",
        });
      }

      // If we have an expiration date, evaluate timeline reminders
      if (expDate && sub.remainingDays !== null) {
        const days = sub.remainingDays;
        const autoRenew = sub.autoRenew;

        // B. Expired / Expiring Today
        if (days <= 0) {
          candidates.push({
            type: "EXPIRING_TODAY",
            idempotencyKey: `${subId}_EXPIRING_TODAY_${expDateKey}`,
            title: "انتهاء الاشتراك",
            message: "انتهى اشتراكك في Tayyibati Premium.",
            iconName: "time-outline",
            iconColor: "#6B7280",
            statusType: "warning",
          });
        }
        // C. 1 Day Before
        else if (days === 1) {
          candidates.push({
            type: "RENEWAL_1_DAY",
            idempotencyKey: `${subId}_RENEWAL_1_DAY_${expDateKey}`,
            title: autoRenew ? "تجديد الاشتراك غداً" : "انتهاء الاشتراك غداً",
            message: autoRenew
              ? "اشتراكك في Tayyibati Premium سيتجدد غدًا."
              : "اشتراكك في Tayyibati Premium ينتهي غدًا.",
            iconName: "notifications",
            iconColor: "#16A34A",
            statusType: "info",
          });
        }
        // D. 3 Days Before
        else if (days > 1 && days <= 3) {
          candidates.push({
            type: "RENEWAL_3_DAYS",
            idempotencyKey: `${subId}_RENEWAL_3_DAYS_${expDateKey}`,
            title: autoRenew ? "تجديد الاشتراك قريباً" : "انتهاء الاشتراك قريباً",
            message: autoRenew
              ? "تبقى 3 أيام على تجديد اشتراكك في Tayyibati Premium."
              : "تبقى 3 أيام على انتهاء اشتراكك في Tayyibati Premium.",
            iconName: "notifications",
            iconColor: "#16A34A",
            statusType: "info",
          });
        }
        // E. 7 Days Before
        else if (days > 3 && days <= 7) {
          candidates.push({
            type: "RENEWAL_7_DAYS",
            idempotencyKey: `${subId}_RENEWAL_7_DAYS_${expDateKey}`,
            title: autoRenew ? "تذكير بتجديد الاشتراك" : "تذكير بانتهاء الاشتراك",
            message: autoRenew
              ? "اشتراكك في Tayyibati Premium سيتجدد بعد 7 أيام."
              : "ينتهي اشتراكك في Tayyibati Premium بعد 7 أيام.",
            iconName: "notifications",
            iconColor: "#16A34A",
            statusType: "info",
          });
        }
      }

      if (candidates.length === 0) return;

      // Filter out candidates that already exist by idempotencyKey
      const existingKeys = new Set(notifications.map((n) => n.idempotencyKey));
      const newItems: InAppNotification[] = [];

      for (const c of candidates) {
        if (!existingKeys.has(c.idempotencyKey)) {
          newItems.push({
            id: `notif_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            idempotencyKey: c.idempotencyKey,
            type: c.type,
            title: c.title,
            message: c.message,
            createdAt: new Date().toISOString(),
            read: false,
            iconName: c.iconName,
            iconColor: c.iconColor,
            statusType: c.statusType,
          });
          existingKeys.add(c.idempotencyKey);
        }
      }

      if (newItems.length > 0) {
        const merged = [...newItems, ...notifications];
        await saveNotifications(merged);
      }
    },
    [notifications, storageKey]
  );

  const unreadCount = notifications.filter((n) => !n.read).length;

  return {
    notifications,
    unreadCount,
    isLoading,
    markAsRead,
    markAllAsRead,
    clearAll,
    evaluateSubscriptionNotifications,
  };
}
