import React from "react";
import { View, TouchableOpacity, StyleSheet } from "react-native";
import { Icon } from "@/components/Icon";
import { useColors } from "@/hooks/useColors";
import { LocalizedText } from "./LocalizedText";
import { useRouter } from "expo-router";
import { isRTL, t } from "@/lib/i18n";
import { TayyibatiTheme } from "@/constants/tayyibatiTheme";

export function HomeImageActions() {
  const colors = useColors();
  const router = useRouter();
  const rtl = isRTL();

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.card,
          {
            backgroundColor: TayyibatiTheme.colors.surface,
            borderColor: TayyibatiTheme.colors.borderSoft,
          },
        ]}
      >
        <View style={[{ flexDirection: rtl ? "row-reverse" : "row" }, styles.headerRow]}>
          <View style={styles.iconCircle}>
            <Icon name="camera" size={18} color={TayyibatiTheme.colors.primary} />
          </View>
          <LocalizedText style={[styles.title, { color: colors.foreground, textAlign: rtl ? "right" : "left" }]}>
            {t("home.orVerifyWithImage")}
          </LocalizedText>
        </View>

        <View style={[{ flexDirection: rtl ? "row-reverse" : "row" }, styles.buttonsRow]}>
          <TouchableOpacity
            style={[
              styles.actionBtn,
              {
                backgroundColor: TayyibatiTheme.colors.greenCard,
                borderColor: "#C6EFD9",
                flexDirection: rtl ? "row-reverse" : "row",
              },
            ]}
            activeOpacity={0.82}
            onPress={() => router.push("/(tabs)/camera?action=camera")}
          >
            <View style={styles.btnIconCircle}>
              <Icon name="camera" size={16} color={TayyibatiTheme.colors.primary} />
            </View>
            <LocalizedText style={[styles.btnText, { color: TayyibatiTheme.colors.primary }]}>
              {t("home.takePhoto")}
            </LocalizedText>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.actionBtn,
              {
                backgroundColor: TayyibatiTheme.colors.orangeCard,
                borderColor: "#FFE4A0",
                flexDirection: rtl ? "row-reverse" : "row",
              },
            ]}
            activeOpacity={0.82}
            onPress={() => router.push("/(tabs)/camera?action=gallery")}
          >
            <View style={styles.btnIconCircle}>
              <Icon name="images" size={16} color={TayyibatiTheme.colors.orange} />
            </View>
            <LocalizedText style={[styles.btnText, { color: TayyibatiTheme.colors.orangeDark }]}>
              {t("home.chooseFromGallery")}
            </LocalizedText>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 20,
    paddingHorizontal: 16,
  },
  card: {
    padding: 16,
    borderRadius: TayyibatiTheme.radius.large,
    borderWidth: 1,
    ...TayyibatiTheme.shadows.card,
  },
  headerRow: {
    alignItems: "center",
    marginBottom: 14,
    gap: 10,
  },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: TayyibatiTheme.colors.greenCard,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: TayyibatiTheme.typography.size.md,
    fontFamily: TayyibatiTheme.typography.fontFamily.bold,
  },
  buttonsRow: {
    gap: 10,
  },
  actionBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 11,
    paddingHorizontal: 6,
    borderRadius: TayyibatiTheme.radius.medium,
    borderWidth: 1,
    gap: 5,
  },
  btnIconCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: TayyibatiTheme.colors.white,
    alignItems: "center",
    justifyContent: "center",
  },
  btnText: {
    fontSize: 13,
    fontFamily: TayyibatiTheme.typography.fontFamily.bold,
    flexShrink: 1,
  },
});
