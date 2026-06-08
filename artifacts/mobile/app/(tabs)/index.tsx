import React, { useState, useEffect } from "react";
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
import { LinearGradient } from "expo-linear-gradient";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContext";
import { getFoodStats } from "@/lib/api";

interface FoodStats {
  total: number;
  allowed: number;
  forbidden: number;
  conditional: number;
  categories: number;
}

export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const [stats, setStats] = useState<FoodStats | null>(null);

  useEffect(() => {
    getFoodStats().then(setStats).catch(() => {});
  }, []);

  const topPadding = Platform.OS === "web" ? 67 : insets.top;

  const quickActions = [
    { icon: "search" as const, label: "بحث بالاسم", desc: "ابحث عن أي طعام أو مكون", route: "/(tabs)/search", color: colors.primary },
    { icon: "camera" as const, label: "تحليل صورة", desc: "صوّر الطعام أو الملصق", route: "/(tabs)/camera", color: colors.accent },
    { icon: "time" as const, label: "السجل", desc: "تاريخ تحليلاتك", route: "/(tabs)/history", color: colors.secondary + "DD" },
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <LinearGradient
          colors={[colors.primary, colors.primary + "CC"]}
          style={[styles.header, { paddingTop: topPadding + 16 }]}
        >
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.appName}>طيباتي</Text>
              <Text style={styles.appSubtitle}>Tayyibati</Text>
            </View>
            <TouchableOpacity
              style={[styles.profileBtn, { backgroundColor: "rgba(255,255,255,0.2)" }]}
              onPress={() => router.push("/(tabs)/profile")}
            >
              <Ionicons name={user ? "person" : "person-outline"} size={22} color="#fff" />
            </TouchableOpacity>
          </View>
          <Text style={styles.headerGreeting}>
            {user ? `أهلاً، ${user.name}` : "مرحباً بك في طيباتي"}
          </Text>
          <Text style={styles.headerDesc}>
            تحقق من توافق الأطعمة مع نظام الطيبات
          </Text>
        </LinearGradient>

        <View style={styles.content}>
          {/* Quick Actions */}
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>ابدأ التحليل</Text>
          <View style={styles.actionsGrid}>
            {quickActions.map((action) => (
              <TouchableOpacity
                key={action.label}
                style={[styles.actionCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={() => router.push(action.route as any)}
                activeOpacity={0.7}
              >
                <View style={[styles.actionIcon, { backgroundColor: action.color + "20" }]}>
                  <Ionicons name={action.icon} size={26} color={action.color} />
                </View>
                <Text style={[styles.actionLabel, { color: colors.foreground }]}>{action.label}</Text>
                <Text style={[styles.actionDesc, { color: colors.mutedForeground }]}>{action.desc}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Database Stats */}
          {stats && (
            <>
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>قاعدة البيانات</Text>
              <View style={[styles.statsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.statsTitle, { color: colors.foreground }]}>
                  {stats.total} طعام ومكون
                </Text>
                <View style={styles.statsRow}>
                  {[
                    { count: stats.allowed, label: "مسموح", color: colors.allowed },
                    { count: stats.forbidden, label: "محظور", color: colors.forbidden },
                    { count: stats.conditional, label: "مشروط", color: colors.conditional },
                    { count: stats.categories, label: "فئة", color: colors.accent },
                  ].map((s) => (
                    <View key={s.label} style={styles.statItem}>
                      <Text style={[styles.statCount, { color: s.color }]}>{s.count}</Text>
                      <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{s.label}</Text>
                    </View>
                  ))}
                </View>
              </View>
            </>
          )}

          {/* Info Card */}
          <View style={[styles.infoCard, { backgroundColor: colors.primary + "15", borderColor: colors.primary + "30" }]}>
            <Ionicons name="shield-checkmark" size={28} color={colors.primary} />
            <View style={styles.infoText}>
              <Text style={[styles.infoTitle, { color: colors.foreground }]}>قاعدة بيانات موثوقة</Text>
              <Text style={[styles.infoDesc, { color: colors.mutedForeground }]}>
                جميع الأحكام مستندة لقاعدة بيانات طيبات. الذكاء الاصطناعي يُستخدم فقط لتحديد المكونات.
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flex: 1 },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 28,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  appName: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    color: "#fff",
    textAlign: "right",
  },
  appSubtitle: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.7)",
    textAlign: "right",
  },
  profileBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  headerGreeting: {
    fontSize: 20,
    fontFamily: "Inter_600SemiBold",
    color: "#fff",
    textAlign: "right",
    marginBottom: 4,
  },
  headerDesc: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.8)",
    textAlign: "right",
  },
  content: {
    padding: 16,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    textAlign: "right",
    marginTop: 12,
    marginBottom: 4,
  },
  actionsGrid: {
    flexDirection: "row",
    gap: 10,
  },
  actionCard: {
    flex: 1,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    gap: 8,
  },
  actionIcon: {
    width: 50,
    height: 50,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  actionLabel: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    textAlign: "center",
  },
  actionDesc: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 16,
  },
  statsCard: {
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    gap: 12,
  },
  statsTitle: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    textAlign: "right",
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  statItem: {
    alignItems: "center",
    gap: 4,
  },
  statCount: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
  },
  statLabel: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  infoCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 8,
  },
  infoText: {
    flex: 1,
    gap: 4,
  },
  infoTitle: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    textAlign: "right",
  },
  infoDesc: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    textAlign: "right",
    lineHeight: 20,
  },
});
