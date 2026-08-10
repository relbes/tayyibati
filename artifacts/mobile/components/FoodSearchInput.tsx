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
            backgroundColor: colors.card,
            borderColor: showSuggestions ? colors.primary : colors.border,
          },
        ]}
      >
        {rtl ? (
          /* Arabic Physical Order: LEFT edge -> Search | TextInput | Clear | Camera -> RIGHT edge */
          <>
            {/* Far LEFT edge: Search Button */}
            <TouchableOpacity
              style={[
                styles.searchBtn,
                {
                  backgroundColor: colors.primary,
                  opacity: query.trim() ? 1 : 0.5,
                },
              ]}
              onPress={handleSearchSubmit}
              disabled={!query.trim() || isAnalyzing}
              activeOpacity={0.8}
            >
              <Icon name="search" size={18} color="#fff" />
            </TouchableOpacity>

            {/* Flexible Center: Arabic TextInput */}
            <TextInput
              ref={inputRef}
              style={[
                localizedInput(),
                styles.searchInput,
                { color: colors.foreground, flex: 1 },
              ]}
              placeholder={t("home.searchPlaceholder")}
              placeholderTextColor={colors.mutedForeground}
              value={query}
              onChangeText={setQuery}
              onSubmitEditing={handleSearchSubmit}
              returnKeyType="search"
              selectionColor={colors.primary}
            />

            {/* Clear Button next to Camera */}
            {query.trim().length > 0 && (
              <TouchableOpacity 
                style={styles.clearBtn} 
                onPress={() => { setQuery(""); inputRef.current?.focus(); }}
                activeOpacity={0.7}
              >
                <Icon name="close-circle" size={20} color={colors.mutedForeground} />
              </TouchableOpacity>
            )}

            {/* Far RIGHT edge: Camera Button */}
            {!hideCameraIcon && (
              <TouchableOpacity style={styles.camBtn} onPress={onCameraPress} activeOpacity={0.7}>
                <Icon name="camera" size={20} color={colors.primary} />
              </TouchableOpacity>
            )}
          </>
        ) : (
          /* English Physical Order: LEFT edge -> Camera | Clear | TextInput | Search -> RIGHT edge */
          <>
            {!hideCameraIcon && (
              <TouchableOpacity style={styles.camBtn} onPress={onCameraPress} activeOpacity={0.7}>
                <Icon name="camera" size={20} color={colors.primary} />
              </TouchableOpacity>
            )}
            {query.trim().length > 0 && (
              <TouchableOpacity 
                style={styles.clearBtn} 
                onPress={() => { setQuery(""); inputRef.current?.focus(); }}
                activeOpacity={0.7}
              >
                <Icon name="close-circle" size={20} color={colors.mutedForeground} />
              </TouchableOpacity>
            )}
            <TextInput
              ref={inputRef}
              style={[
                localizedInput(),
                styles.searchInput,
                { color: colors.foreground, flex: 1 },
              ]}
              placeholder={t("home.searchPlaceholder")}
              placeholderTextColor={colors.mutedForeground}
              value={query}
              onChangeText={setQuery}
              onSubmitEditing={handleSearchSubmit}
              returnKeyType="search"
              selectionColor={colors.primary}
            />
            <TouchableOpacity
              style={[
                styles.searchBtn,
                {
                  backgroundColor: colors.primary,
                  opacity: query.trim() ? 1 : 0.5,
                },
              ]}
              onPress={handleSearchSubmit}
              disabled={!query.trim() || isAnalyzing}
              activeOpacity={0.8}
            >
              <Icon name="search" size={18} color="#fff" />
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
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    gap: 4,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    fontFamily: "Tajawal_500Medium",
    paddingHorizontal: 8,
    minHeight: 40,
  },
  searchBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  clearBtn: {
    padding: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  camBtn: {
    padding: 8,
    alignItems: "center",
    justifyContent: "center",
  },
});
