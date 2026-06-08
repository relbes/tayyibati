import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import type { IngredientResult } from "@/context/AnalysisContext";

interface IngredientChipProps {
  ingredient: IngredientResult;
}

export function IngredientChip({ ingredient }: IngredientChipProps) {
  const colors = useColors();

  const config = {
    allowed: { bg: colors.allowed + "18", border: colors.allowed + "40", text: colors.allowed, icon: "checkmark-circle" as const },
    forbidden: { bg: colors.forbidden + "18", border: colors.forbidden + "40", text: colors.forbidden, icon: "close-circle" as const },
    conditional: { bg: colors.conditional + "18", border: colors.conditional + "40", text: colors.conditional, icon: "alert-circle" as const },
    unknown: { bg: colors.unknown + "18", border: colors.unknown + "40", text: colors.unknown, icon: "help-circle" as const },
  };

  const c = config[ingredient.status];

  return (
    <View style={[styles.chip, { backgroundColor: c.bg, borderColor: c.border }]}>
      <Ionicons name={c.icon} size={14} color={c.text} />
      <Text style={[styles.text, { color: c.text }]}>{ingredient.nameAr || ingredient.name}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 6,
    marginBottom: 6,
  },
  text: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
});
