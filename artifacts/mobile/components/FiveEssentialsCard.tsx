import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, LayoutAnimation, Platform, UIManager } from "react-native";
import { Icon } from "@/components/Icon";
import { useColors } from "@/hooks/useColors";
import { FIVE_ESSENTIALS_DATA } from "@/constants/fiveEssentials";
import { isRTL } from "@/lib/i18n";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export function FiveEssentialsCard() {
  const colors = useColors();
  const [expanded, setExpanded] = useState(false);

  const toggleExpand = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded((prev) => !prev);
  };

  const isRightToLeft = isRTL();

  return (
    <View
      style={[
        styles.cardContainer,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
        },
      ]}
    >
      <TouchableOpacity
        style={styles.headerRow}
        onPress={toggleExpand}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={FIVE_ESSENTIALS_DATA.badgeTitle}
      >
        <View style={styles.headerLeft}>
          <Icon
            name={expanded ? "chevron-up" : "chevron-down"}
            size={20}
            color={colors.mutedForeground}
          />
        </View>

        <View style={styles.headerCenter}>
          <View style={styles.badgeTitleRow}>
            <Text style={[styles.badgeTitle, { color: colors.primary }]}>
              {FIVE_ESSENTIALS_DATA.badgeTitle}
            </Text>
            <View style={[styles.iconWrap, { backgroundColor: colors.primary + "15" }]}>
              <Icon name="star" size={15} color={colors.primary} />
            </View>
          </View>
          <Text style={[styles.togglePrompt, { color: colors.mutedForeground }]}>
            {FIVE_ESSENTIALS_DATA.togglePrompt}
          </Text>
        </View>
      </TouchableOpacity>

      {expanded && (
        <View style={[styles.expandedContent, { borderTopColor: colors.border }]}>
          <Text style={[styles.authorIntro, { color: colors.foreground }]}>
            {FIVE_ESSENTIALS_DATA.authorIntro}
          </Text>

          <View style={styles.itemsList}>
            {FIVE_ESSENTIALS_DATA.items.map((item) => (
              <View
                key={item.id}
                style={[
                  styles.itemCard,
                  {
                    backgroundColor: colors.muted + "35",
                    borderColor: colors.border,
                  },
                ]}
              >
                <View style={styles.itemHeaderRow}>
                  <Text style={[styles.itemTitle, { color: colors.primary }]}>
                    {item.title}
                  </Text>
                  <View style={[styles.numberBadge, { backgroundColor: colors.primary }]}>
                    <Text style={styles.numberBadgeText}>{item.numberAr}</Text>
                  </View>
                </View>
                <Text style={[styles.itemDesc, { color: colors.mutedForeground }]}>
                  {item.description}
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  cardContainer: {
    marginHorizontal: 16,
    marginVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    overflow: "hidden",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerLeft: {
    padding: 4,
  },
  headerCenter: {
    alignItems: "flex-end",
    gap: 2,
    flex: 1,
  },
  badgeTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  iconWrap: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeTitle: {
    fontSize: 15,
    fontFamily: "Tajawal_700Bold",
  },
  togglePrompt: {
    fontSize: 12,
    fontFamily: "Tajawal_400Regular",
  },
  expandedContent: {
    borderTopWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  authorIntro: {
    fontSize: 13,
    fontFamily: "Tajawal_500Medium",
    lineHeight: 20,
    textAlign: "right",
  },
  itemsList: {
    gap: 8,
    marginTop: 4,
  },
  itemCard: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 10,
    gap: 4,
  },
  itemHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 8,
  },
  numberBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  numberBadgeText: {
    color: "#ffffff",
    fontSize: 11,
    fontFamily: "Tajawal_700Bold",
  },
  itemTitle: {
    fontSize: 14,
    fontFamily: "Tajawal_700Bold",
    textAlign: "right",
  },
  itemDesc: {
    fontSize: 12,
    fontFamily: "Tajawal_400Regular",
    lineHeight: 18,
    textAlign: "right",
  },
});
