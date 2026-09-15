import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";
import { getHistory } from "@/lib/api";
import { Icon } from "@/components/Icon";
import { isRTL } from "@/lib/i18n";
import { useRouter } from "expo-router";
import { useAnalysis } from "@/context/AnalysisContext";

export function HomeRecentVerifications() {
  const router = useRouter();
  const { user } = useAuth();
  const { setCurrentReport } = useAnalysis();
  const rtl = isRTL();

  const { data: items = [] } = useQuery({
    queryKey: ["history", user?.id],
    queryFn: () => (user ? getHistory() : Promise.resolve([])),
    enabled: !!user,
  });

  const recent = items.slice(0, 3);

  // If no history records, preserve original behavior (do not show empty section)
  if (recent.length === 0) return null;

  const handleView = (item: any) => {
    if (item?.report) {
      setCurrentReport(item.report);
      router.push("/result");
    }
  };

  return (
    <View style={styles.container}>
      {/* Header Row: آخر عمليات التحقق 🛡️ | عرض السجل < */}
      <View style={[styles.headerRow, { flexDirection: rtl ? "row-reverse" : "row" }]}>
        <View style={[styles.titleBox, { flexDirection: rtl ? "row-reverse" : "row" }]}>
          <Icon name="shield-checkmark" size={18} color="#008C5A" strokeWidth={2} />
          <Text style={styles.sectionTitle}>آخر عمليات التحقق</Text>
        </View>

        <TouchableOpacity
          onPress={() => router.push("/(tabs)/history")}
          activeOpacity={0.7}
          style={[styles.viewAllBtn, { flexDirection: rtl ? "row-reverse" : "row" }]}
        >
          <Text style={styles.viewAllText}>عرض السجل</Text>
          <Icon
            name={rtl ? "chevron-back" : "chevron-forward"}
            size={14}
            color="#008C5A"
            strokeWidth={2.5}
          />
        </TouchableOpacity>
      </View>

      {/* List of recent verification cards */}
      <View style={styles.list}>
        {recent.map((item: any, i: number) => {
          let statusText = "يحتاج تفاصيل";
          let statusColor = "#6B7280";
          let statusBg = "#F3F4F6";

          if (item.report?.overallStatus === "ALLOWED") {
            statusText = "مسموح";
            statusColor = "#15803D";
            statusBg = "#DCFCE7";
          } else if (item.report?.overallStatus === "FORBIDDEN") {
            statusText = "ممنوع";
            statusColor = "#DC2626";
            statusBg = "#FEE2E2";
          } else if (item.report?.overallStatus === "CONDITIONAL") {
            statusText = "مشروط";
            statusColor = "#D97706";
            statusBg = "#FEF3C7";
          }

          return (
            <TouchableOpacity
              key={item.id || i}
              style={styles.card}
              activeOpacity={0.75}
              onPress={() => handleView(item)}
            >
              <View style={[{ flexDirection: rtl ? "row-reverse" : "row" }, styles.cardRow]}>
                <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
                <Text
                  style={[
                    styles.foodName,
                    { textAlign: rtl ? "right" : "left" },
                  ]}
                  numberOfLines={1}
                >
                  {item.report?.query || "طعام"}
                </Text>
                <View style={[styles.badge, { backgroundColor: statusBg }]}>
                  <Text style={[styles.badgeText, { color: statusColor }]}>
                    {statusText}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 16,
    paddingHorizontal: 16,
    width: "100%",
  },
  headerRow: {
    justifyContent: "space-between",
    alignItems: "center",
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
  viewAllBtn: {
    alignItems: "center",
    gap: 2,
  },
  viewAllText: {
    fontSize: 13.5,
    fontFamily: "Tajawal_700Bold",
    color: "#15803D",
  },
  list: {
    gap: 10,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#DCFCE7",
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  cardRow: {
    alignItems: "center",
    gap: 10,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  foodName: {
    flex: 1,
    fontSize: 15,
    fontFamily: "Tajawal_700Bold",
    color: "#1F2937",
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 12.5,
    fontFamily: "Tajawal_700Bold",
  },
});
