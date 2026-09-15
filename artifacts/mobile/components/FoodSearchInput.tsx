import React, { useRef } from "react";
import { View, TextInput, TouchableOpacity, StyleSheet } from "react-native";
import { Icon } from "@/components/Icon";
import { useColors } from "@/hooks/useColors";
import { FoodAutocompleteDropdown } from "./FoodAutocompleteDropdown";

import { localizedInput } from "@/lib/layoutDirection";
import { isRTL, t } from "@/lib/i18n";

interface Props {
  query: string;
  setQuery: (q: string) => void;
  onSearch: (q?: string) => void;
  onCameraPress: () => void;
  suggestions: any[];
  showSuggestions: boolean;
  onSelectSuggestion: (food: any) => void;
  isAnalyzing: boolean;
  hideCameraIcon?: boolean;
}

export function FoodSearchInput({
  query,
  setQuery,
  onSearch,
  onCameraPress,
  suggestions,
  showSuggestions,
  onSelectSuggestion,
  isAnalyzing,
  hideCameraIcon = false
}: Props) {
  const colors = useColors();
  const inputRef = useRef<TextInput>(null);
  const rtl = isRTL();

  const handleSearchSubmit = () => {
    const trimmed = query.trim();
    if (!trimmed) return;
    onSearch(trimmed);
  };

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.searchRow,
          {
            flexDirection: "row",
            backgroundColor: "#FFFFFF",
            borderWidth: showSuggestions ? 1 : 0,
            borderColor: showSuggestions ? "#16A34A" : "transparent",
          },
        ]}
      >
        {rtl ? (
          /* Arabic Order: LEFT (Search) -> TextInput -> Clear -> RIGHT (Barcode/Scan) */
          <>
            {/* Far LEFT edge: Search Action Icon */}
            <TouchableOpacity
              style={styles.searchIconBtn}
              onPress={handleSearchSubmit}
              disabled={!query.trim() || isAnalyzing}
              activeOpacity={0.7}
            >
              <Icon name="search" size={22} color="#008C5A" strokeWidth={2.4} />
            </TouchableOpacity>

            {/* Flexible Center: Arabic TextInput */}
            <TextInput
              ref={inputRef}
              style={[
                localizedInput(),
                styles.searchInput,
                { color: "#111827", flex: 1, textAlign: "right" },
              ]}
              placeholder="ابحث عن طعام أو طبق ..."
              placeholderTextColor="#6B7280"
              value={query}
              onChangeText={setQuery}
              onSubmitEditing={handleSearchSubmit}
              returnKeyType="search"
              selectionColor="#16A34A"
            />

            {/* Clear Button */}
            {query.trim().length > 0 && (
              <TouchableOpacity
                style={styles.clearBtn}
                onPress={() => {
                  setQuery("");
                  inputRef.current?.focus();
                }}
                activeOpacity={0.7}
              >
                <Icon name="close-circle" size={18} color="#9CA3AF" />
              </TouchableOpacity>
            )}

            {/* Far RIGHT edge: Camera Button */}
            {!hideCameraIcon && (
              <TouchableOpacity style={styles.camBtn} onPress={onCameraPress} activeOpacity={0.7}>
                <Icon name="camera" size={22} color="#008C5A" />
              </TouchableOpacity>
            )}
          </>
        ) : (
          /* English Order: LEFT (Camera) -> Clear -> TextInput -> RIGHT (Search) */
          <>
            {!hideCameraIcon && (
              <TouchableOpacity style={styles.camBtn} onPress={onCameraPress} activeOpacity={0.7}>
                <Icon name="camera" size={22} color="#008C5A" />
              </TouchableOpacity>
            )}
            {query.trim().length > 0 && (
              <TouchableOpacity
                style={styles.clearBtn}
                onPress={() => {
                  setQuery("");
                  inputRef.current?.focus();
                }}
                activeOpacity={0.7}
              >
                <Icon name="close-circle" size={18} color="#9CA3AF" />
              </TouchableOpacity>
            )}
            <TextInput
              ref={inputRef}
              style={[
                localizedInput(),
                styles.searchInput,
                { color: "#111827", flex: 1, textAlign: "left" },
              ]}
              placeholder="ابحث عن طعام أو طبق ..."
              placeholderTextColor="#6B7280"
              value={query}
              onChangeText={setQuery}
              onSubmitEditing={handleSearchSubmit}
              returnKeyType="search"
              selectionColor="#16A34A"
            />
            <TouchableOpacity
              style={styles.searchIconBtn}
              onPress={handleSearchSubmit}
              disabled={!query.trim() || isAnalyzing}
              activeOpacity={0.7}
            >
              <Icon name="search" size={22} color="#008C5A" strokeWidth={2.4} />
            </TouchableOpacity>
          </>
        )}
      </View>

      {/* Autocomplete Dropdown */}
      <FoodAutocompleteDropdown
        suggestions={suggestions}
        showSuggestions={showSuggestions}
        onSelect={onSelectSuggestion}
        colors={colors}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    zIndex: 999,
    width: "100%",
  },
  searchRow: {
    paddingHorizontal: 8,
    height: 54,
    borderRadius: 27,
    alignItems: "center",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    fontFamily: "Tajawal_500Medium",
    paddingHorizontal: 10,
    height: 48,
  },
  searchIconBtn: {
    padding: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  clearBtn: {
    padding: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  camBtn: {
    padding: 8,
    alignItems: "center",
    justifyContent: "center",
  },
});
