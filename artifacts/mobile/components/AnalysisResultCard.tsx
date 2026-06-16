import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Icon } from "@/components/Icon";
import { useColors } from "@/hooks/useColors";
import { ScoreRing } from "./ScoreRing";
import { IngredientChip } from "./IngredientChip";
import type { AnalysisReport } from "@/context/AnalysisContext";

interface AnalysisResultCardProps {
  report: AnalysisReport;
  onRetry?: () => void;
}

export function AnalysisResultCard({ report, onRetry }: AnalysisResultCardProps) {
  const colors = useColors();
  const [expanded, setExpanded] = useState<string | null>("forbidden");

  if (report.notFound) {
    return (
      <View style={[styles.card, styles.notFoundCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={[styles.notFoundIconWrap, { backgroundColor: colors.muted }]}>
          <Icon name="search-outline" size={36} color={colors.mutedForeground} />
        </View>
        <Text style={[styles.notFoundTitle, { color: colors.foreground }]}>
          لم يتم التعرف على طعام
        </Text>
        <Text style={[styles.notFoundQuery, { color: colors.mutedForeground }]}>
          "{report.query}"
        </Text>
        <Text style={[styles.notFoundDesc, { color: colors.mutedForeground }]}>
          لم نتمكن من اكتشاف طعام في هذا الإدخال.{"\n"}جرّب صورة أوضح للطعام أو الملصق، أو اكتب اسم الطعام بشكل أكثر تحديداً.
        </Text>
        {onRetry && (
          <TouchableOpacity
            style={[styles.retryBtn, { backgroundColor: colors.primary }]}
            onPress={onRetry}
          >
            <Icon name="refresh-outline" size={16} color="#fff" />
            <Text style={styles.retryText}>حاول مجدداً</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  const sections = [
    { key: "forbidden", label: "محظور", color: colors.forbidden, items: report.forbidden, icon: "close-circle" as const },
    { key: "conditional", label: "مشروط", color: colors.conditional, items: report.conditional, icon: "alert-circle" as const },
    { key: "allowed", label: "مسموح", color: colors.allowed, items: report.allowed, icon: "checkmark-circle" as const },
    { key: "unknown", label: "غير معروف", color: colors.unknown, items: report.unknown, icon: "help-circle" as const },
  ].filter((s) => s.items.length > 0);

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.scoreRow}>
        <ScoreRing score={report.compatibilityScore} />
        <View style={styles.scoreInfo}>
          <Text style={[styles.queryText, { color: colors.foreground }]} numberOfLines={2}>
            {report.query}
          </Text>
          <Text style={[styles.explainText, { color: colors.mutedForeground }]} numberOfLines={3}>
            {report.explanation}
          </Text>
          <View style={styles.statsRow}>
            {[
              { count: report.forbidden.length, color: colors.forbidden, label: "محظور" },
              { count: report.conditional.length, color: colors.conditional, label: "مشروط" },
              { count: report.allowed.length, color: colors.allowed, label: "مسموح" },
            ].map((s) => (
              <View key={s.label} style={styles.stat}>
                <Text style={[styles.statCount, { color: s.color }]}>{s.count}</Text>
                <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{s.label}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>

      {sections.map((section) => (
        <View key={section.key} style={[styles.section, { borderTopColor: colors.border }]}>
          <TouchableOpacity
            style={styles.sectionHeader}
            onPress={() => setExpanded(expanded === section.key ? null : section.key)}
          >
            <View style={styles.sectionLeft}>
              <Icon name={section.icon} size={18} color={section.color} />
              <Text style={[styles.sectionTitle, { color: section.color }]}>
                {section.label} ({section.items.length})
              </Text>
            </View>
            <Icon
              name={expanded === section.key ? "chevron-up" : "chevron-down"}
              size={16}
              color={colors.mutedForeground}
            />
          </TouchableOpacity>
          {expanded === section.key && (
            <View style={styles.chipContainer}>
              {section.items.map((item, i) => (
                <IngredientChip key={i} ingredient={item} />
              ))}
            </View>
          )}
        </View>
      ))}

      {report.suggestions.length > 0 && (
        <View style={[styles.section, { borderTopColor: colors.border }]}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionLeft}>
              <Icon name="bulb" size={18} color={colors.accent} />
              <Text style={[styles.sectionTitle, { color: colors.accent }]}>اقتراحات</Text>
            </View>
          </View>
          {report.suggestions.map((s, i) => (
            <Text key={i} style={[styles.suggestion, { color: colors.mutedForeground }]}>
              • {s}
            </Text>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
  },
  notFoundCard: {
    alignItems: "center",
    padding: 32,
    gap: 12,
  },
  notFoundIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  notFoundTitle: {
    fontSize: 20,
    fontFamily: "Tajawal_700Bold",
    textAlign: "center",
  },
  notFoundQuery: {
    fontSize: 15,
    fontFamily: "Tajawal_500Medium",
    textAlign: "center",
  },
  notFoundDesc: {
    fontSize: 14,
    fontFamily: "Tajawal_400Regular",
    textAlign: "center",
    lineHeight: 22,
  },
  retryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 4,
  },
  retryText: {
    color: "#fff",
    fontSize: 15,
    fontFamily: "Tajawal_700Bold",
  },
  scoreRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    padding: 16,
  },
  scoreInfo: {
    flex: 1,
    gap: 6,
  },
  queryText: {
    fontSize: 16,
    fontFamily: "Tajawal_700Bold",
    textAlign: "right",
  },
  explainText: {
    fontSize: 13,
    fontFamily: "Tajawal_400Regular",
    textAlign: "right",
    lineHeight: 20,
  },
  statsRow: {
    flexDirection: "row",
    gap: 12,
    justifyContent: "flex-end",
  },
  stat: { alignItems: "center" },
  statCount: { fontSize: 18, fontFamily: "Tajawal_700Bold" },
  statLabel: { fontSize: 11, fontFamily: "Tajawal_400Regular" },
  section: {
    borderTopWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sectionLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  sectionTitle: { fontSize: 14, fontFamily: "Tajawal_700Bold" },
  chipContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 10,
  },
  suggestion: {
    fontSize: 13,
    fontFamily: "Tajawal_400Regular",
    marginTop: 6,
    textAlign: "right",
    lineHeight: 20,
  },
});
