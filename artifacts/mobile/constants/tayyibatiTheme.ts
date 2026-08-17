export const TayyibatiTheme = {
  colors: {
    // ─────────────────────────────────────────────
    // Base
    // ─────────────────────────────────────────────
    background: "#FCFCFA",
    surface: "#FFFFFF",
    surfaceWarm: "#FFFDF7",

    // ─────────────────────────────────────────────
    // Tayyibati Green
    // ─────────────────────────────────────────────
    primary: "#0B8F55",
    primaryDark: "#087344",
    primaryDarker: "#075C38",
    primarySoft: "#EFF8E9",
    primaryMuted: "#DFF1D5",

    // ─────────────────────────────────────────────
    // Supporting accents
    // ─────────────────────────────────────────────
    orange: "#F59E0B",
    orangeDark: "#E88900",
    orangeSoft: "#FFF7E6",

    danger: "#EF476F",
    dangerDark: "#D9365A",
    dangerSoft: "#FFF0F3",

    purple: "#7B61C9",
    purpleDark: "#6549B2",
    purpleSoft: "#F5F0FF",

    blue: "#168FD3",
    blueDark: "#0877B8",
    blueSoft: "#EEF8FF",

    lime: "#8BC34A",
    limeSoft: "#F2F8E9",

    // ─────────────────────────────────────────────
    // Typography
    // ─────────────────────────────────────────────
    text: "#171B18",
    textSecondary: "#606861",
    textTertiary: "#929A94",
    textOnPrimary: "#FFFFFF",

    // ─────────────────────────────────────────────
    // Borders
    // ─────────────────────────────────────────────
    border: "#E5EAE5",
    borderSoft: "#EEF2ED",

    // ─────────────────────────────────────────────
    // Utility
    // ─────────────────────────────────────────────
    white: "#FFFFFF",
    black: "#000000",
    transparent: "transparent",
  },

  radius: {
    small: 12,
    medium: 16,
    large: 22,
    xlarge: 28,
    xxlarge: 32,
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
    huge: 40,
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
      hero: 36,
    },

    lineHeight: {
      sm: 20,
      md: 24,
      lg: 28,
      xl: 32,
      display: 42,
    },
  },

  shadows: {
    card: {
      shadowColor: "#000000",
      shadowOffset: {
        width: 0,
        height: 2,
      },
      shadowOpacity: 0.045,
      shadowRadius: 8,
      elevation: 2,
    },

    floating: {
      shadowColor: "#000000",
      shadowOffset: {
        width: 0,
        height: 5,
      },
      shadowOpacity: 0.12,
      shadowRadius: 14,
      elevation: 6,
    },

    search: {
      shadowColor: "#000000",
      shadowOffset: {
        width: 0,
        height: 3,
      },
      shadowOpacity: 0.07,
      shadowRadius: 12,
      elevation: 4,
    },
  },
} as const;

export type TayyibatiThemeType = typeof TayyibatiTheme;