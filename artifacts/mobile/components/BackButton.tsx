import React from "react";
import { TouchableOpacity, StyleProp, ViewStyle, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { Icon } from "./Icon";

export interface BackButtonProps {
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  color?: string;
  size?: number;
}

/**
 * Standardized BackButton for Tayyibati Arabic RTL app.
 * Renders in top-right position with unified arrow direction,
 * dimensions, touch target, and navigation behavior.
 */
export const BackButton = React.memo(function BackButton({
  onPress,
  style,
  color = "#064E24",
  size = 20,
}: BackButtonProps) {
  const router = useRouter();

  const handlePress = () => {
    if (onPress) {
      onPress();
      return;
    }
    try {
      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace("/(tabs)");
      }
    } catch {
      router.replace("/(tabs)");
    }
  };

  return (
    <TouchableOpacity
      onPress={handlePress}
      style={[styles.button, style]}
      activeOpacity={0.7}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      accessibilityRole="button"
      accessibilityLabel="رجوع"
    >
      <Icon name="arrow-back" size={size} color={color} />
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  button: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    borderColor: "#A3CDB3",
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
