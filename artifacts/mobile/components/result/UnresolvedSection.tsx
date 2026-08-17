import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useColors } from "@/hooks/useColors";
import { Icon } from "@/components/Icon";

interface UnresolvedSectionProps {
  unresolvedInputs: string[];
}

export const UnresolvedSection = React.memo(function UnresolvedSection({
  unresolvedInputs,
}: UnresolvedSectionProps) {
  const colors = useColors();

  if (!unresolvedInputs || unresolvedInputs.length === 0) {
    return null;
  }

  return (
    <View
      style={styles.container}
      accessibilityRole="text"
      accessibilityLabel={`المكونات غير المحددة: ${unresolvedInputs.length} مكونات`}
    >
      <View style={[styles.headerRow, { flexDirection: "row-reverse" }]}>
        <Text style={styles.iconText}>❓</Text>
        <Text style={[styles.sectionTitle, { color: colors.foreground, textAlign: "right" }]}>مكونات غير محددة</Text>
        <View style={[styles.countBadge, { backgroundColor: colors.muted }]}>
          <Text style={[styles.countText, { color: colors.mutedForeground }]}>{unresolvedInputs.length}</Text>
        </View>
      </View>

      {/* Informative Banner */}
      <View style={[styles.infoNotice, { backgroundColor: colors.card, borderColor: colors.border, flexDirection: "row-reverse" }]}>
        <Icon name="information-circle-outline" size={20} color={colors.mutedForeground} />
        <Text style={[styles.noticeText, { color: colors.mutedForeground, textAlign: "right" }]}>
          لم يتم العثور على هذه المكونات في قاعدة بيانات الطيبات، ولذلك تعامل النظام معها على أنها غير محددة.
        </Text>
      </View>

      {/* Chip Grid */}
      <View style={[styles.chipGrid, { flexDirection: "row-reverse" }]}>
        {unresolvedInputs.map((input, idx) => (
          <View key={`${input}_${idx}`} style={[styles.chip, { backgroundColor: colors.card, borderColor: colors.border, flexDirection: "row-reverse" }]}>
            <Text style={styles.chipSymbol}>❓</Text>
            <Text style={[styles.chipText, { color: colors.foreground, textAlign: "right" }]}>{input}</Text>
          </View>
        ))}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    gap: 12,
    marginVertical: 4,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  iconText: {
    fontSize: 20,
  },
  sectionTitle: {
    fontSize: 17,
    fontFamily: "Tajawal_700Bold",
    flex: 1,
    textAlign: "right",
  },
  countBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
  },
  countText: {
    fontSize: 13,
    fontFamily: "Tajawal_700Bold",
  },
  infoNotice: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  noticeText: {
    fontSize: 13,
    fontFamily: "Tajawal_400Regular",
    flex: 1,
    textAlign: "right",
    lineHeight: 18,
  },
  chipGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  chipSymbol: {
    fontSize: 14,
  },
  chipText: {
    fontSize: 14,
    fontFamily: "Tajawal_500Medium",
  },
});
