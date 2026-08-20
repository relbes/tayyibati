export const TayyibatiTheme = {
  colors: {
    // ─────────────────────────────────────────────
    // Base & Card Colors (Warm Organic Palette)
    // ─────────────────────────────────────────────
    background: "#FAFAF8",
    surface: "#FFFFFF",
    surfaceWarm: "#FFFDF7",

    // ─────────────────────────────────────────────
    // Tayyibati Green
    // ─────────────────────────────────────────────
    primary: "#16A34A",
    primaryDark: "#15803D",
    primaryDarker: "#166534",
    primarySoft: "#E8F7EE",
    primaryMuted: "#D4F0DF",

    // ─────────────────────────────────────────────
    // Header & Mint Hero Specific Palette
    // ─────────────────────────────────────────────
    headerBackground: "#FFF9EC",
    headerBorder: "#F1EBD9",
    headerBgIvory: "#11674e",
    headerBorderSubtle: "#0D523E",
    profileBtnBorder: "#1B8A6B",
    subtitleMuted: "#f3f6f4",

    mintHeroCard: "#DCFCE7",
    mintHeroBorder: "#86EFAC",
    mintHeroBody: "#374151",

    heroCardBg: "#DCFCE7",
    heroCardBorder: "#86EFAC",

    // ─────────────────────────────────────────────
    // Pastel Card Module Colors & Accents
    // ─────────────────────────────────────────────
    greenCard: "#DCFCE7",

    orangeCard: "#FEF08A",
    orange: "#F59E0B",
    orangeDark: "#D97706",
    orangeSoft: "#FFF7E6",

    pinkCard: "#FECDD3",
    pink: "#E11D48",
    pinkDark: "#9F1239",
    pinkSoft: "#FECDD3",

    purpleCard: "#E9D5FF",
    purple: "#8B5CF6",
    purpleDark: "#7C3AED",
    purpleSoft: "#F5F0FF",

    blueCard: "#BAE6FD",
    blue: "#2563EB",
    blueDark: "#1D4ED8",
    blueSoft: "#EEF6FF",

    tealCard: "#CCFBF1",
    teal: "#0D9488",
    tealSoft: "#5EEAD4",

    danger: "#EF4444",
    dangerDark: "#DC2626",
    dangerSoft: "#FEE2E2",

    // ─────────────────────────────────────────────
    // Typography
    // ─────────────────────────────────────────────
    text: "#111827",
    textSecondary: "#4B5563",
    textTertiary: "#6B7280",
    textOnPrimary: "#FFFFFF",

    // ─────────────────────────────────────────────
    // Borders
    // ─────────────────────────────────────────────
    border: "#D1D5DB",
    borderSoft: "#E5E7EB",

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