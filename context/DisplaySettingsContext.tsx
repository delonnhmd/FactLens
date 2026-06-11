import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import {
  AccessibilityInfo,
  Linking,
  type TextStyle,
  type ViewStyle,
  useColorScheme,
} from "react-native";
import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type ThemePreference = "system" | "light" | "dark";
export type TextSizePreference = "small" | "default" | "large" | "extraLarge";

type DisplaySettingsContextValue = {
  appTheme: AppTheme;
  effectiveColorScheme: "light" | "dark";
  highContrastEnabled: boolean;
  reduceMotionEnabled: boolean;
  reduceMotionOverride: boolean;
  textScale: number;
  textSizePreference: TextSizePreference;
  themePreference: ThemePreference;
  notificationSettings: NotificationSettings;
  setHighContrastEnabled: (enabled: boolean) => void;
  setNotificationSetting: (key: keyof NotificationSettings, enabled: boolean) => void;
  setReduceMotionOverride: (enabled: boolean) => void;
  setTextSizePreference: (preference: TextSizePreference) => void;
  setThemePreference: (preference: ThemePreference) => void;
};

export type AppTheme = {
  colors: typeof lightColors;
  isDark: boolean;
  borderWidth: number;
  spacing: typeof spacing;
  radius: typeof radius;
  typography: ReturnType<typeof createTypography>;
  shadows: typeof shadows;
};

type NotificationSettings = {
  pushNotifications: boolean;
  badgeRankUpdates: boolean;
  electionAlerts: boolean;
};

const STORAGE_KEY = "factlens.displaySettings.v1";

const textScaleByPreference: Record<TextSizePreference, number> = {
  small: 0.85,
  default: 1,
  large: 1.15,
  extraLarge: 1.3,
};

const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 40,
};

const radius = {
  sm: 8,
  md: 12,
  lg: 18,
  xl: 24,
};

const shadows = {
  light: {},
  medium: {},
  heavy: {},
};

const lightColors = {
  navy: "#0D1B3E",
  primary: "#2563EB",
  success: "#16825F",
  successBg: "#E1F5EE",
  danger: "#E24B4A",
  dangerBg: "#FCEBEB",
  warning: "#B45309",
  warningBg: "#FFF4D6",
  warningBorder: "#D97706",
  warningText: "#5F370E",
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
  disabledBg: "#475569",
  disabledText: "#CBD5E1",
  border: "#9CA3AF",
  lightBorder: "#D1D5DB",
  tabBar: "rgba(255,255,255,0.92)",
  tabInactive: "#6B7280",
  chipInactiveBg: "#FFFFFF",
  chipInactiveText: "#475569",
  chipActiveBg: "#2563EB",
  chipActiveText: "#FFFFFF",
  banner: "#0D1B3E",
  bannerSubtitle: "#EAF0FF",
  leaderboardRow: "#FFFFFF",
  leaderboardAvatar: "#EAF3DE",
  leaderboardAvatarText: "#27500A",
};

const darkColors = {
  navy: "#0D1B3E",
  primary: "#2563EB",
  success: "#86EFAC",
  successBg: "#0F2F24",
  danger: "#FCA5A5",
  dangerBg: "#3F171E",
  warning: "#FBBF24",
  warningBg: "#3A2118",
  warningBorder: "#9A6B32",
  warningText: "#FFE8B5",
  ai: "#C7D2FE",
  aiBg: "#111827",
  tagBg: "#1E293B",
  tagText: "#CBD5E1",
  sourceBg: "#082E4B",
  sourceText: "#BFDBFE",
  phaseBg: "#1E293B",
  phaseText: "#E2E8F0",
  link: "#93C5FD",
  background: "#0F172A",
  card: "#020617",
  secondarySurface: "#111827",
  text: "#F8FAFC",
  subtext: "#CBD5E1",
  muted: "#94A3B8",
  disabledBg: "#475569",
  disabledText: "#CBD5E1",
  border: "#334155",
  lightBorder: "#334155",
  tabBar: "rgba(15,23,42,0.92)",
  tabInactive: "#94A3B8",
  chipInactiveBg: "#1E293B",
  chipInactiveText: "#CBD5E1",
  chipActiveBg: "#2563EB",
  chipActiveText: "#FFFFFF",
  banner: "#12306F",
  bannerSubtitle: "#EAF0FF",
  leaderboardRow: "#111827",
  leaderboardAvatar: "#1E293B",
  leaderboardAvatarText: "#FFFFFF",
};

const highContrastDarkColors: typeof darkColors = {
  ...darkColors,
  subtext: "#E2E8F0",
  muted: "#E2E8F0",
  warningText: "#FFF7D6",
  chipInactiveText: "#E2E8F0",
  tabInactive: "#E2E8F0",
};

function createTypography(scale: number) {
  return {
    small: {
      fontSize: Math.round(12 * scale),
      lineHeight: Math.round(16 * scale),
      fontWeight: "500" as const,
    },
    body: {
      fontSize: Math.round(16 * scale),
      lineHeight: Math.round(24 * scale),
      fontWeight: "400" as const,
    },
    title: {
      fontSize: Math.round(20 * scale),
      lineHeight: Math.round(28 * scale),
      fontWeight: "500" as const,
    },
    largeTitle: {
      fontSize: Math.round(28 * scale),
      lineHeight: Math.round(36 * scale),
      fontWeight: "500" as const,
    },
  };
}

function createAppTheme({
  colorScheme,
  highContrast,
  textScale,
}: {
  colorScheme: "light" | "dark";
  highContrast: boolean;
  textScale: number;
}): AppTheme {
  const isDark = colorScheme === "dark";
  const colors = isDark && highContrast ? highContrastDarkColors : isDark ? darkColors : lightColors;

  return {
    colors,
    isDark,
    borderWidth: highContrast ? 1 : 0.5,
    spacing,
    radius,
    typography: createTypography(textScale),
    shadows,
  };
}

const defaultNotificationSettings: NotificationSettings = {
  pushNotifications: true,
  badgeRankUpdates: true,
  electionAlerts: true,
};

const defaultValue: DisplaySettingsContextValue = {
  appTheme: createAppTheme({ colorScheme: "light", highContrast: false, textScale: 1 }),
  effectiveColorScheme: "light",
  highContrastEnabled: false,
  reduceMotionEnabled: false,
  reduceMotionOverride: false,
  textScale: 1,
  textSizePreference: "default",
  themePreference: "system",
  notificationSettings: defaultNotificationSettings,
  setHighContrastEnabled: () => undefined,
  setNotificationSetting: () => undefined,
  setReduceMotionOverride: () => undefined,
  setTextSizePreference: () => undefined,
  setThemePreference: () => undefined,
};

export const DisplaySettingsContext = createContext<DisplaySettingsContextValue>(defaultValue);

function readBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function isThemePreference(value: unknown): value is ThemePreference {
  return value === "system" || value === "light" || value === "dark";
}

function isTextSizePreference(value: unknown): value is TextSizePreference {
  return value === "small" || value === "default" || value === "large" || value === "extraLarge";
}

export function DisplaySettingsProvider({ children }: { children: ReactNode }) {
  const systemColorScheme = useColorScheme();
  const [themePreference, setThemePreferenceState] = useState<ThemePreference>("system");
  const [textSizePreference, setTextSizePreferenceState] = useState<TextSizePreference>("default");
  const [highContrastEnabled, setHighContrastEnabledState] = useState(false);
  const [reduceMotionOverride, setReduceMotionOverrideState] = useState(false);
  const [systemReduceMotionEnabled, setSystemReduceMotionEnabled] = useState(false);
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>(defaultNotificationSettings);

  useEffect(() => {
    let mounted = true;

    AsyncStorage.getItem(STORAGE_KEY)
      .then((rawSettings) => {
        if (!mounted || !rawSettings) {
          return;
        }

        const parsed = JSON.parse(rawSettings) as Partial<DisplaySettingsContextValue> & {
          notificationSettings?: Partial<NotificationSettings>;
        };

        if (isThemePreference(parsed.themePreference)) {
          setThemePreferenceState(parsed.themePreference);
        }

        if (isTextSizePreference(parsed.textSizePreference)) {
          setTextSizePreferenceState(parsed.textSizePreference);
        }

        setHighContrastEnabledState(readBoolean(parsed.highContrastEnabled, false));
        setReduceMotionOverrideState(readBoolean(parsed.reduceMotionOverride, false));
        setNotificationSettings({
          pushNotifications: readBoolean(
            parsed.notificationSettings?.pushNotifications,
            defaultNotificationSettings.pushNotifications,
          ),
          badgeRankUpdates: readBoolean(
            parsed.notificationSettings?.badgeRankUpdates,
            defaultNotificationSettings.badgeRankUpdates,
          ),
          electionAlerts: readBoolean(
            parsed.notificationSettings?.electionAlerts,
            defaultNotificationSettings.electionAlerts,
          ),
        });
      })
      .catch(() => undefined);

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setSystemReduceMotionEnabled).catch(() => undefined);

    const subscription = AccessibilityInfo.addEventListener?.("reduceMotionChanged", setSystemReduceMotionEnabled);

    return () => {
      subscription?.remove?.();
    };
  }, []);

  useEffect(() => {
    const settings = {
      themePreference,
      textSizePreference,
      highContrastEnabled,
      reduceMotionOverride,
      notificationSettings,
    };

    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(settings)).catch(() => undefined);
  }, [highContrastEnabled, notificationSettings, reduceMotionOverride, textSizePreference, themePreference]);

  const setThemePreference = useCallback((preference: ThemePreference) => {
    setThemePreferenceState(preference);
  }, []);

  const setTextSizePreference = useCallback((preference: TextSizePreference) => {
    setTextSizePreferenceState(preference);
  }, []);

  const setHighContrastEnabled = useCallback((enabled: boolean) => {
    setHighContrastEnabledState(enabled);
  }, []);

  const setReduceMotionOverride = useCallback((enabled: boolean) => {
    setReduceMotionOverrideState(enabled);
  }, []);

  const setNotificationSetting = useCallback((key: keyof NotificationSettings, enabled: boolean) => {
    setNotificationSettings((currentSettings) => ({
      ...currentSettings,
      [key]: enabled,
    }));
  }, []);

  const effectiveColorScheme =
    themePreference === "system" ? (systemColorScheme === "dark" ? "dark" : "light") : themePreference;
  const textScale = textScaleByPreference[textSizePreference];
  const reduceMotionEnabled = systemReduceMotionEnabled || reduceMotionOverride;

  const appTheme = useMemo(
    () =>
      createAppTheme({
        colorScheme: effectiveColorScheme,
        highContrast: highContrastEnabled,
        textScale,
      }),
    [effectiveColorScheme, highContrastEnabled, textScale],
  );

  const value = useMemo(
    () => ({
      appTheme,
      effectiveColorScheme,
      highContrastEnabled,
      reduceMotionEnabled,
      reduceMotionOverride,
      textScale,
      textSizePreference,
      themePreference,
      notificationSettings,
      setHighContrastEnabled,
      setNotificationSetting,
      setReduceMotionOverride,
      setTextSizePreference,
      setThemePreference,
    }),
    [
      appTheme,
      effectiveColorScheme,
      highContrastEnabled,
      notificationSettings,
      reduceMotionEnabled,
      reduceMotionOverride,
      setHighContrastEnabled,
      setNotificationSetting,
      setReduceMotionOverride,
      setTextSizePreference,
      setThemePreference,
      textScale,
      textSizePreference,
      themePreference,
    ],
  );

  return <DisplaySettingsContext.Provider value={value}>{children}</DisplaySettingsContext.Provider>;
}

export function getAppVersion(): string {
  return Constants.expoConfig?.version ?? "1.0.0";
}

export function openExternalUrl(url: string) {
  Linking.openURL(url).catch(() => undefined);
}

export function scaleTextStyle<T extends TextStyle | ViewStyle>(style: T, scale: number): T {
  const nextStyle = { ...style };

  if ("fontSize" in nextStyle && typeof nextStyle.fontSize === "number") {
    nextStyle.fontSize = Math.round(nextStyle.fontSize * scale);
  }

  if ("lineHeight" in nextStyle && typeof nextStyle.lineHeight === "number") {
    nextStyle.lineHeight = Math.round(nextStyle.lineHeight * scale);
  }

  return nextStyle;
}
