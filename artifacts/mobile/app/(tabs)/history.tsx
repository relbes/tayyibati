import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ScrollView,
  TouchableOpacity,
  Platform,
  Alert,
  RefreshControl,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import Svg, {
  Path,
  Circle,
  Rect,
  Defs,
  RadialGradient,
  LinearGradient,
  Stop,
  Ellipse,
} from "react-native-svg";
import { Icon } from "@/components/Icon";
import { BackButton } from "@/components/BackButton";
import { PageHeader } from "@/components/PageHeader";
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
  const topPadding = Platform.OS === "web" ? 16 : Math.max(insets.top, 44);
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
        style={[
          styles.item,
          {
            backgroundColor: colors.card,
            borderColor: colors.border,
            flexDirection: rtl ? "row-reverse" : "row",
            marginHorizontal: 16,
            marginBottom: 10,
          },
        ]}
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
    <View style={styles.container}>
      {!user ? (
        <ScrollView contentContainerStyle={{ flexGrow: 1, paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
          <PageHeader
            title="سجل التحليلات"
            subtitle="جميع عمليات التحقق السابقة"
            badgeType="history"
          />
          <View style={styles.emptyCenter}>
            <Icon name="person" size={48} color={colors.mutedForeground} />
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
        </ScrollView>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          ListHeaderComponent={
            <View style={{ marginBottom: 14 }}>
              <PageHeader
                title="سجل التحليلات"
                subtitle="جميع عمليات التحقق السابقة"
                badgeType="history"
              />
            </View>
          }
          contentContainerStyle={{ paddingBottom: 100 }}
          refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={colors.primary} />}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            !isLoading ? (
              <View style={[styles.emptyCenter, { marginTop: 40 }]}>
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
  container: {
    flex: 1,
    backgroundColor: "#F8FEF9",
  },
  headerContainer: {
    position: "relative",
    backgroundColor: "#F8FEF9",
    borderRadius: 0,
    borderBottomWidth: 0,
    overflow: "hidden",
  },
  posAbsolute: {
    position: "absolute",
  },
  bgHaloLeft: {
    position: "absolute",
    left: -25,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: "#EDFBF2",
    opacity: 0.85,
  },
  bgHaloRight: {
    position: "absolute",
    right: -25,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: "#EDFBF2",
    opacity: 0.85,
  },
  backBtn: {
    position: "absolute",
    right: 18,
    zIndex: 20,
  },
  headerCenterSection: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 75,
    zIndex: 5,
  },
  headerCenterBadge: {
    width: 82,
    height: 82,
    borderRadius: 41,
    backgroundColor: "rgba(230, 247, 237, 0.95)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(13, 118, 78, 0.12)",
    shadowColor: "#0D764E",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  title: {
    fontSize: 26,
    fontFamily: "Tajawal_700Bold",
    color: "#0C6246",
    textAlign: "center",
    marginTop: 12,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: "Tajawal_500Medium",
    color: "#64748B",
    textAlign: "center",
    marginTop: 5,
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
