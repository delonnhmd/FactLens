// PHASE 1 STEP 4
// PHASE 5 STEP 5 PRE-LAUNCH
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../constants/theme";

interface EmptyStateProps {
  message?: string;
  title?: string;
  actionLabel?: string;
  onActionPress?: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
}

export function EmptyState({
  message = "Nothing to show yet.",
  title,
  actionLabel,
  onActionPress,
  icon = "sparkles-outline",
}: EmptyStateProps) {
  return (
    <View style={styles.container}>
      <View style={styles.iconCircle}>
        <Ionicons name={icon} size={22} color={theme.colors.ai} />
      </View>
      {title ? <Text style={styles.title}>{title}</Text> : null}
      <Text style={styles.message}>{message}</Text>
      {actionLabel && onActionPress ? (
        <TouchableOpacity style={styles.button} activeOpacity={0.85} onPress={onActionPress}>
          <Text style={styles.buttonText}>{actionLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    backgroundColor: theme.colors.background,
    borderColor: theme.colors.lightBorder,
    borderRadius: theme.radius.md,
    borderWidth: 0.5,
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
    fontSize: 16,
    fontWeight: "500",
  },
  message: {
    fontSize: theme.typography.body.fontSize,
    color: theme.colors.subtext,
    textAlign: "center",
  },
  button: {
    backgroundColor: theme.colors.navy,
    borderRadius: theme.radius.sm,
    marginTop: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  buttonText: {
    color: theme.colors.background,
    fontSize: 13,
    fontWeight: "500",
  },
});
