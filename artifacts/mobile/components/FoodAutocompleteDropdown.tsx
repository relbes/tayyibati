import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import type { AutocompleteSuggestion } from "../hooks/useFoodSearch";
import { LocalizedText } from "./LocalizedText";
import { localizedRow, ltrText } from "@/lib/layoutDirection";
import { t } from "@/lib/i18n";

interface FoodAutocompleteDropdownProps {
  showSuggestions: boolean;
  suggestions: AutocompleteSuggestion[];
  onSelect: (sug: AutocompleteSuggestion) => void;
  colors: any;
}



export function FoodAutocompleteDropdown({
  showSuggestions,
  suggestions,
  onSelect,
  colors,
}: FoodAutocompleteDropdownProps) {
  if (!showSuggestions || suggestions.length === 0) return null;

  return (
    <View style={[styles.dropdown, { backgroundColor: colors.card, borderColor: colors.border, shadowColor: colors.foreground }]}>
      {suggestions.map((food, idx) => (
        <TouchableOpacity
          key={idx}
          style={[
            localizedRow(),
            styles.suggestionRow,
            idx < suggestions.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border },
          ]}
          onPress={() => onSelect(food)}
          activeOpacity={0.7}
        >
          <View style={[localizedRow(), styles.suggestionLeft]}>
            <View style={styles.suggestionNames}>
              <LocalizedText style={[styles.suggestionAr, { color: colors.foreground }]}>{food.labelAr}</LocalizedText>
              {!!food.labelEn && <Text style={[ltrText(), styles.suggestionEn, { color: colors.mutedForeground }]}>{food.labelEn}</Text>}
            </View>
          </View>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  dropdown: {
    position: "absolute",
    top: "100%",
    left: 0,
    right: 0,
    zIndex: 999,
    borderRadius: 8,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    marginTop: 4,
  },
  suggestionRow: {
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  suggestionLeft: {
    alignItems: "center",
    flex: 1,
    marginEnd: 8,
  },
  suggestionNames: {
    alignItems: "flex-start",
    flex: 1,
  },
  suggestionAr: {
    fontSize: 15,
    fontFamily: "Tajawal_500Medium",
    width: "100%",
  },
  suggestionEn: {
    fontSize: 12,
    marginTop: 2,
    width: "100%",
  },
  sourceBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  sourceText: {
    fontSize: 11,
    fontFamily: "Tajawal_500Medium",
  },
});
