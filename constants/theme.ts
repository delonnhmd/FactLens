// PHASE 1 STEP 4
export const theme = {
  colors: {
    primary: "#2563EB",
    success: "#22C55E",
    danger: "#EF4444",
    warning: "#F59E0B",
    background: "#FFFFFF",
    card: "#F8FAFC",
    text: "#111827",
    subtext: "#6B7280",
    muted: "#9CA3AF",
    border: "#E5E7EB",
    lightBorder: "#F3F4F6",
  },

  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 40,
  },

  radius: {
    sm: 8,
    md: 12,
    lg: 18,
    xl: 24,
  },

  typography: {
    small: {
      fontSize: 12,
      lineHeight: 16,
      fontWeight: "500" as const,
    },
    body: {
      fontSize: 16,
      lineHeight: 24,
      fontWeight: "400" as const,
    },
    title: {
      fontSize: 20,
      lineHeight: 28,
      fontWeight: "700" as const,
    },
    largeTitle: {
      fontSize: 28,
      lineHeight: 36,
      fontWeight: "700" as const,
    },
  },

  shadows: {
    light: {
      shadowColor: "#000000",
      shadowOpacity: 0.04,
      shadowRadius: 8,
      elevation: 2,
    },
    medium: {
      shadowColor: "#000000",
      shadowOpacity: 0.06,
      shadowRadius: 12,
      elevation: 3,
    },
    heavy: {
      shadowColor: "#000000",
      shadowOpacity: 0.1,
      shadowRadius: 16,
      elevation: 4,
    },
  },
};
