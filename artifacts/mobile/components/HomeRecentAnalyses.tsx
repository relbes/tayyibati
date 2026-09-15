import React, { useRef } from "react";
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";
import { getHistory } from "@/lib/api";
import { Icon } from "@/components/Icon";
import { isRTL } from "@/lib/i18n";
import { useRouter } from "expo-router";
import { useAnalysis } from "@/context/AnalysisContext";

export function HomeRecentAnalyses() {
  const router = useRouter();
  const { user } = useAuth();
  const { setCurrentReport } = useAnalysis();
  const rtl = isRTL();
  const scrollRef = useRef<ScrollView>(null);

  const { data: items = [] } = useQuery({
    queryKey: ["history", user?.id],
    queryFn: () => (user ? getHistory() : Promise.resolve([])),
    enabled: !!user,
  });

  // If user has history, use it; otherwise provide default recent searches to match the reference UI
  const displayItems =
    items.length > 0
      ? items.slice(0, 6).map((item: any) => ({
          id: item.id || item.report?.query,
          query: item.report?.query || "طعام",
          itemData: item,
        }))
      : [
          { id: "1", query: "دجاج مشوي", itemData: null },
          { id: "2", query: "موز", itemData: null },
          { id: "3", query: "حليب", itemData: null },
          { id: "4", query: "تفاح", itemData: null },
        ];

  const handlePress = (entry: any) => {
    if (entry.itemData?.report) {
      setCurrentReport(entry.itemData.report);
      router.push("/result");
    } else {
      router.push("/(tabs)/search");
    }
  };

  return (
    <View style={styles.container}>
      {/* Header Row: آخر عمليات البحث 🕒 | مسح الكل < */}
      <View style={[styles.headerRow, { flexDirection: rtl ? "row-reverse" : "row" }]}>
        <View style={[styles.titleBox, { flexDirection: rtl ? "row-reverse" : "row" }]}>
          <Icon name="time-outline" size={18} color="#008C5A" strokeWidth={2} />
          <Text style={styles.sectionTitle}>آخر عمليات البحث</Text>
        </View>

        <TouchableOpacity
          onPress={() => router.push("/(tabs)/history")}
          activeOpacity={0.7}
          style={[styles.clearBtn, { flexDirection: rtl ? "row-reverse" : "row" }]}
        >
          <Text style={styles.clearText}>مسح الكل</Text>
          <Icon
            name={rtl ? "chevron-back" : "chevron-forward"}
            size={14}
            color="#008C5A"
            strokeWidth={2.5}
          />
        </TouchableOpacity>
      </View>

      {/* Horizontal Scrollable Chips */}
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        onContentSizeChange={() => {
          if (rtl) {
            scrollRef.current?.scrollToEnd({ animated: false });
          }
        }}
        contentContainerStyle={[
          styles.scrollContent,
          { flexDirection: rtl ? "row-reverse" : "row" },
        ]}
      >
        {displayItems.map((entry: any) => (
          <TouchableOpacity
            key={entry.id}
            style={[
              styles.chip,
              { flexDirection: rtl ? "row-reverse" : "row" },
            ]}
            activeOpacity={0.75}
            onPress={() => handlePress(entry)}
          >
            <Icon name="time-outline" size={15} color="#9CA3AF" strokeWidth={1.8} />
            <Text style={styles.chipText}>{entry.query}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 16,
    width: "100%",
  },
  headerRow: {
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  titleBox: {
    alignItems: "center",
    gap: 6,
  },
  sectionTitle: {
    fontSize: 16.5,
    fontFamily: "Tajawal_700Bold",
    color: "#111827",
  },
  clearBtn: {
    alignItems: "center",
    gap: 2,
  },
  clearText: {
    fontSize: 13.5,
    fontFamily: "Tajawal_700Bold",
    color: "#15803D",
  },
  scrollContent: {
    paddingHorizontal: 16,
    gap: 8,
    paddingVertical: 2,
  },
  chip: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#DCFCE7",
    paddingHorizontal: 15,
    paddingVertical: 9,
    alignItems: "center",
    gap: 7,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  chipText: {
    fontSize: 14.5,
    fontFamily: "Tajawal_700Bold",
    color: "#374151",
  },
});
