import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContext";
import { getUserUsage } from "@/lib/api";

interface UsageInfo {
  dailyCount: number;
  dailyLimit: number;
  isPremium: boolean;
  remainingToday: number;
}

export default function ProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, signOut } = useAuth();
  const [usage, setUsage] = useState<UsageInfo | null>(null);
  const topPadding = Platform.OS === "web" ? 67 : insets.top;

  useEffect(() => {
    if (user) {
      getUserUsage(user.id).then(setUsage).catch(() => {});
    }
  }, [user]);

  const handleSignOut = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await signOut();
  };

  if (!user) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { paddingTop: topPadding + 12, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
          <Text style={[styles.title, { color: colors.foreground }]}>حسابي</Text>
        </View>
        <View style={styles.guestCenter}>
          <View style={[styles.avatarLarge, { backgroundColor: colors.muted }]}>
            <Ionicons name="person-outline" size={40} color={colors.mutedForeground} />
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

  const usagePercent = usage ? Math.min((usage.dailyCount / (usage.isPremium ? 1 : 10)) * 100, 100) : 0;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <LinearGradient
          colors={[colors.primary, colors.primary + "BB"]}
          style={[styles.profileHeader, { paddingTop: topPadding + 12 }]}
        >
          <View style={styles.avatarRow}>
            <View style={[styles.avatarLarge, { backgroundColor: "rgba(255,255,255,0.2)" }]}>
              <Text style={styles.avatarInitial}>{user.name.charAt(0)}</Text>
            </View>
          </View>
          <Text style={styles.userName}>{user.name}</Text>
          <Text style={styles.userEmail}>{user.email}</Text>
          {user.isPremium && (
            <View style={styles.premiumBadge}>
              <Ionicons name="star" size={14} color={colors.accent} />
              <Text style={[styles.premiumText, { color: colors.accent }]}>Premium</Text>
            </View>
          )}
        </LinearGradient>

        <View style={styles.content}>
          {/* Usage Card */}
          {usage && !usage.isPremium && (
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.cardHeader}>
                <Ionicons name="analytics-outline" size={20} color={colors.primary} />
                <Text style={[styles.cardTitle, { color: colors.foreground }]}>الاستخدام اليومي</Text>
              </View>
              <View style={styles.usageRow}>
                <Text style={[styles.usageCount, { color: colors.primary }]}>
                  {usage.dailyCount} / {usage.dailyLimit}
                </Text>
                <Text style={[styles.usageLabel, { color: colors.mutedForeground }]}>تحليل اليوم</Text>
              </View>
              <View style={[styles.progressTrack, { backgroundColor: colors.muted }]}>
                <View style={[styles.progressFill, { width: `${usagePercent}%` as any, backgroundColor: usagePercent > 80 ? colors.error : colors.primary }]} />
              </View>
              <Text style={[styles.usageRemaining, { color: colors.mutedForeground }]}>
                {usage.remainingToday} تحليل متبقي
              </Text>
            </View>
          )}

          {/* Upgrade Card */}
          {!user.isPremium && (
            <TouchableOpacity
              style={[styles.upgradeCard, { backgroundColor: colors.accent + "18", borderColor: colors.accent + "40" }]}
              activeOpacity={0.8}
              onPress={() => router.push("/pricing")}
            >
              <Ionicons name="star" size={28} color={colors.accent} />
              <View style={styles.upgradeText}>
                <Text style={[styles.upgradeTitle, { color: colors.foreground }]}>ترقية لـ Premium</Text>
                <Text style={[styles.upgradeDesc, { color: colors.mutedForeground }]}>
                  تحليلات غير محدودة يومياً
                </Text>
              </View>
              <Ionicons name="chevron-back" size={20} color={colors.accent} />
            </TouchableOpacity>
          )}

          {/* Menu Items */}
          {[
            { icon: "star-outline" as const, label: "الباقات", route: "/pricing" },
            { icon: "time-outline" as const, label: "سجل التحليلات", route: "/(tabs)/history" },
            { icon: "shield-checkmark-outline" as const, label: "الخصوصية والأمان", route: null },
            { icon: "information-circle-outline" as const, label: "عن التطبيق", route: null },
          ].map((item) => (
            <TouchableOpacity
              key={item.label}
              style={[styles.menuItem, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={() => item.route && router.push(item.route as any)}
            >
              <Ionicons name="chevron-back" size={18} color={colors.mutedForeground} />
              <Text style={[styles.menuLabel, { color: colors.foreground }]}>{item.label}</Text>
              <View style={[styles.menuIcon, { backgroundColor: colors.primary + "18" }]}>
                <Ionicons name={item.icon} size={20} color={colors.primary} />
              </View>
            </TouchableOpacity>
          ))}

          {/* Sign Out */}
          <TouchableOpacity
            style={[styles.menuItem, { backgroundColor: colors.card, borderColor: colors.error + "30" }]}
            onPress={handleSignOut}
          >
            <Ionicons name="chevron-back" size={18} color={colors.mutedForeground} />
            <Text style={[styles.menuLabel, { color: colors.error }]}>تسجيل الخروج</Text>
            <View style={[styles.menuIcon, { backgroundColor: colors.error + "18" }]}>
              <Ionicons name="log-out-outline" size={20} color={colors.error} />
            </View>
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
    fontSize: 22,
    fontFamily: "Tajawal_700Bold",
    textAlign: "right",
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
    fontSize: 32,
    fontFamily: "Tajawal_700Bold",
    color: "#fff",
  },
  userName: {
    fontSize: 22,
    fontFamily: "Tajawal_700Bold",
    color: "#fff",
  },
  userEmail: {
    fontSize: 14,
    fontFamily: "Tajawal_400Regular",
    color: "rgba(255,255,255,0.75)",
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
    fontSize: 13,
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
    fontSize: 22,
    fontFamily: "Tajawal_700Bold",
    textAlign: "center",
  },
  guestDesc: {
    fontSize: 14,
    fontFamily: "Tajawal_400Regular",
    textAlign: "center",
    lineHeight: 22,
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
    fontSize: 15,
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
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    justifyContent: "flex-end",
  },
  cardTitle: {
    fontSize: 15,
    fontFamily: "Tajawal_700Bold",
  },
  usageRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 6,
    justifyContent: "flex-end",
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
  },
  usageRemaining: {
    fontSize: 12,
    fontFamily: "Tajawal_400Regular",
    textAlign: "right",
  },
  upgradeCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
  },
  upgradeText: {
    flex: 1,
  },
  upgradeTitle: {
    fontSize: 16,
    fontFamily: "Tajawal_700Bold",
    textAlign: "right",
  },
  upgradeDesc: {
    fontSize: 13,
    fontFamily: "Tajawal_400Regular",
    textAlign: "right",
  },
  menuItem: {
    flexDirection: "row",
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
  menuLabel: {
    flex: 1,
    fontSize: 15,
    fontFamily: "Tajawal_500Medium",
    textAlign: "right",
  },
});
