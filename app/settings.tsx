import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useMemo } from "react";
import type { ReactNode } from "react";
import {
  Alert,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import {
  getAppVersion,
  openExternalUrl,
  type AppTheme,
  type TextSizePreference,
  type ThemePreference,
} from "../context/DisplaySettingsContext";
import { useDisplaySettings } from "../hooks/useTheme";

type SegmentOption<T extends string> = {
  label: string;
  value: T;
};

const themeOptions: Array<SegmentOption<ThemePreference>> = [
  { label: "System", value: "system" },
  { label: "Light", value: "light" },
  { label: "Dark", value: "dark" },
];

const textSizeOptions: Array<SegmentOption<TextSizePreference>> = [
  { label: "Small", value: "small" },
  { label: "Default", value: "default" },
  { label: "Large", value: "large" },
  { label: "Extra Large", value: "extraLarge" },
];

export default function SettingsScreen() {
  const router = useRouter();
  const {
    appTheme,
    highContrastEnabled,
    notificationSettings,
    reduceMotionOverride,
    setHighContrastEnabled,
    setNotificationSetting,
    setReduceMotionOverride,
    setTextSizePreference,
    setThemePreference,
    textSizePreference,
    themePreference,
  } = useDisplaySettings();
  const styles = useMemo(() => createStyles(appTheme), [appTheme]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerButton}
          activeOpacity={0.75}
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Back"
          accessibilityHint="Returns to the previous screen"
        >
          <Ionicons name="chevron-back" size={22} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={styles.headerButton} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Section title="Appearance" styles={styles}>
          <SegmentedControl
            label="Theme"
            options={themeOptions}
            selectedValue={themePreference}
            onChange={setThemePreference}
            styles={styles}
          />
          <SegmentedControl
            label="Text size"
            options={textSizeOptions}
            selectedValue={textSizePreference}
            onChange={setTextSizePreference}
            styles={styles}
          />
        </Section>

        <Section title="Accessibility" styles={styles}>
          <SettingsToggle
            label="Reduce motion override"
            value={reduceMotionOverride}
            onValueChange={setReduceMotionOverride}
            styles={styles}
          />
          <SettingsToggle
            label="High contrast mode"
            value={highContrastEnabled}
            onValueChange={setHighContrastEnabled}
            styles={styles}
          />
        </Section>

        <Section title="Notifications" styles={styles}>
          <SettingsToggle
            label="Push notifications"
            value={notificationSettings.pushNotifications}
            onValueChange={(enabled) => setNotificationSetting("pushNotifications", enabled)}
            styles={styles}
          />
          <SettingsToggle
            label="Badge & rank updates"
            value={notificationSettings.badgeRankUpdates}
            onValueChange={(enabled) => setNotificationSetting("badgeRankUpdates", enabled)}
            styles={styles}
          />
          <SettingsToggle
            label="Election alerts"
            value={notificationSettings.electionAlerts}
            onValueChange={(enabled) => setNotificationSetting("electionAlerts", enabled)}
            styles={styles}
          />
        </Section>

        <Section title="Account" styles={styles}>
          <SettingsLink label="Edit profile" onPress={() => router.push("/profile")} styles={styles} />
          <SettingsLink
            label="Change password"
            onPress={() => Alert.alert("Change password", "Use the account email flow from the sign-in screen.")}
            styles={styles}
          />
          <SettingsLink
            label="Delete account"
            danger
            onPress={() => router.push("/profile")}
            styles={styles}
          />
        </Section>

        <Section title="About" styles={styles}>
          <SettingsLink label="Privacy Policy" onPress={() => openExternalUrl("https://factlens.app/privacy")} styles={styles} />
          <SettingsLink label="Terms of Service" onPress={() => openExternalUrl("https://factlens.app/terms")} styles={styles} />
          <SettingsLink
            label="How verdicts work"
            onPress={() => openExternalUrl("https://factlens.app/how-it-works")}
            styles={styles}
          />
          <View style={styles.staticRow}>
            <Text style={styles.rowLabel}>App version</Text>
            <Text style={styles.rowValue}>{getAppVersion()}</Text>
          </View>
        </Section>
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({
  title,
  children,
  styles,
}: {
  title: string;
  children: ReactNode;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <View style={styles.sectionWrap}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionCard}>{children}</View>
    </View>
  );
}

function SegmentedControl<T extends string>({
  label,
  options,
  selectedValue,
  onChange,
  styles,
}: {
  label: string;
  options: Array<SegmentOption<T>>;
  selectedValue: T;
  onChange: (value: T) => void;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <View style={styles.controlBlock}>
      <Text style={styles.rowLabel}>{label}</Text>
      <View style={styles.segmentRow}>
        {options.map((option) => {
          const selected = option.value === selectedValue;

          return (
            <TouchableOpacity
              key={option.value}
              style={[styles.segment, selected && styles.segmentSelected]}
              activeOpacity={0.8}
              onPress={() => onChange(option.value)}
              accessibilityRole="button"
              accessibilityLabel={`${label}: ${option.label}`}
              accessibilityState={{ selected }}
            >
              <Text style={[styles.segmentText, selected && styles.segmentTextSelected]}>{option.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

function SettingsToggle({
  label,
  value,
  onValueChange,
  styles,
}: {
  label: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: "#475569", true: "#2563EB" }}
        thumbColor="#FFFFFF"
        accessibilityLabel={label}
      />
    </View>
  );
}

function SettingsLink({
  label,
  onPress,
  styles,
  danger = false,
}: {
  label: string;
  onPress: () => void;
  styles: ReturnType<typeof createStyles>;
  danger?: boolean;
}) {
  return (
    <TouchableOpacity
      style={styles.row}
      activeOpacity={0.8}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Text style={[styles.rowLabel, danger && styles.dangerText]}>{label}</Text>
      <Ionicons name="chevron-forward" size={17} color={danger ? "#E24B4A" : styles.iconColor.color} />
    </TouchableOpacity>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    container: {
      backgroundColor: theme.colors.card,
      flex: 1,
    },
    header: {
      alignItems: "center",
      backgroundColor: "#0D1B3E",
      flexDirection: "row",
      justifyContent: "space-between",
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    headerButton: {
      alignItems: "center",
      height: 36,
      justifyContent: "center",
      width: 36,
    },
    headerTitle: {
      color: "#FFFFFF",
      fontSize: Math.round(20 * (theme.typography.body.fontSize / 16)),
      fontWeight: "500",
    },
    content: {
      gap: 14,
      padding: 12,
      paddingBottom: 28,
    },
    sectionWrap: {
      gap: 7,
    },
    sectionTitle: {
      color: theme.colors.subtext,
      fontSize: theme.typography.small.fontSize,
      fontWeight: "500",
      paddingHorizontal: 4,
    },
    sectionCard: {
      backgroundColor: theme.isDark ? "#111827" : "#FFFFFF",
      borderColor: theme.colors.lightBorder,
      borderRadius: 12,
      borderWidth: theme.borderWidth,
      overflow: "hidden",
    },
    controlBlock: {
      borderBottomColor: theme.colors.lightBorder,
      borderBottomWidth: theme.borderWidth,
      gap: 9,
      padding: 14,
    },
    segmentRow: {
      backgroundColor: theme.colors.secondarySurface,
      borderColor: theme.colors.lightBorder,
      borderRadius: 10,
      borderWidth: theme.borderWidth,
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 6,
      padding: 5,
    },
    segment: {
      alignItems: "center",
      borderRadius: 8,
      flexGrow: 1,
      minWidth: 84,
      paddingHorizontal: 10,
      paddingVertical: 9,
    },
    segmentSelected: {
      backgroundColor: "#2563EB",
    },
    segmentText: {
      color: theme.colors.subtext,
      fontSize: theme.typography.small.fontSize,
      fontWeight: "500",
    },
    segmentTextSelected: {
      color: "#FFFFFF",
    },
    row: {
      alignItems: "center",
      borderBottomColor: theme.colors.lightBorder,
      borderBottomWidth: theme.borderWidth,
      flexDirection: "row",
      justifyContent: "space-between",
      minHeight: 54,
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    staticRow: {
      alignItems: "center",
      flexDirection: "row",
      justifyContent: "space-between",
      minHeight: 54,
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    rowLabel: {
      color: theme.colors.text,
      flex: 1,
      fontSize: theme.typography.body.fontSize,
      fontWeight: "500",
    },
    rowValue: {
      color: theme.colors.subtext,
      fontSize: theme.typography.small.fontSize,
      fontWeight: "500",
    },
    dangerText: {
      color: "#E24B4A",
    },
    iconColor: {
      color: theme.colors.subtext,
    },
  });
}
