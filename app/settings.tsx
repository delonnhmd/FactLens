// APPLE GUIDELINE 1.2 — "Blocked users" row added to Account section (NEW)
// JS-only change. Deploy: eas update --channel preview
// Do NOT run eas build. Apple review response pending.
// Backend deploys to Render independently.
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
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
  type AppTheme,
  type TextSizePreference,
  type ThemePreference,
} from "../context/DisplaySettingsContext";
import { useAuth } from "../context/AuthContext";
import { useDisplaySettings } from "../hooks/useTheme";
import { deleteCurrentAccount } from "../services/accountService";
import { cleanUserError } from "../utils/debugError";

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
  { label: "Medium", value: "default" },
  { label: "Large", value: "large" },
  { label: "Extra Large", value: "extraLarge" },
];

export default function SettingsScreen() {
  const router = useRouter();
  const { isAuthenticated, signOut } = useAuth();
  const [logoutLoading, setLogoutLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const {
    appTheme,
    highContrastEnabled,
    reduceMotionOverride,
    setHighContrastEnabled,
    setReduceMotionOverride,
    setTextSizePreference,
    setThemePreference,
    textSizePreference,
    themePreference,
  } = useDisplaySettings();
  const styles = useMemo(() => createStyles(appTheme), [appTheme]);

  const handleLogout = async () => {
    setLogoutLoading(true);
    const result = await signOut();
    setLogoutLoading(false);

    if (result.error) {
      Alert.alert("Logout unavailable", cleanUserError(result.error));
      return;
    }

    router.replace("/auth");
  };

  const handleDeleteAccount = () => {
    if (!isAuthenticated) {
      Alert.alert("Delete Account", "Please log in before deleting your account.");
      return;
    }

    Alert.alert(
      "Delete account?",
      "Your public profile will be anonymized as Deleted User. Claims, votes, and evidence stay in Verifact so verification history does not break. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setDeleteLoading(true);
            const result = await deleteCurrentAccount();
            setDeleteLoading(false);

            if (!result.ok) {
              Alert.alert("Delete Account", cleanUserError(result.error ?? "Could not delete account right now."));
              return;
            }

            router.replace("/auth");
          },
        },
      ],
    );
  };

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
          <Ionicons name="chevron-back" size={22} color={appTheme.colors.chipActiveText} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={styles.headerButton} />
      </View>

      <ScrollView contentContainerStyle={styles.content} contentInsetAdjustmentBehavior="automatic" showsVerticalScrollIndicator={false}>
        <Section title="Appearance" styles={styles}>
          <SegmentedControl
            label="Theme"
            options={themeOptions}
            selectedValue={themePreference}
            onChange={setThemePreference}
            styles={styles}
          />
          <SegmentedControl
            label="Font Size"
            options={textSizeOptions}
            selectedValue={textSizePreference}
            onChange={setTextSizePreference}
            styles={styles}
          />
        </Section>

        <Section title="Accessibility" styles={styles}>
          <SettingsToggle
            label="Reduce Motion"
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

        <Section title="Support" styles={styles}>
          <SettingsLink label="Privacy Policy" onPress={() => router.push("/legal/privacy")} styles={styles} />
          <SettingsLink label="Terms" onPress={() => router.push("/legal/terms")} styles={styles} />
          <SettingsLink label="Copyright" onPress={() => router.push("/legal/copyright")} styles={styles} />
          <SettingsLink
            label="Community Guidelines"
            onPress={() => router.push("/legal/community-guidelines")}
            styles={styles}
          />
        </Section>

        <Section title="Account" styles={styles}>
          {/* APPLE GUIDELINE 1.2 — user blocking (NEW) */}
          <SettingsLink
            label="Blocked users"
            onPress={() => router.push("/settings/blocked-users")}
            styles={styles}
          />
          <SettingsLink
            label="Change password"
            onPress={() => router.push("/settings/change-password")}
            styles={styles}
          />
          <SettingsLink
            label={logoutLoading ? "Logging out..." : "Logout"}
            onPress={handleLogout}
            styles={styles}
            disabled={logoutLoading}
          />
          <SettingsLink
            label={deleteLoading ? "Deleting..." : "Delete Account"}
            danger
            onPress={handleDeleteAccount}
            styles={styles}
            disabled={deleteLoading}
          />
        </Section>

        <Section title="About" styles={styles}>
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
        trackColor={{ false: styles.switchTrackOff.color, true: styles.switchTrackOn.color }}
        thumbColor={styles.switchThumb.color}
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
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  styles: ReturnType<typeof createStyles>;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[styles.row, disabled && styles.disabledRow]}
      activeOpacity={0.8}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
    >
      <Text style={[styles.rowLabel, danger && styles.dangerText]}>{label}</Text>
      <Ionicons name="chevron-forward" size={17} color={danger ? styles.dangerText.color : styles.iconColor.color} />
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
      backgroundColor: theme.colors.navy,
      flexDirection: "row",
      justifyContent: "space-between",
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    headerButton: {
      alignItems: "center",
      height: 44,
      justifyContent: "center",
      width: 44,
    },
    headerTitle: {
      color: theme.colors.chipActiveText,
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
      backgroundColor: theme.colors.background,
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
      backgroundColor: theme.colors.primary,
    },
    segmentText: {
      color: theme.colors.subtext,
      fontSize: theme.typography.small.fontSize,
      fontWeight: "500",
    },
    segmentTextSelected: {
      color: theme.colors.chipActiveText,
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
    disabledRow: {
      opacity: 0.55,
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
      color: theme.colors.danger,
    },
    iconColor: {
      color: theme.colors.subtext,
    },
    switchTrackOff: {
      color: theme.colors.disabledBg,
    },
    switchTrackOn: {
      color: theme.colors.primary,
    },
    switchThumb: {
      color: theme.colors.chipActiveText,
    },
  });
}
