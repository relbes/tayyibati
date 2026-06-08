import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  FlatList,
  Platform,
  Alert,
  RefreshControl,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listFoods, createFood, deleteFood } from "@/lib/api";

type FoodStatus = "allowed" | "forbidden" | "conditional";

export default function AdminScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const qc = useQueryClient();
  const topPadding = Platform.OS === "web" ? 67 : insets.top;

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FoodStatus | "all">("all");
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ nameAr: "", nameEn: "", category: "", status: "allowed" as FoodStatus, reason: "" });

  const { data: foods = [], isLoading, refetch } = useQuery({
    queryKey: ["foods", search, filter],
    queryFn: () => listFoods({ search: search || undefined, status: filter === "all" ? undefined : filter, limit: 100 }),
  });

  const addMutation = useMutation({
    mutationFn: createFood,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["foods"] });
      setShowAdd(false);
      setForm({ nameAr: "", nameEn: "", category: "", status: "allowed", reason: "" });
    },
    onError: () => Alert.alert("خطأ", "فشل إضافة العنصر"),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteFood,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["foods"] }),
  });

  const handleDelete = (id: number, name: string) => {
    Alert.alert("حذف", `حذف "${name}"؟`, [
      { text: "إلغاء", style: "cancel" },
      { text: "حذف", style: "destructive", onPress: () => deleteMutation.mutate(id) },
    ]);
  };

  const statusColor = (s: FoodStatus) =>
    s === "allowed" ? colors.allowed : s === "forbidden" ? colors.forbidden : colors.conditional;

  const statusLabel = (s: FoodStatus) =>
    s === "allowed" ? "مسموح" : s === "forbidden" ? "محظور" : "مشروط";

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPadding + 8, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.foreground }]}>لوحة الإدارة</Text>
        <TouchableOpacity onPress={() => setShowAdd(!showAdd)}>
          <Ionicons name={showAdd ? "close-circle" : "add-circle"} size={26} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Add Form */}
      {showAdd && (
        <View style={[styles.addForm, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
          <Text style={[styles.addTitle, { color: colors.foreground }]}>إضافة عنصر</Text>
          {[
            { key: "nameAr", label: "الاسم بالعربي", placeholder: "مثال: لحم الخنزير" },
            { key: "nameEn", label: "الاسم بالإنجليزي", placeholder: "e.g. Pork" },
            { key: "category", label: "الفئة", placeholder: "مثال: لحوم" },
            { key: "reason", label: "السبب (اختياري)", placeholder: "سبب الحكم" },
          ].map((f) => (
            <TextInput
              key={f.key}
              style={[styles.formInput, { backgroundColor: colors.muted, borderColor: colors.border, color: colors.foreground }]}
              placeholder={f.placeholder}
              placeholderTextColor={colors.mutedForeground}
              value={form[f.key as keyof typeof form]}
              onChangeText={(v) => setForm((prev) => ({ ...prev, [f.key]: v }))}
              textAlign="right"
            />
          ))}
          <View style={styles.statusRow}>
            {(["allowed", "forbidden", "conditional"] as FoodStatus[]).map((s) => (
              <TouchableOpacity
                key={s}
                style={[styles.statusChip, { borderColor: statusColor(s), backgroundColor: form.status === s ? statusColor(s) : "transparent" }]}
                onPress={() => setForm((p) => ({ ...p, status: s }))}
              >
                <Text style={[styles.statusChipText, { color: form.status === s ? "#fff" : statusColor(s) }]}>
                  {statusLabel(s)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity
            style={[styles.addBtn, { backgroundColor: colors.primary, opacity: addMutation.isPending ? 0.7 : 1 }]}
            onPress={() => {
              if (!form.nameAr || !form.nameEn || !form.category) {
                Alert.alert("خطأ", "الاسم والفئة مطلوبة");
                return;
              }
              addMutation.mutate(form);
            }}
            disabled={addMutation.isPending}
          >
            <Text style={styles.addBtnText}>{addMutation.isPending ? "جاري الإضافة..." : "إضافة"}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Search & Filter */}
      <View style={[styles.searchBar, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <View style={[styles.searchInput, { backgroundColor: colors.muted, borderColor: colors.border }]}>
          <Ionicons name="search" size={16} color={colors.mutedForeground} />
          <TextInput
            style={[styles.searchText, { color: colors.foreground }]}
            placeholder="بحث..."
            placeholderTextColor={colors.mutedForeground}
            value={search}
            onChangeText={setSearch}
            textAlign="right"
          />
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          {(["all", "allowed", "forbidden", "conditional"] as const).map((f) => (
            <TouchableOpacity
              key={f}
              style={[styles.filterChip, { backgroundColor: filter === f ? colors.primary : colors.muted, borderColor: colors.border }]}
              onPress={() => setFilter(f)}
            >
              <Text style={[styles.filterText, { color: filter === f ? "#fff" : colors.mutedForeground }]}>
                {f === "all" ? "الكل" : f === "allowed" ? "مسموح" : f === "forbidden" ? "محظور" : "مشروط"}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* List */}
      <FlatList
        data={foods}
        keyExtractor={(item: any) => String(item.id)}
        renderItem={({ item }: { item: any }) => (
          <View style={[styles.foodItem, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.statusDot, { backgroundColor: statusColor(item.status) }]} />
            <View style={styles.foodInfo}>
              <Text style={[styles.foodNameAr, { color: colors.foreground }]}>{item.nameAr}</Text>
              <Text style={[styles.foodNameEn, { color: colors.mutedForeground }]}>{item.nameEn}</Text>
              {item.reason && (
                <Text style={[styles.foodReason, { color: colors.mutedForeground }]} numberOfLines={1}>{item.reason}</Text>
              )}
            </View>
            <View style={styles.foodRight}>
              <Text style={[styles.foodStatus, { color: statusColor(item.status) }]}>{statusLabel(item.status)}</Text>
              <TouchableOpacity onPress={() => handleDelete(item.id, item.nameAr)}>
                <Ionicons name="trash-outline" size={18} color={colors.error} />
              </TouchableOpacity>
            </View>
          </View>
        )}
        contentContainerStyle={{ padding: 12, gap: 8, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={colors.primary} />}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          !isLoading ? (
            <View style={styles.emptyCenter}>
              <Ionicons name="server-outline" size={40} color={colors.mutedForeground} />
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>لا توجد بيانات</Text>
            </View>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  title: { fontSize: 18, fontFamily: "Inter_700Bold" },
  addForm: {
    padding: 16,
    gap: 10,
    borderBottomWidth: 1,
  },
  addTitle: { fontSize: 16, fontFamily: "Inter_700Bold", textAlign: "right" },
  formInput: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
  statusRow: { flexDirection: "row", gap: 8, justifyContent: "flex-end" },
  statusChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  statusChipText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  addBtn: {
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
  },
  addBtnText: { color: "#fff", fontFamily: "Inter_700Bold", fontSize: 15 },
  searchBar: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 10,
    borderBottomWidth: 1,
  },
  searchInput: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  searchText: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular" },
  filterRow: { gap: 8 },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  filterText: { fontSize: 12, fontFamily: "Inter_500Medium" },
  foodItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    gap: 10,
  },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginTop: 2 },
  foodInfo: { flex: 1, gap: 2 },
  foodNameAr: { fontSize: 14, fontFamily: "Inter_600SemiBold", textAlign: "right" },
  foodNameEn: { fontSize: 12, fontFamily: "Inter_400Regular", textAlign: "right" },
  foodReason: { fontSize: 11, fontFamily: "Inter_400Regular", textAlign: "right" },
  foodRight: { alignItems: "flex-end", gap: 6 },
  foodStatus: { fontSize: 11, fontFamily: "Inter_500Medium" },
  emptyCenter: { alignItems: "center", padding: 40, gap: 10 },
  emptyText: { fontSize: 15, fontFamily: "Inter_400Regular" },
});
