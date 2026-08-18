import React from "react";
import { View, TouchableOpacity, StyleSheet } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";
import { getHistory } from "@/lib/api";
import { Icon } from "@/components/Icon";
import { useColors } from "@/hooks/useColors";
import { LocalizedText } from "./LocalizedText";
import { isRTL, t } from "@/lib/i18n";
import { useRouter } from "expo-router";
import { useAnalysis } from "@/context/AnalysisContext";
import { TayyibatiTheme } from "@/constants/tayyibatiTheme";

export function HomeRecentAnalyses() {
  const colors = useColors();
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

  if (recent.length === 0) return null;

  const handleView = (item: any) => {
    setCurrentReport(item.report);
    router.push("/result");
  };

  return (
    <View style={styles.container}>
      <View style={[{ flexDirection: rtl ? "row-reverse" : "row" }, styles.header]}>
        <View style={[{ flexDirection: rtl ? "row-reverse" : "row" }, styles.titleBox]}>
          <Icon name="time-outline" size={18} color={TayyibatiTheme.colors.primary} />
          <LocalizedText style={[styles.sectionTitle, { color: colors.foreground }]}>
            {t("home.recentAnalyses")}
          </LocalizedText>
        </View>

        <TouchableOpacity
          onPress={() => router.push("/(tabs)/history")}
          activeOpacity={0.7}
          style={[{ flexDirection: rtl ? "row-reverse" : "row" }, styles.viewAllBtn]}
        >
          <LocalizedText style={[styles.viewAll, { color: TayyibatiTheme.colors.primary }]}>
            {t("home.viewAll")}
          </LocalizedText>
          <Icon name={rtl ? "chevron-back" : "chevron-forward"} size={14} color={TayyibatiTheme.colors.primary} />
        </TouchableOpacity>
      </View>

      <View style={styles.list}>
        {recent.map((item: any, i: number) => {
          let statusText = t("status.unknown");
          let statusColor = colors.unknown;
          let statusBg: string = TayyibatiTheme.colors.surfaceWarm;

          if (item.report.overallStatus === "ALLOWED") {
            statusText = t("status.allowed");
            statusColor = TayyibatiTheme.colors.primary;
            statusBg = TayyibatiTheme.colors.greenCard;
          } else if (item.report.overallStatus === "FORBIDDEN") {
            statusText = t("status.forbidden");
            statusColor = TayyibatiTheme.colors.danger;
            statusBg = TayyibatiTheme.colors.pinkCard;
          } else if (item.report.overallStatus === "CONDITIONAL") {
            statusText = t("status.conditional");
            statusColor = TayyibatiTheme.colors.orangeDark;
            statusBg = TayyibatiTheme.colors.orangeCard;
          } else if (item.report.overallStatus === "REQUIRES_INFO") {
            statusText = t("status.unknown");
            statusColor = colors.unknown;
            statusBg = colors.muted;
          }

          return (
            <TouchableOpacity
              key={i}
              style={[
                styles.card,
                {
                  backgroundColor: TayyibatiTheme.colors.surface,
                  borderColor: TayyibatiTheme.colors.borderSoft,
                },
              ]}
              activeOpacity={0.75}
              onPress={() => handleView(item)}
            >
              <View style={[{ flexDirection: rtl ? "row-reverse" : "row" }, styles.row]}>
                <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
                <LocalizedText
                  style={[
                    styles.foodName,
                    { color: TayyibatiTheme.colors.text, flex: 1, textAlign: rtl ? "right" : "left" },
                  ]}
                  numberOfLines={1}
                >
                  {item.report.query}
                </LocalizedText>
                <View style={[styles.badge, { backgroundColor: statusBg }]}>
                  <LocalizedText style={[styles.badgeText, { color: statusColor }]}>
                    {statusText}
                  </LocalizedText>
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
    marginTop: 22,
    paddingHorizontal: 16,
  },
  header: {
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  titleBox: {
    alignItems: "center",
    gap: 8,
  },
  sectionTitle: {
    fontSize: TayyibatiTheme.typography.size.lg,
    fontFamily: TayyibatiTheme.typography.fontFamily.bold,
  },
  viewAllBtn: {
    alignItems: "center",
    gap: 2,
  },
  viewAll: {
    fontSize: TayyibatiTheme.typography.size.sm,
    fontFamily: TayyibatiTheme.typography.fontFamily.bold,
  },
  list: {
    gap: 10,
  },
  card: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: TayyibatiTheme.radius.medium,
    borderWidth: 1,
    ...TayyibatiTheme.shadows.card,
  },
  row: {
    alignItems: "center",
    gap: 10,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  foodName: {
    fontSize: TayyibatiTheme.typography.size.md - 1,
    fontFamily: TayyibatiTheme.typography.fontFamily.bold,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: TayyibatiTheme.radius.pill,
  },
  badgeText: {
    fontSize: TayyibatiTheme.typography.size.xs,
    fontFamily: TayyibatiTheme.typography.fontFamily.bold,
  },
});
