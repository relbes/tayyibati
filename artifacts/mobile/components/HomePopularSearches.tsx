import React, { useRef } from "react";
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from "react-native";
import { isRTL } from "@/lib/i18n";
import { Icon } from "@/components/Icon";
import { useRouter } from "expo-router";

export function HomePopularSearches({ onSelect }: { onSelect: (query: string) => void }) {
  const router = useRouter();
  const rtl = isRTL();
  const scrollRef = useRef<ScrollView>(null);

  const popularItems = [
    { term: "حليب", emoji: "🥛" },
    { term: "بيض", emoji: "🥚" },
    { term: "دجاج", emoji: "🍗" },
    { term: "موز", emoji: "🍌" },
    { term: "تفاح", emoji: "🍎" },
    { term: "خبز", emoji: "🍞" },
    { term: "أرز", emoji: "🍚" },
    { term: "جبن", emoji: "🧀" },
  ];

  return (
    <View style={styles.container}>
      {/* Header Row: الأكثر بحثاً 🔥 */}
      <View style={[styles.headerRow, { flexDirection: rtl ? "row-reverse" : "row" }]}>
        <View style={[styles.titleContainer, { flexDirection: rtl ? "row-reverse" : "row" }]}>
          <Text style={styles.flameEmoji}>🔥</Text>
          <Text style={styles.sectionTitle}>الأكثر بحثاً</Text>
        </View>
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
        {popularItems.map((item, i) => (
          <TouchableOpacity
            key={i}
            style={[
              styles.chip,
              { flexDirection: rtl ? "row-reverse" : "row" },
            ]}
            onPress={() => onSelect(item.term)}
            activeOpacity={0.75}
          >
            <Text style={styles.emojiText}>{item.emoji}</Text>
            <Text style={styles.chipText}>{item.term}</Text>
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
  titleContainer: {
    alignItems: "center",
    gap: 6,
  },
  flameEmoji: {
    fontSize: 16,
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
    color: "#15803D",
  },
  emojiText: {
    fontSize: 17,
  },
});
