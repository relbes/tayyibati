import React, { useEffect, useState } from "react";
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
import { Icon } from "@/components/Icon";
import { HeaderNatureBackground } from "@/components/HeaderNatureBackground";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContext";
import { getUserUsage, getPublicConfig } from "@/lib/api";
import { isRTL } from "@/lib/i18n";
import { TayyibatiTheme } from "@/constants/tayyibatiTheme";

interface UsageInfo {
  monthlyTextCount: number;
  monthlyImageCount: number;
  textLimit: number;
  imageLimit: number;
  textRemaining: number;
  imageRemaining: number;
  isPremium: boolean;
}

export default function ProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, signOut } = useAuth();
  const [usage, setUsage] = useState<UsageInfo | null>(null);
  const [subscriptionEnabled, setSubscriptionEnabled] = useState(true);
  const topPadding = Platform.OS === "web" ? 67 : insets.top;
  const rtl = isRTL();

  useEffect(() => {
    getPublicConfig()
      .then((cfg) => setSubscriptionEnabled(cfg.subscription_enabled !== "false"))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (user) {
      getUserUsage().then(setUsage).catch(() => {});
    }
  }, [user]);

  const handleSignOut = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      "تسجيل الخروج",
      "هل أنت متأكد أنك تريد تسجيل الخروج؟",
      [
        { text: "إلغاء", style: "cancel" },
        {
          text: "تسجيل الخروج",
          style: "destructive",
          onPress: async () => {
            await signOut();
            Alert.alert("تم تسجيل الخروج", "تم تسجيل الخروج بنجاح");
            router.replace("/(tabs)");
          },
        },
      ]
    );
  };

  if (!user) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { paddingTop: topPadding + 12, backgroundColor: "#11674e", borderBottomColor: "#0D523E" }]}>
          <HeaderNatureBackground />
          <Text style={[styles.title, { color: "#f3f6f4", textAlign: rtl ? "right" : "left", width: "100%" }]}>الملف الشخصي</Text>
        </View>
        <View style={styles.guestCenter}>
          <View style={{ position: "relative" }}>
            <View style={[styles.avatarLarge, { backgroundColor: "#FFFFFF", borderColor: "#1B8A6B", borderWidth: 1.5 }]}>
              <Icon name="person-outline" size={40} color="#11674e" />
            </View>
            <View style={{ position: "absolute", bottom: -2, right: -2, backgroundColor: "#16A34A", borderRadius: 10, width: 22, height: 22, alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderColor: "#FFFFFF" }}>
              <Icon name="leaf" size={12} color="#FFFFFF" />
            </View>
          </View>
          <Text style={[styles.guestTitle, { color: colors.foreground }]}>مرحباً بك</Text>
          <Text style={[styles.guestDesc, { color: colors.mutedForeground }]}>
            سجّل دخولك لحفظ تحليلاتك والوصول لميزات أكثر
          </Text>
          <TouchableOpacity
            style={[styles.primaryBtn, { backgroundColor: colors.primary }]}
            onPress={() => router.push("/auth")}
          >
            <Text style={styles.primaryBtnText}>تسجيل الدخول / إنشاء حساب</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const textPercent = usage && usage.textLimit > 0 ? Math.min((usage.monthlyTextCount / usage.textLimit) * 100, 100) : 0;
  const imagePercent = usage && usage.imageLimit > 0 ? Math.min((usage.monthlyImageCount / usage.imageLimit) * 100, 100) : 0;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View
          style={[styles.profileHeader, { paddingTop: topPadding + 14, paddingBottom: 24, backgroundColor: "#11674e", borderBottomColor: "#0D523E", borderBottomWidth: 1, position: "relative", overflow: "hidden" }]}
        >
          <HeaderNatureBackground />
          {/* Decorative background shapes for richness */}
          <View style={{ position: "absolute", top: -20, left: -20, width: 100, height: 100, borderRadius: 50, backgroundColor: "#FFFFFF12" }} />
          <View style={{ position: "absolute", bottom: -30, right: -15, width: 130, height: 130, borderRadius: 65, backgroundColor: "#F59E0B12" }} />

          <View style={styles.avatarRow}>
            <View style={{ position: "relative" }}>
              <View style={[styles.avatarLarge, { backgroundColor: "#FFFFFF", borderColor: "#1B8A6B", borderWidth: 1.5, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 6, elevation: 3 }]}>
                <Text style={[styles.avatarInitial, { color: "#11674e", fontSize: 36 }]}>{user.name.charAt(0)}</Text>
              </View>
              <View style={{ position: "absolute", bottom: 0, right: 0, backgroundColor: "#16A34A", borderRadius: 11, width: 24, height: 24, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "#FFFFFF" }}>
                <Icon name="leaf" size={13} color="#FFFFFF" />
              </View>
            </View>
          </View>
          <Text style={[styles.userName, { color: "#f3f6f4", fontSize: 28 }]}>{user.name}</Text>
          <Text style={[styles.userEmail, { color: "#E2E8F0", fontSize: 16.5 }]}>{user.email}</Text>
          {user.isPremium && (
            <View style={[styles.premiumBadge, { backgroundColor: "#FFF3D6", borderColor: "#FFE4A0", borderWidth: 1, paddingHorizontal: 14, paddingVertical: 5, borderRadius: 14, marginTop: 6 }]}>
              <Icon name="star" size={15} color="#F59E0B" />
              <Text style={[styles.premiumText, { color: "#D97706", fontFamily: "Tajawal_700Bold" }]}>Premium</Text>
            </View>
          )}
        </View>

        <View style={styles.content}>
          {/* Usage Card */}
          {usage && !usage.isPremium && (
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={[styles.cardHeader, { flexDirection: rtl ? "row-reverse" : "row" }]}>
                <Text style={[styles.cardTitle, { color: colors.foreground }]}>الاستخدام الشهري</Text>
                <Icon name="analytics-outline" size={20} color={colors.primary} />
              </View>

              {/* Text searches */}
              <View style={[styles.usageRow, { flexDirection: rtl ? "row-reverse" : "row" }]}>
                <Text style={[styles.usageLabel, { color: colors.mutedForeground }]}>بحث نصي</Text>
                <Text style={[styles.usageCount, { color: colors.primary }]}>
                  {usage.monthlyTextCount} / {usage.textLimit < 0 ? "∞" : usage.textLimit}
                </Text>
              </View>
              <View style={[styles.progressTrack, { backgroundColor: colors.muted }]}>
                <View style={[styles.progressFill, { width: `${textPercent}%` as any, backgroundColor: textPercent > 80 ? colors.error : colors.primary }]} />
              </View>
              <Text style={[styles.usageRemaining, { color: colors.mutedForeground, textAlign: rtl ? "right" : "left", width: "100%" }]}>
                {usage.textRemaining} بحث نصي متبقٍ هذا الشهر
              </Text>

              {/* Image searches */}
              <View style={[styles.usageRow, { flexDirection: rtl ? "row-reverse" : "row", marginTop: 8 }]}>
                <Text style={[styles.usageLabel, { color: colors.mutedForeground }]}>تحليل صور</Text>
                <Text style={[styles.usageCount, { color: colors.primary }]}>
                  {usage.monthlyImageCount} / {usage.imageLimit < 0 ? "∞" : usage.imageLimit}
                </Text>
              </View>
              <View style={[styles.progressTrack, { backgroundColor: colors.muted }]}>
                <View style={[styles.progressFill, { width: `${imagePercent}%` as any, backgroundColor: imagePercent > 80 ? colors.error : colors.primary }]} />
              </View>
              <Text style={[styles.usageRemaining, { color: colors.mutedForeground, textAlign: rtl ? "right" : "left", width: "100%" }]}>
                {usage.imageRemaining} تحليل صور متبقٍ هذا الشهر
              </Text>
            </View>
          )}

          {/* Upgrade Card — icon on left for LTR, right for RTL; chevron on right for LTR, left for RTL */}
          {!user.isPremium && subscriptionEnabled && (
            <TouchableOpacity
              style={[styles.upgradeCard, { backgroundColor: colors.accent + "18", borderColor: colors.accent + "40", flexDirection: rtl ? "row-reverse" : "row" }]}
              activeOpacity={0.8}
              onPress={() => router.push("/pricing")}
            >
              <Icon name="star" size={28} color={colors.accent} />
              <View style={[styles.upgradeText, { alignItems: rtl ? "flex-end" : "flex-start" }]}>
                <Text style={[styles.upgradeTitle, { color: colors.foreground }]}>ترقية لـ Premium</Text>
                <Text style={[styles.upgradeDesc, { color: colors.mutedForeground }]}>
                  تحليلات غير محدودة شهرياً
                </Text>
              </View>
              {/* chevron-forward for LTR, chevron-back for RTL (points toward the item) */}
              <Icon name={rtl ? "chevron-back" : "chevron-forward"} size={20} color={colors.accent} />
            </TouchableOpacity>
          )}

          {/* Menu Items */}
          {[
            { icon: "star-outline" as const, label: "الباقات", route: "/pricing" },
            { icon: "time-outline" as const, label: "سجل التحليلات", route: "/(tabs)/history" },
            { icon: "shield-checkmark-outline" as const, label: "سياسة الخصوصية", route: "/privacy-policy" },
            { icon: "information-circle-outline" as const, label: "عن التطبيق", route: "/about-system?mode=app" },
          ].map((item) => (
            <TouchableOpacity
              key={item.label}
              style={[styles.menuItem, { backgroundColor: colors.card, borderColor: colors.border, flexDirection: rtl ? "row-reverse" : "row" }]}
              onPress={() => item.route && router.push(item.route as any)}
            >
              <View style={[styles.menuIcon, { backgroundColor: colors.primary + "18" }]}>
                <Icon name={item.icon} size={20} color={colors.primary} />
              </View>
              <View style={[styles.menuLabelWrap, { alignItems: rtl ? "flex-end" : "flex-start" }]}>
                <Text style={[styles.menuLabelText, { color: colors.foreground }]}>{item.label}</Text>
              </View>
              <Icon name={rtl ? "chevron-back" : "chevron-forward"} size={18} color={colors.mutedForeground} />
            </TouchableOpacity>
          ))}

          {/* Sign Out */}
          <TouchableOpacity
            style={[styles.menuItem, { backgroundColor: colors.card, borderColor: colors.error + "30", flexDirection: rtl ? "row-reverse" : "row" }]}
            onPress={handleSignOut}
          >
            <View style={[styles.menuIcon, { backgroundColor: colors.error + "18" }]}>
              <Icon name="log-out-outline" size={20} color={colors.error} />
            </View>
            <View style={[styles.menuLabelWrap, { alignItems: rtl ? "flex-end" : "flex-start" }]}>
              <Text style={[styles.menuLabelText, { color: colors.error }]}>تسجيل الخروج</Text>
            </View>
            <Icon name={rtl ? "chevron-back" : "chevron-forward"} size={18} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 26,
    fontFamily: "Tajawal_700Bold",
  },
  profileHeader: {
    paddingHorizontal: 20,
    paddingBottom: 28,
    alignItems: "center",
    gap: 6,
  },
  avatarRow: { marginBottom: 4 },
  avatarLarge: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitial: {
    fontSize: 34,
    fontFamily: "Tajawal_700Bold",
    color: "#fff",
  },
  userName: {
    fontSize: 24,
    fontFamily: "Tajawal_700Bold",
    color: "#fff",
    textAlign: "center",
  },
  userEmail: {
    fontSize: 15,
    fontFamily: "Tajawal_400Regular",
    color: "rgba(255,255,255,0.75)",
    textAlign: "center",
  },
  premiumBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(255,255,255,0.15)",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 4,
  },
  premiumText: {
    fontSize: 14,
    fontFamily: "Tajawal_700Bold",
  },
  guestCenter: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 40,
    gap: 14,
  },
  guestTitle: {
    fontSize: 24,
    fontFamily: "Tajawal_700Bold",
    textAlign: "center",
  },
  guestDesc: {
    fontSize: 15,
    fontFamily: "Tajawal_400Regular",
    textAlign: "center",
    lineHeight: 23,
  },
  primaryBtn: {
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 14,
    marginTop: 8,
  },
  primaryBtnText: {
    color: "#fff",
    fontFamily: "Tajawal_700Bold",
    fontSize: 16,
  },
  content: {
    padding: 16,
    gap: 10,
  },
  card: {
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    gap: 10,
  },
  cardHeader: {
    alignItems: "center",
    justifyContent: "space-between",
  },
  cardTitle: {
    fontSize: 16.5,
    fontFamily: "Tajawal_700Bold",
  },
  usageRow: {
    alignItems: "baseline",
    justifyContent: "space-between",
  },
  usageCount: {
    fontSize: 24,
    fontFamily: "Tajawal_700Bold",
  },
  usageLabel: {
    fontSize: 13,
    fontFamily: "Tajawal_400Regular",
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 3,
    alignSelf: "flex-start",
  },
  usageRemaining: {
    fontSize: 12,
    fontFamily: "Tajawal_400Regular",
  },
  upgradeCard: {
    alignItems: "center",
    gap: 12,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
  },
  upgradeText: {
    flex: 1,
    gap: 2,
  },
  upgradeTitle: {
    fontSize: 16,
    fontFamily: "Tajawal_700Bold",
  },
  upgradeDesc: {
    fontSize: 13,
    fontFamily: "Tajawal_400Regular",
  },
  menuItem: {
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  menuIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  menuLabelWrap: {
    flex: 1,
  },
  menuLabelText: {
    fontSize: 15,
    fontFamily: "Tajawal_500Medium",
  },
});
