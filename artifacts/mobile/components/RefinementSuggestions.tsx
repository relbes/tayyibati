import React from "react";
import { View, StyleSheet, TouchableOpacity, Text } from "react-native";

interface RefinementSuggestionsProps {
  result: any;
  onSelect: (item: any) => void;
  colors: any;
}

function HighlightText({ text, query, colors }: { text: string; query: string; colors: any }) {
  if (!query || !query.trim()) return <Text style={{ color: colors.foreground }}>{text}</Text>;
  const trimmed = query.trim();
  const regex = new RegExp(`(${trimmed.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
  const parts = text.split(regex);

  return (
    <Text style={{ color: colors.foreground }}>
      {parts.map((part, i) =>
        part.toLowerCase() === trimmed.toLowerCase() ? (
          <Text key={i} style={{ color: colors.primary, fontFamily: "Tajawal_700Bold" }}>
            [{part}]
          </Text>
        ) : (
          part
        )
      )}
    </Text>
  );
}

export function RefinementSuggestions({ result, onSelect, colors }: RefinementSuggestionsProps) {
  if (!result) return null;
  if (result.needsClarification) return null;

  const isMultipleDishes =
    result.resultMode === "MULTIPLE_DISHES" || result.requiresSelection || result.isAmbiguous;
  const matches =
    result.matches ||
    result.refinementSuggestions ||
    result.relevantVariants ||
    (result.notFound && !result.fallbackSuggestions?.length ? result.suggestions : []) ||
    [];

  if (!isMultipleDishes && matches.length === 0) return null;
  if (matches.length === 0) return null;

  const query = result.query || "";

  return (
    <View style={[styles.container, { width: "100%" }]}>
      {/* Top Header */}
      <View style={styles.dialogHeader}>
        <View
          style={[
            styles.countBadge,
            { backgroundColor: colors.primary + "15", borderColor: colors.primary + "30" },
          ]}
        >
          <Text style={[styles.countBadgeText, { color: colors.primary }]}>
            وجدنا {matches.length} أطباق تطابق بحثك
          </Text>
        </View>
        <Text style={[styles.dialogTitle, { color: colors.foreground }]}>
          اختر الطبق الذي تقصده
        </Text>
        {query ? (
          <Text style={[styles.queryTag, { color: colors.mutedForeground }]}>
            بحثك:{" "}
            <Text style={{ fontFamily: "Tajawal_700Bold", color: colors.foreground }}>
              "{query}"
            </Text>
          </Text>
        ) : null}
      </View>

      {/* Dish Selection Cards */}
      <View style={styles.cardList}>
        {matches.map((item: any, idx: number) => {
          const isString = typeof item === "string";
          const nameAr = isString ? item : item.nameAr || item.labelAr || item.query || "";
          const rawCategory = !isString && item.category ? item.category : null;
          const categoryLabel =
            rawCategory === "main_dish"
              ? "طبق رئيسي"
              : rawCategory === "dessert"
              ? "حلويات"
              : rawCategory === "appetizer"
              ? "مقبلات"
              : rawCategory === "soup"
              ? "شوربة"
              : rawCategory === "salad"
              ? "سلطة"
              : rawCategory === "beverage"
              ? "مشروب"
              : rawCategory || "طبق رئيسي";
          const mainProtein = !isString ? item.mainProtein : null;
          const ingredientCount = !isString && item.ingredientCount ? item.ingredientCount : null;
          const description = !isString ? item.description : null;

          return (
            <View
              key={idx}
              style={[
                styles.richCard,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              {/* Dish Name Row */}
              <View style={styles.cardHeaderRow}>
                <Text style={styles.dishIcon}>🍽️</Text>
                <Text
                  style={[styles.dishTitleText, { color: colors.foreground, flex: 1 }]}
                  numberOfLines={2}
                >
                  <HighlightText text={nameAr} query={query} colors={colors} />
                </Text>
              </View>

              {/* Chips Row: Category · Main Protein · Ingredient Count */}
              <View style={styles.chipsRow}>
                <View
                  style={[
                    styles.chip,
                    {
                      backgroundColor: colors.primary + "12",
                      borderColor: colors.primary + "25",
                    },
                  ]}
                >
                  <Text style={[styles.chipText, { color: colors.primary }]}>
                    🏷️ {categoryLabel}
                  </Text>
                </View>

                {mainProtein ? (
                  <View
                    style={[
                      styles.chip,
                      { backgroundColor: colors.secondary, borderColor: colors.border },
                    ]}
                  >
                    <Text style={[styles.chipText, { color: colors.secondaryForeground }]}>
                      {mainProtein}
                    </Text>
                  </View>
                ) : null}

                {ingredientCount ? (
                  <View
                    style={[
                      styles.chip,
                      { backgroundColor: colors.secondary, borderColor: colors.border },
                    ]}
                  >
                    <Text style={[styles.chipText, { color: colors.mutedForeground }]}>
                      🥣 {ingredientCount} مكونات
                    </Text>
                  </View>
                ) : null}
              </View>

              {/* Short Description */}
              {description ? (
                <Text
                  style={[styles.descriptionText, { color: colors.mutedForeground }]}
                  numberOfLines={2}
                >
                  {description}
                </Text>
              ) : null}

              {/* Select Button — min 48dp touch target */}
              <TouchableOpacity
                style={[styles.selectBtn, { backgroundColor: colors.primary }]}
                onPress={() => {

                  onSelect(item);
                }}
                activeOpacity={0.8}
              >
                <Text style={styles.selectBtnText}>اختر هذا الطبق</Text>
                <Text style={styles.selectBtnIcon}>←</Text>
              </TouchableOpacity>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 16,
  },
  dialogHeader: {
    alignItems: "center",
    marginBottom: 16,
    gap: 6,
  },
  countBadge: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  countBadgeText: {
    fontSize: 14,
    fontFamily: "Tajawal_700Bold",
  },
  dialogTitle: {
    fontSize: 20,
    fontFamily: "Tajawal_700Bold",
    textAlign: "center",
  },
  queryTag: {
    fontSize: 13,
    fontFamily: "Tajawal_400Regular",
    textAlign: "center",
  },
  cardList: {
    gap: 14,
    width: "100%",
  },
  richCard: {
    borderRadius: 16,
    borderWidth: 1.5,
    padding: 16,
    gap: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  cardHeaderRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 10,
  },
  dishIcon: {
    fontSize: 24,
  },
  dishTitleText: {
    fontSize: 17,
    fontFamily: "Tajawal_700Bold",
    textAlign: "right",
  },
  chipsRow: {
    flexDirection: "row-reverse",
    flexWrap: "wrap",
    gap: 6,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 14,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 12,
    fontFamily: "Tajawal_500Medium",
  },
  descriptionText: {
    fontSize: 13,
    fontFamily: "Tajawal_400Regular",
    lineHeight: 20,
    textAlign: "right",
  },
  selectBtn: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
    borderRadius: 12,
    gap: 8,
    marginTop: 4,
  },
  selectBtnText: {
    color: "#fff",
    fontSize: 15,
    fontFamily: "Tajawal_700Bold",
  },
  selectBtnIcon: {
    color: "#fff",
    fontSize: 16,
    fontFamily: "Tajawal_700Bold",
  },
});
