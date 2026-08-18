import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Platform,
  Alert,
  RefreshControl,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Icon } from "@/components/Icon";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContext";
import { useAnalysis } from "@/context/AnalysisContext";
import { getHistory, deleteHistoryItem } from "@/lib/api";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { isRTL } from "@/lib/i18n";
import { TayyibatiTheme } from "@/constants/tayyibatiTheme";

export default function HistoryScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const { setCurrentReport } = useAnalysis();
  const qc = useQueryClient();
  const topPadding = Platform.OS === "web" ? 67 : insets.top;
  const rtl = isRTL();

  const { data: items = [], isLoading, refetch } = useQuery({
    queryKey: ["history", user?.id],
    queryFn: () => (user ? getHistory() : Promise.resolve([])),
    enabled: !!user,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteHistoryItem(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["history", user?.id] }),
  });

  const handleDelete = (id: number) => {
    Alert.alert("حذف", "هل تريد حذف هذا التحليل؟", [
      { text: "إلغاء", style: "cancel" },
      {
        text: "حذف",
        style: "destructive",
        onPress: () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          deleteMutation.mutate(id);
        },
      },
    ]);
  };

  const handleView = (item: any) => {
    setCurrentReport(item.report);
    router.push("/result");
  };

  const typeIcon = (type: string) => {
    if (type === "image") return "image-outline";
    if (type === "label") return "barcode-outline";
    return "search-outline";
  };

  const renderItem = ({ item }: { item: any }) => {
    const rawScore = item.report?.compatibilityScore ?? item.compatibilityScore;
    const isUnknown = item.report?.resultMode === "UNKNOWN_FOOD" || rawScore === null || rawScore === undefined;
    const score = isUnknown ? null : rawScore;
    const scoreColor = score === null ? colors.mutedForeground : score >= 70 ? colors.scoreHigh : score >= 40 ? colors.scoreMid : colors.scoreLow;

    return (
      <TouchableOpacity
        style={[styles.item, { backgroundColor: colors.card, borderColor: colors.border, flexDirection: rtl ? "row-reverse" : "row" }]}
        onPress={() => handleView(item)}
        activeOpacity={0.7}
      >
        {/* For Arabic: Score circle on RIGHT = first in row-reverse */}
        <View style={styles.scoreSection}>
          <View style={[styles.scoreCircle, { backgroundColor: scoreColor + "20", borderColor: scoreColor + "40" }]}>
            <Text style={[styles.scoreText, { color: scoreColor, fontSize: score === null ? 14 : 16 }]}>
              {score === null ? "—" : score}
            </Text>
          </View>
        </View>

        {/* CENTER - Food details */}
        <View style={[styles.centerSection, { alignItems: rtl ? "flex-end" : "flex-start" }]}>
          <Text style={[styles.itemQuery, { color: colors.foreground, textAlign: rtl ? "right" : "left" }]} numberOfLines={1}>
            {item.query}
          </Text>
          <View style={[styles.itemMeta, { flexDirection: rtl ? "row-reverse" : "row" }]}>
            <Icon name={typeIcon(item.analysisType)} size={13} color={colors.mutedForeground} />
            <Text style={[styles.itemDate, { color: colors.mutedForeground }]}>
              {new Date(item.createdAt).toLocaleDateString("ar-SA")}
            </Text>
          </View>
        </View>

        {/* For Arabic: Delete icon on LEFT = last in row-reverse */}
        <View style={styles.deleteSection}>
          <TouchableOpacity onPress={() => handleDelete(item.id)} style={styles.deleteBtn}>
            <Icon name="trash-outline" size={18} color={colors.error} />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPadding + 12, backgroundColor: "#C9E4D4", borderBottomColor: "#A3CDB3" }]}>
        <View style={{ flexDirection: rtl ? "row-reverse" : "row", alignItems: "center", gap: 12, width: "100%" }}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: "#FFFFFF", borderColor: "#A3CDB3", borderWidth: 1, alignItems: "center", justifyContent: "center" }}
            activeOpacity={0.7}
          >
            <Icon name={rtl ? "arrow-forward" : "arrow-back"} size={20} color="#064E24" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: "#064E24", textAlign: rtl ? "right" : "left" }]}>سجل التحليلات</Text>
            {user && (
              <Text style={[styles.subtitle, { color: "#244231", textAlign: rtl ? "right" : "left" }]}>
                {items.length} تحليل
              </Text>
            )}
          </View>
        </View>
      </View>

      {!user ? (
        <View style={styles.emptyCenter}>
          <Icon name="person-outline" size={48} color={colors.mutedForeground} />
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>سجّل دخولك</Text>
          <Text style={[styles.emptyDesc, { color: colors.mutedForeground }]}>
            سجّل دخولك لحفظ تحليلاتك ومراجعتها لاحقاً
          </Text>
          <TouchableOpacity
            style={[styles.loginBtn, { backgroundColor: colors.primary }]}
            onPress={() => router.push("/auth")}
          >
            <Text style={styles.loginBtnText}>تسجيل الدخول</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 100 }}
          refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={colors.primary} />}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            !isLoading ? (
              <View style={styles.emptyCenter}>
                <Icon name="time-outline" size={48} color={colors.mutedForeground} />
                <Text style={[styles.emptyTitle, { color: colors.foreground }]}>لا يوجد سجل</Text>
                <Text style={[styles.emptyDesc, { color: colors.mutedForeground }]}>
                  ابدأ بتحليل طعام لتظهر نتائجك هنا
                </Text>
              </View>
            ) : null
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    gap: 4,
  },
  title: {
    fontSize: 26,
    fontFamily: "Tajawal_700Bold",
  },
  subtitle: {
    fontSize: 15.5,
    fontFamily: "Tajawal_500Medium",
  },
  item: {
    alignItems: "center",
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    gap: 12,
  },
  scoreCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  scoreText: {
    fontSize: 17,
    fontFamily: "Tajawal_700Bold",
  },
  scoreSection: {
    width: 56,
    alignItems: "center",
    justifyContent: "center",
  },
  centerSection: {
    flex: 1,
    gap: 4,
  },
  deleteSection: {
    width: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  itemQuery: {
    fontSize: 16.5,
    fontFamily: "Tajawal_700Bold",
  },
  itemMeta: {
    alignItems: "center",
    gap: 4,
  },
  itemDate: {
    fontSize: 13,
    fontFamily: "Tajawal_400Regular",
  },
  deleteBtn: {
    padding: 6,
  },
  emptyCenter: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 40,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 19.5,
    fontFamily: "Tajawal_700Bold",
    textAlign: "center",
  },
  emptyDesc: {
    fontSize: 15,
    fontFamily: "Tajawal_400Regular",
    textAlign: "center",
    lineHeight: 23,
  },
  loginBtn: {
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 8,
  },
  loginBtnText: {
    color: "#fff",
    fontFamily: "Tajawal_700Bold",
    fontSize: 16,
  },
});
