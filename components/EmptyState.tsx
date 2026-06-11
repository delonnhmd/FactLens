// PHASE 1 STEP 4
// PHASE 5 STEP 5 PRE-LAUNCH
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAppTheme } from "../hooks/useTheme";
import type { AppTheme } from "../context/DisplaySettingsContext";

interface EmptyStateProps {
  message?: string;
  title?: string;
  actionLabel?: string;
  onActionPress?: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
  actionDisabled?: boolean;
}

export function EmptyState({
  message = "Nothing to show yet.",
  title,
  actionLabel,
  onActionPress,
  icon = "sparkles-outline",
  actionDisabled = false,
}: EmptyStateProps) {
  const appTheme = useAppTheme();
  const styles = createStyles(appTheme);

  return (
    <View style={styles.container}>
      <View style={styles.iconCircle}>
        <Ionicons name={icon} size={22} color={appTheme.colors.ai} />
      </View>
      {title ? <Text style={styles.title}>{title}</Text> : null}
      <Text style={styles.message}>{message}</Text>
      {actionLabel && onActionPress ? (
        <TouchableOpacity
          style={[styles.button, actionDisabled && styles.buttonDisabled]}
          activeOpacity={0.85}
          onPress={onActionPress}
          disabled={actionDisabled}
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
          accessibilityHint={`Activates the ${actionLabel} action`}
          accessibilityState={{ disabled: actionDisabled }}
        >
          <Text style={[styles.buttonText, actionDisabled && styles.buttonTextDisabled]}>{actionLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
  container: {
    alignItems: "center",
    backgroundColor: theme.colors.background,
    borderColor: theme.colors.lightBorder,
    borderRadius: theme.radius.md,
    borderWidth: theme.borderWidth,
    gap: 8,
    padding: theme.spacing.lg,
  },
  iconCircle: {
    alignItems: "center",
    backgroundColor: theme.colors.aiBg,
    borderRadius: 22,
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  title: {
    color: theme.colors.text,
    fontSize: theme.typography.body.fontSize,
    fontWeight: "500",
  },
  message: {
    fontSize: theme.typography.body.fontSize,
    color: theme.colors.subtext,
    textAlign: "center",
  },
  button: {
    backgroundColor: theme.colors.primary,
    borderRadius: 10,
    marginTop: 4,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  buttonDisabled: {
    backgroundColor: theme.colors.disabledBg,
  },
  buttonText: {
    color: theme.colors.chipActiveText,
    fontSize: Math.round(13 * (theme.typography.body.fontSize / 16)),
    fontWeight: "500",
  },
  buttonTextDisabled: {
    color: theme.colors.disabledText,
  },
  });
}
