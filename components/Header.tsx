// PHASE 1 STEP 4
// Verifact UI redesign
import { TouchableOpacity, View, Text, StyleSheet } from "react-native";
import type { ComponentProps } from "react";
import { Ionicons } from "@expo/vector-icons";
import { useAppTheme } from "../hooks/useTheme";
import type { AppTheme } from "../context/DisplaySettingsContext";

interface HeaderProps {
  title: string;
  subtitle?: string;
  rightIcon?: ComponentProps<typeof Ionicons>["name"];
  onRightIconPress?: () => void;
  rightAccessibilityLabel?: string;
  rightAccessibilityHint?: string;
}

export function Header({
  title,
  subtitle,
  rightIcon,
  onRightIconPress,
  rightAccessibilityLabel = "Header action",
  rightAccessibilityHint = "Tap to activate the header action",
}: HeaderProps) {
  const appTheme = useAppTheme();
  const styles = createStyles(appTheme);

  return (
    <View style={styles.container}>
      <View style={styles.actionSlot} />
      <View style={styles.content}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {rightIcon ? (
        <TouchableOpacity
          style={styles.actionSlot}
          activeOpacity={0.75}
          onPress={onRightIconPress}
          accessibilityRole="button"
          accessibilityLabel={rightAccessibilityLabel}
          accessibilityHint={rightAccessibilityHint}
        >
          <Ionicons name={rightIcon} size={22} color="#FFFFFF" />
        </TouchableOpacity>
      ) : (
        <View style={styles.actionSlot} />
      )}
    </View>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
  container: {
    paddingHorizontal: theme.spacing.lg,
    // PHASE 5 STEP 6
    paddingTop: 8,
    paddingBottom: 10,
    backgroundColor: theme.colors.navy,
    borderBottomWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  content: {
    flex: 1,
    alignItems: "center",
  },
  title: {
    fontSize: Math.max(16, Math.round(16 * (theme.typography.body.fontSize / 16))),
    fontWeight: "500",
    color: "#FFFFFF",
    textAlign: "center",
  },
  subtitle: {
    marginTop: theme.spacing.xs,
    fontSize: Math.max(11, Math.round(11 * (theme.typography.body.fontSize / 16))),
    color: "#EAF0FF",
  },
  actionSlot: {
    alignItems: "center",
    height: 44,
    justifyContent: "center",
    minWidth: 44,
  },
  });
}
