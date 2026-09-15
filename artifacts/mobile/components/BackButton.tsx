import React from "react";
import { TouchableOpacity, StyleProp, ViewStyle, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import Svg, { Path } from "react-native-svg";
import { isRTL } from "@/lib/i18n";

export interface BackButtonProps {
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  color?: string;
  size?: number;
}

/**
 * Standardized BackButton for Tayyibati Arabic RTL app.
 * Clean, solid dark emerald circular button with a crisp white arrow.
 * Simple, elegant, and normal (without glass/gloss effects).
 * Arrow direction automatically adapts to RTL (pointing right →) or LTR (pointing left ←).
 */
export const BackButton = React.memo(function BackButton({
  onPress,
  style,
  color = "#FFFFFF",
  size = 42,
}: BackButtonProps) {
  const router = useRouter();
  const rtl = isRTL();

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

  const arrowPath = rtl
    ? "M5 12h14M12 5l7 7-7 7" // RTL: Back goes Right (→)
    : "M19 12H5M12 19l-7-7 7-7"; // LTR: Back goes Left (←)

  return (
    <TouchableOpacity
      onPress={handlePress}
      style={[
        styles.button,
        {
          width: size,
          height: size,
          borderRadius: 12,
        },
        style,
      ]}
      activeOpacity={0.7}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      accessibilityRole="button"
      accessibilityLabel="رجوع"
    >
      <Svg
        width={Math.round(size * 0.52)}
        height={Math.round(size * 0.52)}
        viewBox="0 0 24 24"
        fill="none"
      >
        <Path
          d={arrowPath}
          stroke={color}
          strokeWidth={2.8}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  button: {
    backgroundColor: "#008C5A",
    borderColor: "#007A4E",
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 20,
    shadowColor: "#022B1B",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.28,
    shadowRadius: 5,
    elevation: 4,
  },
});
