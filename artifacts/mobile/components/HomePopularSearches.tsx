import React from "react";
import { View, TouchableOpacity, StyleSheet } from "react-native";
import { useColors } from "@/hooks/useColors";
import { LocalizedText } from "./LocalizedText";
import { isRTL, t } from "@/lib/i18n";
import { Icon } from "@/components/Icon";
import { TayyibatiTheme } from "@/constants/tayyibatiTheme";

export function HomePopularSearches({ onSelect }: { onSelect: (query: string) => void }) {
  const colors = useColors();
  const rtl = isRTL();

  const popularItems = [
    { term: "حليب", bg: TayyibatiTheme.colors.blueCard, text: TayyibatiTheme.colors.blue, border: "#C7E2FE" },
    { term: "خبز", bg: TayyibatiTheme.colors.orangeCard, text: TayyibatiTheme.colors.orangeDark, border: "#FFE4A0" },
    { term: "أرز", bg: TayyibatiTheme.colors.greenCard, text: TayyibatiTheme.colors.primary, border: "#C6EFD9" },
    { term: "جبن", bg: TayyibatiTheme.colors.purpleCard, text: TayyibatiTheme.colors.purple, border: "#DDD0FF" },
    { term: "شوكولاتة", bg: TayyibatiTheme.colors.pinkCard, text: TayyibatiTheme.colors.pink, border: "#FFD6DC" },
    { term: "دجاج", bg: TayyibatiTheme.colors.tealCard, text: TayyibatiTheme.colors.teal, border: "#BFEADF" },
  ];

  return (
    <View style={styles.container}>
      <View style={[{ flexDirection: rtl ? "row-reverse" : "row" }, styles.headerRow]}>
        <Icon name="trending-up" size={18} color={TayyibatiTheme.colors.primary} />
        <LocalizedText
          style={[
            styles.sectionTitle,
            { color: colors.foreground, textAlign: rtl ? "right" : "left" },
          ]}
        >
          {t("home.popularSearches")}
        </LocalizedText>
      </View>

      <View style={[{ flexDirection: rtl ? "row-reverse" : "row" }, styles.chipContainer]}>
        {popularItems.map((item, i) => (
          <TouchableOpacity
            key={i}
            style={[
              styles.chip,
              {
                backgroundColor: item.bg,
                borderColor: item.border,
              },
            ]}
            onPress={() => onSelect(item.term)}
            activeOpacity={0.75}
          >
            <LocalizedText style={[styles.chipText, { color: item.text }]}>
              {item.term}
            </LocalizedText>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 22,
    paddingHorizontal: 16,
  },
  headerRow: {
    alignItems: "center",
    marginBottom: 12,
    gap: 8,
  },
  sectionTitle: {
    fontSize: TayyibatiTheme.typography.size.lg,
    fontFamily: TayyibatiTheme.typography.fontFamily.bold,
  },
  chipContainer: {
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: TayyibatiTheme.radius.pill,
    borderWidth: 1,
  },
  chipText: {
    fontSize: TayyibatiTheme.typography.size.sm,
    fontFamily: TayyibatiTheme.typography.fontFamily.bold,
  },
});
