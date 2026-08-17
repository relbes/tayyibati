import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, LayoutAnimation, Platform, UIManager } from "react-native";
import { Icon } from "@/components/Icon";
import { useColors } from "@/hooks/useColors";
import type { IngredientDecisionVM } from "@/lib/models/IngredientDecisionVM";
import { useDeveloperMode } from "@/context/DeveloperModeContext";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export interface IngredientCardProps {
  ingredient: IngredientDecisionVM;
}

export const IngredientCard = React.memo(function IngredientCard({ ingredient }: IngredientCardProps) {
  const colors = useColors();
  const { isDevMode } = useDeveloperMode();
  const [showReason, setShowReason] = useState<boolean>(false);

  const statusConfig = {
    allowed: {
      label: "مسموح",
      bg: colors.allowed + "0D",
      border: colors.allowed + "30",
      color: colors.allowed,
      icon: "checkmark-circle" as const,
    },
    forbidden: {
      label: "محظور",
      bg: colors.forbidden + "14",
      border: colors.forbidden + "45",
      color: colors.forbidden,
      icon: "close-circle" as const,
    },
    conditional: {
      label: "مشروط",
      bg: colors.conditional + "14",
      border: colors.conditional + "45",
      color: colors.conditional,
      icon: "alert-circle" as const,
    },
    unknown: {
      label: "غير محدد",
      bg: colors.unknown + "12",
      border: colors.unknown + "30",
      color: colors.unknown,
      icon: "help-circle" as const,
    },
  };

  const cfg = statusConfig[ingredient.status] || statusConfig.unknown;

  const toggleReason = () => {
    if (ingredient.reason) {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setShowReason(!showReason);
    }
  };

  const isDevDetailsVisible = typeof __DEV__ !== "undefined" && __DEV__ && isDevMode;

  return (
    <View
      style={[styles.card, { backgroundColor: cfg.bg, borderColor: cfg.border }]}
      accessibilityRole="text"
      accessibilityLabel={`${ingredient.input}: ${cfg.label}. ${ingredient.reason || ""}`}
    >
      <TouchableOpacity
        style={[styles.mainRow, { flexDirection: "row-reverse" }]}
        onPress={toggleReason}
        activeOpacity={ingredient.reason ? 0.7 : 1}
        disabled={!ingredient.reason}
      >
        <View style={[styles.symbolWrap, { backgroundColor: cfg.color + "20" }]}>
          <Icon name={cfg.icon} size={20} color={cfg.color} />
        </View>

        <View style={styles.infoWrap}>
          {/* User Input Name ONLY - Canonical names are hidden unless Dev Mode */}
          <Text style={[styles.inputName, { color: colors.foreground, textAlign: "right" }]}>{ingredient.input}</Text>
          {ingredient.reason && !showReason ? (
            <Text style={[styles.reasonPreview, { color: colors.mutedForeground, textAlign: "right" }]} numberOfLines={1}>
              {ingredient.reason}
            </Text>
          ) : null}
        </View>

        <View style={[styles.badge, { backgroundColor: colors.card, borderColor: cfg.border }]}>
          <Text style={[styles.badgeText, { color: cfg.color }]}>{cfg.label}</Text>
        </View>

        {ingredient.reason ? (
          <Icon
            name={showReason ? "chevron-up-outline" : "chevron-down-outline"}
            size={16}
            color={colors.mutedForeground}
          />
        ) : null}
      </TouchableOpacity>

      {/* Expanded Reason Text */}
      {showReason && ingredient.reason ? (
        <View style={[styles.expandedReasonBox, { backgroundColor: colors.card, borderColor: colors.border, flexDirection: "row-reverse" }]}>
          <Icon name="information-circle-outline" size={16} color={cfg.color} />
          <Text style={[styles.reasonText, { color: colors.foreground, textAlign: "right" }]}>{ingredient.reason}</Text>
        </View>
      ) : null}

      {/* Developer-only diagnostic details (Guarded for DEV + Developer Mode ONLY) */}
      {isDevDetailsVisible && (
        <View style={[styles.devDetailsBox, { borderColor: colors.border }]}>
          <Text style={[styles.devText, { color: colors.mutedForeground }]}>
            [DEV] ID: {ingredient.canonicalId || 0} | Canonical: {ingredient.canonicalName} | Method:{" "}
            {ingredient.searchMethod || "N/A"} | Conf: {ingredient.confidence ?? 100}%
          </Text>
        </View>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    gap: 8,
  },
  mainRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 44,
  },
  symbolWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  infoWrap: {
    flex: 1,
  },
  inputName: {
    fontSize: 16,
    fontFamily: "Tajawal_700Bold",
    textAlign: "right",
  },
  reasonPreview: {
    fontSize: 12,
    fontFamily: "Tajawal_400Regular",
    marginTop: 2,
    textAlign: "right",
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  badgeText: {
    fontSize: 12,
    fontFamily: "Tajawal_700Bold",
  },
  expandedReasonBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 4,
  },
  reasonText: {
    fontSize: 13,
    fontFamily: "Tajawal_400Regular",
    flex: 1,
    textAlign: "right",
    lineHeight: 18,
  },
  devDetailsBox: {
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
  },
  devText: {
    fontSize: 11,
    fontFamily: "Tajawal_400Regular",
    textAlign: "right",
  },
});
