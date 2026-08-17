import React from "react";
import {
  View,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { Icon } from "@/components/Icon";
import { useColors } from "@/hooks/useColors";
import { LocalizedText, LocalizedParagraph } from "./LocalizedText";
import { isRTL, t } from "@/lib/i18n";
import { useRouter } from "expo-router";
import { TayyibatiTheme } from "@/constants/tayyibatiTheme";

export function HomeQuickActions({
  focusSearch,
}: {
  focusSearch: () => void;
}) {
  const colors = useColors();
  const router = useRouter();

  const cards = [
    {
      icon: "search",
      title: t("home.searchFood"),
      desc: t("home.searchFoodDesc"),
      onPress: focusSearch,
      color: TayyibatiTheme.colors.primary,
      background: TayyibatiTheme.colors.primarySoft,
    },
    {
      icon: "camera",
      title: t("home.analyzeImage"),
      desc: t("home.analyzeImageDesc"),
      onPress: () => router.push("/(tabs)/camera?action=camera"),
      color: TayyibatiTheme.colors.orange,
      background: TayyibatiTheme.colors.orangeSoft,
    },
    {
      icon: "scan",
      title: t("home.scanIngredients"),
      desc: t("home.scanIngredientsDesc"),
      onPress: () => router.push("/(tabs)/camera?action=camera"),
      color: TayyibatiTheme.colors.purple,
      background: TayyibatiTheme.colors.purpleSoft,
    },
    {
      icon: "book",
      title: t("home.exploreDatabase"),
      desc: t("home.exploreDatabaseDesc"),
      onPress: () => router.push("/(tabs)/browse"),
      color: TayyibatiTheme.colors.blue,
      background: TayyibatiTheme.colors.blueSoft,
    },
    {
      icon: "information-circle",
      title: t("home.aboutSystem"),
      desc: t("home.aboutSystemDesc"),
      onPress: () => router.push("/about-system"),
      color: TayyibatiTheme.colors.primary,
      background: TayyibatiTheme.colors.primarySoft,
    },
  ];

  return (
    <View style={styles.container}>
      <LocalizedText
        style={[
          styles.sectionTitle,
          {
            color: colors.foreground,
            textAlign: isRTL() ? "right" : "left",
          },
        ]}
      >
        {t("home.quickActions")}
      </LocalizedText>

      <View style={styles.grid}>
        {cards.map((card, index) => (
          <TouchableOpacity
            key={index}
            style={[
              styles.card,
              {
                backgroundColor: TayyibatiTheme.colors.surface,
                borderColor: TayyibatiTheme.colors.borderSoft,
              },
              index === cards.length - 1 && styles.lastCard,
            ]}
            activeOpacity={0.82}
            onPress={card.onPress}
          >
            <View
              style={[
                styles.iconBox,
                {
                  backgroundColor: card.background,
                },
              ]}
            >
              <Icon
                name={card.icon as any}
                size={23}
                color={card.color}
                strokeWidth={2}
              />
            </View>

            <LocalizedText
              style={[
                styles.cardTitle,
                {
                  color: colors.foreground,
                  textAlign: isRTL() ? "right" : "left",
                },
              ]}
              numberOfLines={2}
            >
              {card.title}
            </LocalizedText>

            <LocalizedParagraph
              style={[
                styles.cardDesc,
                {
                  color: colors.mutedForeground,
                  textAlign: isRTL() ? "right" : "left",
                },
              ]}
              numberOfLines={2}
            >
              {card.desc}
            </LocalizedParagraph>

            <View
              style={[
                styles.arrow,
                {
                  alignSelf: isRTL() ? "flex-start" : "flex-end",
                },
              ]}
            >
              <Icon
                name={isRTL() ? "arrow-back" : "arrow-forward"}
                size={16}
                color={card.color}
              />
            </View>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 28,
    paddingHorizontal: 16,
  },

  sectionTitle: {
    fontSize: TayyibatiTheme.typography.size.lg,
    fontFamily: TayyibatiTheme.typography.fontFamily.bold,
    marginBottom: 14,
  },

  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 12,
  },

  card: {
    width: "48.2%",
    minHeight: 158,
    padding: 15,
    borderRadius: TayyibatiTheme.radius.large,
    borderWidth: 1,
    ...TayyibatiTheme.shadows.card,
  },

  lastCard: {
    width: "100%",
    minHeight: 112,
  },

  iconBox: {
    width: 46,
    height: 46,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },

  cardTitle: {
    fontSize: TayyibatiTheme.typography.size.md,
    fontFamily: TayyibatiTheme.typography.fontFamily.bold,
    lineHeight: 22,
  },

  cardDesc: {
    fontSize: TayyibatiTheme.typography.size.sm,
    fontFamily: TayyibatiTheme.typography.fontFamily.regular,
    lineHeight: 20,
    marginTop: 4,
  },

  arrow: {
    marginTop: 8,
  },
});