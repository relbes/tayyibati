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
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContext";
import { useAnalysis } from "@/context/AnalysisContext";
import { getHistory, deleteHistoryItem } from "@/lib/api";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export default function HistoryScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const { setCurrentReport } = useAnalysis();
  const qc = useQueryClient();
  const topPadding = Platform.OS === "web" ? 67 : insets.top;

  const { data: items = [], isLoading, refetch } = useQuery({
    queryKey: ["history", user?.id],
    queryFn: () => (user ? getHistory(user.id) : Promise.resolve([])),
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
    const score = item.compatibilityScore;
    const scoreColor = score >= 70 ? colors.scoreHigh : score >= 40 ? colors.scoreMid : colors.scoreLow;

    return (
      <TouchableOpacity
        style={[styles.item, { backgroundColor: colors.card, borderColor: colors.border }]}
        onPress={() => handleView(item)}
        activeOpacity={0.7}
      >
        <View style={[styles.scoreCircle, { backgroundColor: scoreColor + "20", borderColor: scoreColor + "40" }]}>
          <Text style={[styles.scoreText, { color: scoreColor }]}>{score}</Text>
        </View>
        <View style={styles.itemInfo}>
          <Text style={[styles.itemQuery, { color: colors.foreground }]} numberOfLines={1}>
            {item.query}
          </Text>
          <View style={styles.itemMeta}>
            <Ionicons name={typeIcon(item.analysisType)} size={13} color={colors.mutedForeground} />
            <Text style={[styles.itemDate, { color: colors.mutedForeground }]}>
              {new Date(item.createdAt).toLocaleDateString("ar-SA")}
            </Text>
          </View>
        </View>
        <TouchableOpacity onPress={() => handleDelete(item.id)} style={styles.deleteBtn}>
          <Ionicons name="trash-outline" size={18} color={colors.error} />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPadding + 12, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.foreground }]}>سجل التحليلات</Text>
        {user && (
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            {items.length} تحليل
          </Text>
        )}
      </View>

      {!user ? (
        <View style={styles.emptyCenter}>
          <Ionicons name="person-outline" size={48} color={colors.mutedForeground} />
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
                <Ionicons name="time-outline" size={48} color={colors.mutedForeground} />
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
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    textAlign: "right",
  },
  subtitle: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    textAlign: "right",
  },
  item: {
    flexDirection: "row",
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
    fontSize: 16,
    fontFamily: "Inter_700Bold",
  },
  itemInfo: {
    flex: 1,
    gap: 4,
  },
  itemQuery: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    textAlign: "right",
  },
  itemMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    justifyContent: "flex-end",
  },
  itemDate: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
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
    fontSize: 18,
    fontFamily: "Inter_600SemiBold",
    textAlign: "center",
  },
  emptyDesc: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 22,
  },
  loginBtn: {
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 8,
  },
  loginBtnText: {
    color: "#fff",
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
  },
});
