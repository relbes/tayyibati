import React from "react";
import { View, TouchableOpacity, StyleSheet, Alert } from "react-native";
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
  const rtl = isRTL();

  const cards = [
    {
      icon: "search",
      title: t("home.searchFood"),
      desc: t("home.searchFoodDesc"),
      onPress: focusSearch,
      color: TayyibatiTheme.colors.primary,
      background: TayyibatiTheme.colors.greenCard,
      borderColor: "#C6EFD9",
    },
    {
      icon: "camera",
      title: t("home.analyzeImage"),
      desc: t("home.analyzeImageDesc"),
      onPress: () => router.push("/(tabs)/camera?action=camera"),
      color: TayyibatiTheme.colors.orange,
      background: TayyibatiTheme.colors.orangeCard,
      borderColor: "#FFE4A0",
    },
    {
      icon: "scan",
      title: t("home.scanIngredients"),
      desc: t("home.scanIngredientsDesc"),
      onPress: () => {
        Alert.alert(
          "هذه الخاصية غير متاحة حاليا",
          "قريباً سيتم تفعيل هذه الخاصية للاشتراك البريميوم"
        );
      },
      color: TayyibatiTheme.colors.pink,
      background: TayyibatiTheme.colors.pinkCard,
      borderColor: "#FFD6DC",
    },
    {
      icon: "book",
      title: t("home.exploreDatabase"),
      desc: t("home.exploreDatabaseDesc"),
      onPress: () => router.push("/(tabs)/browse"),
      color: TayyibatiTheme.colors.blue,
      background: TayyibatiTheme.colors.blueCard,
      borderColor: "#C7E2FE",
    },
    {
      icon: "information-circle",
      title: t("home.aboutSystem"),
      desc: t("home.aboutSystemDesc"),
      onPress: () => router.push("/about-system"),
      color: TayyibatiTheme.colors.purple,
      background: TayyibatiTheme.colors.purpleCard,
      borderColor: "#DDD0FF",
      isFullWidth: true,
    },
  ];

  return (
    <View style={styles.container}>
      <LocalizedText
        style={[
          styles.sectionTitle,
          {
            color: colors.foreground,
            textAlign: rtl ? "right" : "left",
          },
        ]}
      >
        {t("home.quickActions")}
      </LocalizedText>

      <View style={styles.grid}>
        {cards.map((card, index) => {
          if (card.isFullWidth) {
            return (
              <TouchableOpacity
                key={index}
                style={[
                  styles.fullWidthCard,
                  {
                    backgroundColor: card.background,
                    borderColor: card.borderColor,
                    flexDirection: rtl ? "row-reverse" : "row",
                  },
                ]}
                activeOpacity={0.82}
                onPress={card.onPress}
              >
                {/* Decorative organic background circle */}
                <View style={[styles.decorCircleFull, { backgroundColor: card.color + "15" }]} />

                <View style={styles.iconBox}>
                  <Icon name={card.icon as any} size={22} color={card.color} strokeWidth={2} />
                </View>
                <View style={{ flex: 1, marginHorizontal: 12 }}>
                  <LocalizedText
                    style={[styles.cardTitle, { color: TayyibatiTheme.colors.text, textAlign: rtl ? "right" : "left" }]}
                    numberOfLines={1}
                  >
                    {card.title}
                  </LocalizedText>
                  <LocalizedParagraph
                    style={[styles.cardDesc, { color: TayyibatiTheme.colors.textSecondary, textAlign: rtl ? "right" : "left" }]}
                    numberOfLines={1}
                  >
                    {card.desc}
                  </LocalizedParagraph>
                </View>
                <View style={[styles.arrowCircle, { backgroundColor: TayyibatiTheme.colors.white }]}>
                  <Icon name={rtl ? "arrow-back" : "arrow-forward"} size={14} color={card.color} />
                </View>
              </TouchableOpacity>
            );
          }

          return (
            <TouchableOpacity
              key={index}
              style={[
                styles.card,
                {
                  backgroundColor: card.background,
                  borderColor: card.borderColor,
                },
              ]}
              activeOpacity={0.82}
              onPress={card.onPress}
            >
              {/* Decorative organic background circle */}
              <View style={[styles.decorCircle, { backgroundColor: card.color + "15" }]} />

              <View style={[{ flexDirection: rtl ? "row-reverse" : "row" }, styles.cardTopRow]}>
                <View style={styles.iconBox}>
                  <Icon name={card.icon as any} size={22} color={card.color} strokeWidth={2} />
                </View>
                <View style={[styles.arrowCircle, { backgroundColor: TayyibatiTheme.colors.white }]}>
                  <Icon name={rtl ? "arrow-back" : "arrow-forward"} size={12} color={card.color} />
                </View>
              </View>

              <LocalizedText
                style={[
                  styles.cardTitle,
                  {
                    color: TayyibatiTheme.colors.text,
                    textAlign: rtl ? "right" : "left",
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
                    color: TayyibatiTheme.colors.textSecondary,
                    textAlign: rtl ? "right" : "left",
                  },
                ]}
                numberOfLines={2}
              >
                {card.desc}
              </LocalizedParagraph>
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
    padding: 14,
    borderRadius: TayyibatiTheme.radius.large,
    borderWidth: 1,
    position: "relative",
    overflow: "hidden",
    ...TayyibatiTheme.shadows.card,
  },
  fullWidthCard: {
    width: "100%",
    padding: 14,
    borderRadius: TayyibatiTheme.radius.large,
    borderWidth: 1,
    alignItems: "center",
    position: "relative",
    overflow: "hidden",
    ...TayyibatiTheme.shadows.card,
  },
  decorCircle: {
    position: "absolute",
    top: -15,
    right: -15,
    width: 65,
    height: 65,
    borderRadius: 32.5,
  },
  decorCircleFull: {
    position: "absolute",
    bottom: -20,
    right: -20,
    width: 90,
    height: 90,
    borderRadius: 45,
  },
  cardTopRow: {
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
    zIndex: 2,
  },
  iconBox: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: TayyibatiTheme.colors.white,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
    ...TayyibatiTheme.shadows.card,
  },
  arrowCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
  },
  cardTitle: {
    fontSize: 14.5,
    fontFamily: TayyibatiTheme.typography.fontFamily.bold,
    lineHeight: 19,
    zIndex: 2,
  },
  cardDesc: {
    fontSize: TayyibatiTheme.typography.size.xs + 1,
    fontFamily: TayyibatiTheme.typography.fontFamily.regular,
    lineHeight: 18,
    marginTop: 3,
    zIndex: 2,
  },
});