import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, LayoutAnimation, Platform, UIManager } from "react-native";
import { useColors } from "@/hooks/useColors";
import { Icon } from "@/components/Icon";
import { IngredientCard } from "./IngredientCard";
import type { IngredientDecisionVM } from "@/lib/models/IngredientDecisionVM";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export interface IngredientSectionProps {
  title: string;
  icon: string;
  status: "forbidden" | "conditional" | "allowed";
  ingredients: IngredientDecisionVM[];
}

export const IngredientSection = React.memo(function IngredientSection({
  title,
  icon,
  status,
  ingredients,
}: IngredientSectionProps) {
  const colors = useColors();
  const [isExpanded, setIsExpanded] = useState<boolean>(true);

  // Hide section completely if empty
  if (!ingredients || ingredients.length === 0) {
    return null;
  }

  const headerColors = {
    forbidden: colors.forbidden,
    conditional: colors.conditional,
    allowed: colors.allowed,
  };

  const headerColor = headerColors[status] || colors.primary;

  const toggleExpand = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setIsExpanded(!isExpanded);
  };

  return (
    <View style={styles.sectionContainer}>
      <TouchableOpacity
        style={[styles.headerRow, { backgroundColor: colors.card, borderColor: colors.border }]}
        onPress={toggleExpand}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={`${title}، عدد المكونات ${ingredients.length}، ${isExpanded ? "مطوي" : "موسع"}`}
      >
        <View style={styles.headerRight}>
          <Text style={styles.iconText}>{icon}</Text>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{title}</Text>
          <View style={[styles.countBadge, { backgroundColor: headerColor + "20" }]}>
            <Text style={[styles.countText, { color: headerColor }]}>{ingredients.length}</Text>
          </View>
        </View>

        <Icon
          name={isExpanded ? "chevron-up-outline" : "chevron-down-outline"}
          size={20}
          color={colors.mutedForeground}
        />
      </TouchableOpacity>

      {isExpanded && (
        <View style={styles.list}>
          {ingredients.map((item, idx) => (
            <IngredientCard key={`${item.canonicalId || item.input}_${idx}`} ingredient={item} />
          ))}
        </View>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  sectionContainer: {
    gap: 10,
    marginVertical: 4,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1,
    minHeight: 52,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  iconText: {
    fontSize: 20,
  },
  sectionTitle: {
    fontSize: 17,
    fontFamily: "Tajawal_700Bold",
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
  list: {
    gap: 10,
  },
});
