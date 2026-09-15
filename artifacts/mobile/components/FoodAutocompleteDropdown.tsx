import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import type { AutocompleteSuggestion } from "../hooks/useFoodSearch";
import { LocalizedText } from "./LocalizedText";
import { Icon } from "./Icon";
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
    <View style={[styles.dropdown, { backgroundColor: "#FFFFFF", borderColor: "#DCFCE7" }]}>
      {suggestions.map((food, idx) => (
        <React.Fragment key={idx}>
          {!!(food as any).sectionHeader && (
            <View style={[styles.sectionHeader, { backgroundColor: "#F0FDF4", borderBottomWidth: 1, borderBottomColor: "#DCFCE7" }]}>
              <Text style={[styles.sectionHeaderText, { color: "#11674E" }]}>{(food as any).sectionHeader}</Text>
            </View>
          )}
          <TouchableOpacity
            style={[
              localizedRow(),
              styles.suggestionRow,
              idx < suggestions.length - 1 && { borderBottomWidth: 1, borderBottomColor: "#F3F4F6" },
            ]}
            onPress={() => onSelect(food)}
            activeOpacity={0.7}
          >
            <View style={[localizedRow(), styles.suggestionLeft]}>
              <View style={[styles.iconWrapper, { backgroundColor: "#DCFCE7" }]}>
                <Icon
                  name={food.entityType === "dish" ? "utensils" : "leaf"}
                  size={16}
                  color="#008C5A"
                />
              </View>
              <View style={styles.suggestionNames}>
                <LocalizedText style={[styles.suggestionAr, { color: "#111827" }]}>{food.labelAr}</LocalizedText>
                {!!food.labelEn && <Text style={[ltrText(), styles.suggestionEn, { color: "#6B7280" }]}>{food.labelEn}</Text>}
              </View>
            </View>
          </TouchableOpacity>
        </React.Fragment>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  sectionHeader: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  sectionHeaderText: {
    fontSize: 12,
    fontFamily: "Tajawal_700Bold",
    textAlign: "right",
  },
  dropdown: {
    position: "absolute",
    top: "100%",
    left: 0,
    right: 0,
    zIndex: 999,
    borderRadius: 18,
    borderWidth: 1,
    overflow: "hidden",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
    marginTop: 6,
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
  iconWrapper: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    marginEnd: 10,
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
    fontFamily: "Tajawal_500Medium",
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
