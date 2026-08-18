import React from "react";
import { View, StyleSheet } from "react-native";
import { Icon } from "@/components/Icon";
import { useColors } from "@/hooks/useColors";
import { LocalizedText, LocalizedParagraph } from "./LocalizedText";
import { isRTL, t } from "@/lib/i18n";
import { TayyibatiTheme } from "@/constants/tayyibatiTheme";

export function HomeSearchEducation() {
  const colors = useColors();
  const rtl = isRTL();

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.banner,
          {
            backgroundColor: TayyibatiTheme.colors.tealCard,
            borderColor: "#BFEADF",
            flexDirection: rtl ? "row-reverse" : "row",
          },
        ]}
      >
        <View style={styles.iconCircle}>
          <Icon name="information-circle" size={20} color={TayyibatiTheme.colors.teal} />
        </View>

        <View style={{ flex: 1 }}>
          <LocalizedText
            style={[
              styles.title,
              { color: TayyibatiTheme.colors.teal, textAlign: rtl ? "right" : "left" },
            ]}
          >
            {t("home.betterResultTitle")}
          </LocalizedText>
          <LocalizedParagraph
            style={[
              styles.desc,
              { color: TayyibatiTheme.colors.textSecondary, textAlign: rtl ? "right" : "left" },
            ]}
          >
            {t("home.betterResultDesc")}
          </LocalizedParagraph>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 22,
    paddingHorizontal: 16,
  },
  banner: {
    padding: 16,
    borderRadius: TayyibatiTheme.radius.large,
    borderWidth: 1,
    alignItems: "flex-start",
    gap: 12,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: TayyibatiTheme.colors.white,
    alignItems: "center",
    justifyContent: "center",
    ...TayyibatiTheme.shadows.card,
  },
  title: {
    fontSize: TayyibatiTheme.typography.size.md,
    fontFamily: TayyibatiTheme.typography.fontFamily.bold,
    marginBottom: 4,
  },
  desc: {
    fontSize: TayyibatiTheme.typography.size.sm,
    fontFamily: TayyibatiTheme.typography.fontFamily.regular,
    lineHeight: 20,
  },
});
