// PHASE 1 STEP 4
import { View, Text, StyleSheet } from "react-native";
import type { ComponentProps } from "react";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../constants/theme";

interface HeaderProps {
  title: string;
  subtitle?: string;
  rightIcon?: ComponentProps<typeof Ionicons>["name"];
  onRightIconPress?: () => void;
}

export function Header({ title, subtitle, rightIcon, onRightIconPress }: HeaderProps) {
  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {rightIcon ? (
        <Ionicons 
          name={rightIcon} 
          size={24} 
          color={theme.colors.primary} 
          onPress={onRightIconPress}
          style={styles.icon}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    backgroundColor: theme.colors.background,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  content: {
    flex: 1,
  },
  title: {
    fontSize: theme.typography.largeTitle.fontSize,
    fontWeight: theme.typography.largeTitle.fontWeight,
    color: theme.colors.text,
  },
  subtitle: {
    marginTop: theme.spacing.xs,
    fontSize: theme.typography.small.fontSize,
    color: theme.colors.subtext,
  },
  icon: {
    marginLeft: theme.spacing.md,
  },
});

