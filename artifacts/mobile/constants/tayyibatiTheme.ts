export const TayyibatiTheme = {
  colors: {
    // ─────────────────────────────────────────────
    // Base & Card Colors (Warm Organic Palette)
    // ─────────────────────────────────────────────
    background: "#FAFAF7",
    surface: "#FFFFFF",
    surfaceWarm: "#FFFDF7",

    // ─────────────────────────────────────────────
    // Tayyibati Green
    // ─────────────────────────────────────────────
    primary: "#16A34A",
    primaryDark: "#15803D",
    primaryDarker: "#075C38",
    primarySoft: "#EAF7EF",
    primaryMuted: "#D4F0DF",

    // ─────────────────────────────────────────────
    // Header & Mint Hero Specific Palette
    // ─────────────────────────────────────────────
    headerBackground: "#FFF9EC",
    headerBorder: "#F1EBD9",
    headerBgIvory: "#C9E4D4",
    headerBorderSubtle: "#A3CDB3",
    profileBtnBorder: "#A3CDB3",
    subtitleMuted: "#244231",

    mintHeroCard: "#E8F7EE",
    mintHeroBorder: "#CDEBD8",
    mintHeroBody: "#5F756A",

    heroCardBg: "#FFF7F2",
    heroCardBorder: "#FFE8DC",

    // ─────────────────────────────────────────────
    // Pastel Card Module Colors & Accents
    // ─────────────────────────────────────────────
    greenCard: "#EAF7EF",

    orangeCard: "#FFF3D6",
    orange: "#F59E0B",
    orangeDark: "#D97706",
    orangeSoft: "#FFF7E6",

    pinkCard: "#FFF0F2",
    pink: "#EF476F",
    pinkDark: "#D9365A",
    pinkSoft: "#FFF0F3",

    purpleCard: "#F4F0FF",
    purple: "#8B5CF6",
    purpleDark: "#7C3AED",
    purpleSoft: "#F5F0FF",

    blueCard: "#EEF6FF",
    blue: "#3B82F6",
    blueDark: "#2563EB",
    blueSoft: "#EEF8FF",

    tealCard: "#EAF9F5",
    teal: "#0F9F7A",
    tealSoft: "#EAF9F5",

    danger: "#EF476F",
    dangerDark: "#D9365A",
    dangerSoft: "#FFF0F3",

    // ─────────────────────────────────────────────
    // Typography
    // ─────────────────────────────────────────────
    text: "#111827",
    textSecondary: "#6B7280",
    textTertiary: "#9CA3AF",
    textOnPrimary: "#FFFFFF",

    // ─────────────────────────────────────────────
    // Borders
    // ─────────────────────────────────────────────
    border: "#E5E7EB",
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
      shadowOpacity: 0.04,
      shadowRadius: 8,
      elevation: 2,
    },

    floating: {
      shadowColor: "#000000",
      shadowOffset: {
        width: 0,
        height: 5,
      },
      shadowOpacity: 0.1,
      shadowRadius: 14,
      elevation: 5,
    },

    search: {
      shadowColor: "#000000",
      shadowOffset: {
        width: 0,
        height: 3,
      },
      shadowOpacity: 0.06,
      shadowRadius: 10,
      elevation: 3,
    },
  },
} as const;

export type TayyibatiThemeType = typeof TayyibatiTheme;