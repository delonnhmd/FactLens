import { Appearance } from "react-native";

// PHASE 1 STEP 4
// Verifact UI redesign
const prefersDarkMode = Appearance.getColorScheme() === "dark";

const lightColors = {
  navy: "#0D1B3E",
  primary: "#0D1B3E",
  success: "#1D9E75",
  successBg: "#E1F5EE",
  danger: "#E24B4A",
  dangerBg: "#FCEBEB",
  warning: "#EF9F27",
  warningBg: "#FAEEDA",
  ai: "#534AB7",
  aiBg: "#EEEDFE",
  tagBg: "#EAF3DE",
  tagText: "#27500A",
  sourceBg: "#E6F1FB",
  sourceText: "#0C447C",
  phaseBg: "#EEEDFE",
  phaseText: "#3C3489",
  link: "#185FA5",
  background: "#FFFFFF",
  card: "#F4F6F8",
  secondarySurface: "#F4F6F8",
  text: "#172033",
  subtext: "#475569",
  muted: "#6B7280",
  border: "#9CA3AF",
  lightBorder: "#D1D5DB",
};

const darkColors = {
  navy: "#0F172A",
  primary: "#93C5FD",
  success: "#7DD3FC",
  successBg: "#0F172A",
  danger: "#FCA5A5",
  dangerBg: "#3F171E",
  warning: "#FACC15",
  warningBg: "#3F3E0E",
  ai: "#C7D2FE",
  aiBg: "#111827",
  tagBg: "#0F172A",
  tagText: "#D1FAE5",
  sourceBg: "#082E4B",
  sourceText: "#93C5FD",
  phaseBg: "#1E293B",
  phaseText: "#E2E8F0",
  link: "#93C5FD",
  background: "#020617",
  card: "#0B1226",
  secondarySurface: "#111B32",
  text: "#F8FAFC",
  subtext: "#CBD5E1",
  muted: "#94A3B8",
  border: "#334155",
  lightBorder: "#1E293B",
};

export const theme = {
  colors: prefersDarkMode ? darkColors : lightColors,

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
      fontWeight: "500" as const,
    },
    largeTitle: {
      fontSize: 28,
      lineHeight: 36,
      fontWeight: "500" as const,
    },
  },

  shadows: {
    light: {},
    medium: {},
    heavy: {},
  },
};
