import React from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  ScrollView,
  Dimensions,
  Platform,
} from "react-native";
import { Icon } from "@/components/Icon";
import { InAppNotification } from "@/hooks/useInAppNotifications";
import { formatArabicDate } from "@/lib/dateUtils";
import { isRTL } from "@/lib/i18n";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

interface NotificationCenterModalProps {
  visible: boolean;
  onClose: () => void;
  notifications: InAppNotification[];
  unreadCount: number;
  onMarkAsRead: (id: string) => void;
  onMarkAllAsRead: () => void;
}

export function NotificationCenterModal({
  visible,
  onClose,
  notifications,
  unreadCount,
  onMarkAsRead,
  onMarkAllAsRead,
}: NotificationCenterModalProps) {
  const rtl = isRTL();

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={true}
      statusBarTranslucent={true}
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable
          style={[styles.container, { maxHeight: SCREEN_HEIGHT * 0.85 }]}
          onPress={() => {}}
        >
            {/* Header */}
            <View style={[styles.header, { flexDirection: rtl ? "row-reverse" : "row" }]}>
              <View style={[styles.titleRow, { flexDirection: rtl ? "row-reverse" : "row" }]}>
                <View style={styles.headerIconWrap}>
                  <Icon name="notifications" size={20} color="#16A34A" />
                </View>
                <Text style={styles.headerTitle}>مركز الإشعارات</Text>
                {unreadCount > 0 && (
                  <View style={styles.unreadPill}>
                    <Text style={styles.unreadPillText}>{unreadCount} جديد</Text>
                  </View>
                )}
              </View>

              <View style={[styles.headerActions, { flexDirection: rtl ? "row-reverse" : "row" }]}>
                {unreadCount > 0 && (
                  <TouchableOpacity
                    onPress={onMarkAllAsRead}
                    style={styles.markAllBtn}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.markAllText}>تحديد الكل كمقروء</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  onPress={onClose}
                  style={styles.closeBtn}
                  activeOpacity={0.7}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Icon name="close" size={20} color="#64748B" />
                </TouchableOpacity>
              </View>
            </View>

            {/* Content */}
            {notifications.length === 0 ? (
              <View style={styles.emptyContainer}>
                <View style={styles.emptyIconWrap}>
                  <Icon name="notifications-outline" size={48} color="#94A3B8" />
                </View>
                <Text style={styles.emptyTitle}>لا توجد إشعارات حالياً</Text>
                <Text style={styles.emptyDesc}>
                  ستصلك هنا تنبيهات تجديد وانتهاء الاشتراك والتحديثات المهمة
                </Text>
              </View>
            ) : (
              <ScrollView
                style={styles.list}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
              >
                {notifications.map((item) => {
                  const isUnread = !item.read;
                  return (
                    <TouchableOpacity
                      key={item.id}
                      style={[
                        styles.itemCard,
                        isUnread && styles.itemCardUnread,
                        { flexDirection: rtl ? "row-reverse" : "row" },
                      ]}
                      activeOpacity={0.8}
                      onPress={() => onMarkAsRead(item.id)}
                    >
                      {/* Status Icon */}
                      <View
                        style={[
                          styles.itemIconWrap,
                          {
                            backgroundColor:
                              item.statusType === "error"
                                ? "#FEE2E2"
                                : item.statusType === "warning"
                                ? "#FEF3C7"
                                : "#DCFCE7",
                          },
                        ]}
                      >
                        <Icon
                          name={item.iconName as any}
                          size={20}
                          color={item.iconColor}
                        />
                      </View>

                      {/* Text details */}
                      <View
                        style={[
                          styles.itemTextWrap,
                          { alignItems: rtl ? "flex-end" : "flex-start" },
                        ]}
                      >
                        <View
                          style={[
                            styles.itemTopRow,
                            { flexDirection: rtl ? "row-reverse" : "row" },
                          ]}
                        >
                          <Text
                            style={[
                              styles.itemTitle,
                              isUnread && styles.itemTitleUnread,
                              { textAlign: rtl ? "right" : "left" },
                            ]}
                          >
                            {item.title}
                          </Text>
                          {isUnread && <View style={styles.greenDot} />}
                        </View>
                        <Text
                          style={[
                            styles.itemMessage,
                            { textAlign: rtl ? "right" : "left" },
                          ]}
                        >
                          {item.message}
                        </Text>
                        <Text
                          style={[
                            styles.itemDate,
                            { textAlign: rtl ? "right" : "left" },
                          ]}
                        >
                          {formatArabicDate(item.createdAt)}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}
          </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  container: {
    backgroundColor: "#FAFAF8",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    width: "100%",
    minHeight: 320,
    paddingBottom: Platform.OS === "ios" ? 34 : 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  header: {
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  },
  titleRow: {
    alignItems: "center",
    gap: 8,
  },
  headerIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#DCFCE7",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: "Tajawal_700Bold",
    color: "#0F172A",
  },
  unreadPill: {
    backgroundColor: "#16A34A",
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  unreadPillText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontFamily: "Tajawal_700Bold",
  },
  headerActions: {
    alignItems: "center",
    gap: 12,
  },
  markAllBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  markAllText: {
    fontSize: 12,
    fontFamily: "Tajawal_500Medium",
    color: "#16A34A",
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  list: {
    flex: 1,
  },
  listContent: {
    padding: 16,
    gap: 12,
  },
  itemCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 14,
    alignItems: "flex-start",
    gap: 12,
  },
  itemCardUnread: {
    borderColor: "#86EFAC",
    backgroundColor: "#F0FDF4",
  },
  itemIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  itemTextWrap: {
    flex: 1,
    gap: 4,
  },
  itemTopRow: {
    alignItems: "center",
    gap: 8,
    width: "100%",
    justifyContent: "space-between",
  },
  itemTitle: {
    fontSize: 15,
    fontFamily: "Tajawal_700Bold",
    color: "#1E293B",
  },
  itemTitleUnread: {
    color: "#0F172A",
  },
  greenDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#16A34A",
  },
  itemMessage: {
    fontSize: 13,
    fontFamily: "Tajawal_400Regular",
    color: "#475569",
    lineHeight: 19,
  },
  itemDate: {
    fontSize: 11,
    fontFamily: "Tajawal_400Regular",
    color: "#94A3B8",
    marginTop: 2,
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
    paddingHorizontal: 30,
    gap: 12,
  },
  emptyIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  emptyTitle: {
    fontSize: 17,
    fontFamily: "Tajawal_700Bold",
    color: "#334155",
  },
  emptyDesc: {
    fontSize: 13,
    fontFamily: "Tajawal_400Regular",
    color: "#64748B",
    textAlign: "center",
    lineHeight: 20,
  },
});
