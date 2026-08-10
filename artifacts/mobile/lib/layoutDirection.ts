import { isRTL } from './i18n';
import { ViewStyle, TextStyle } from "react-native";

export function localizedText(): TextStyle {
  return {
    writingDirection: isRTL() ? "rtl" : "ltr",
    textAlign: isRTL() ? "right" : "left",
  } as const;
}

export function localizedTextFull(): TextStyle {
  return {
    ...localizedText(),
    width: "100%",
  } as const;
}

export function localizedInput(): TextStyle {
  return {
    writingDirection: isRTL() ? "rtl" : "ltr",
    textAlign: isRTL() ? "right" : "left",
  } as const;
}

/**
 * Returns flexDirection that visually maps to:
 * Arabic: Right-to-Left visually
 * English: Left-to-Right visually
 *
 * e.g., if you write <A/><B/>, visually you'll get:
 * Arabic: B A (because A goes to the rightmost edge)
 * English: A B (because A stays on the left)
 */
export function rtlRow(): ViewStyle {
  return {
    flexDirection: isRTL() ? "row-reverse" : "row",
  } as const;
}

/**
 * Alias for rtlRow(). Kept for backward compatibility with all existing call sites.
 * Produces: row-reverse for Arabic, row for English.
 */
export function localizedRow(): ViewStyle {
  return rtlRow();
}

/**
 * Returns flexDirection for when you literally want Left-to-Right visually in all locales.
 */
export function ltrRow(): ViewStyle {
  return {
    flexDirection: "row",
  } as const;
}

export function ltrText(): TextStyle {
  return {
    writingDirection: "ltr",
  } as const;
}
