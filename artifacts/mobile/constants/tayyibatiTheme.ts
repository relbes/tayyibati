export const TayyibatiTheme = {
  colors: {
    background: "#FAFAF8",
    surface: "#FFFFFF",
    primary: "#16A34A",
    primaryDark: "#15803D",
    primarySoft: "#EAF7EF",
    orange: "#F59E0B",
    orangeSoft: "#FFF7E6",
    danger: "#EF4444",
    dangerSoft: "#FEF2F2",
    purple: "#8B5CF6",
    purpleSoft: "#F5F3FF",
    blue: "#3B82F6",
    blueSoft: "#EFF6FF",
    text: "#111827",
    textSecondary: "#6B7280",
    textTertiary: "#9CA3AF",
    border: "#E5E7EB",
    borderSoft: "#EEF2F0",
    white: "#FFFFFF",
    black: "#000000",
  },

  radius: {
    small: 10,
    medium: 16,
    large: 22,
    xlarge: 28,
    pill: 999,
    circle: 999,
  },

  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    xxl: 24,
    xxxl: 32,
  },

  typography: {
    fontFamily: {
      regular: "Tajawal_400Regular",
      medium: "Tajawal_500Medium",
      bold: "Tajawal_700Bold",
    },
    size: {
      xs: 12,
      sm: 14,
      md: 16,
      lg: 18,
      xl: 22,
      xxl: 28,
      display: 32,
    },
  },

  shadows: {
    card: {
      shadowColor: "#000000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 8,
      elevation: 2,
    },
    floating: {
      shadowColor: "#000000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.14,
      shadowRadius: 12,
      elevation: 6,
    },
  },
} as const;

export type TayyibatiThemeType = typeof TayyibatiTheme;
