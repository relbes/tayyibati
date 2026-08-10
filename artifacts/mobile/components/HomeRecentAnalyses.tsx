import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/context/AuthContext';
import { getHistory } from '@/lib/api';
import { Icon } from '@/components/Icon';
import { useColors } from '@/hooks/useColors';
import { LocalizedText } from './LocalizedText';
import { localizedRow } from '@/lib/layoutDirection';
import { t } from '@/lib/i18n';
import { useRouter } from 'expo-router';
import { useAnalysis } from '@/context/AnalysisContext';

export function HomeRecentAnalyses() {
  const colors = useColors();
  const router = useRouter();
  const { user } = useAuth();
  const { setCurrentReport } = useAnalysis();

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
      <View style={[localizedRow(), styles.header]}>
        <LocalizedText style={[styles.sectionTitle, { color: colors.foreground }]}>
          {t("home.recentAnalyses")}
        </LocalizedText>
        <TouchableOpacity onPress={() => router.push("/(tabs)/history")}>
          <LocalizedText style={[styles.viewAll, { color: colors.primary }]}>
            {t("home.viewAll")}
          </LocalizedText>
        </TouchableOpacity>
      </View>
      
      <View style={styles.list}>
        {recent.map((item: any, i: number) => {
          let statusText = t("status.unknown");
          let statusColor = colors.unknown;
          if (item.report.overallStatus === "ALLOWED") { statusText = t("status.allowed"); statusColor = colors.allowed; }
          else if (item.report.overallStatus === "FORBIDDEN") { statusText = t("status.forbidden"); statusColor = colors.forbidden; }
          else if (item.report.overallStatus === "CONDITIONAL") { statusText = t("status.conditional"); statusColor = colors.conditional; }
          else if (item.report.overallStatus === "REQUIRES_INFO") { statusText = t("status.unknown"); statusColor = colors.unknown; }

          return (
            <TouchableOpacity 
              key={i}
              style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
              activeOpacity={0.7}
              onPress={() => handleView(item)}
            >
              <View style={[localizedRow(), { alignItems: 'center' }]}>
                <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
                <LocalizedText style={[styles.foodName, { color: colors.foreground, flex: 1 }]}>
                  {item.report.query}
                </LocalizedText>
                <View style={[styles.badge, { backgroundColor: statusColor + "15" }]}>
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
  container: { marginTop: 32, paddingHorizontal: 16 },
  header: { justifyContent: 'space-between', marginBottom: 16, alignItems: 'center' },
  sectionTitle: { fontSize: 18, fontFamily: 'Tajawal_700Bold' },
  viewAll: { fontSize: 14, fontFamily: 'Tajawal_700Bold' },
  list: { gap: 12 },
  card: { padding: 16, borderRadius: 12, borderWidth: 1 },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginEnd: 12 },
  foodName: { fontSize: 16, fontFamily: 'Tajawal_700Bold' },
  badge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 16 },
  badgeText: { fontSize: 12, fontFamily: 'Tajawal_700Bold' }
});
