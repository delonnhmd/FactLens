// PHASE 1 STEP 4
// FactLens UI redesign
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
          color="rgba(255, 255, 255, 0.7)" 
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
    backgroundColor: theme.colors.navy,
    borderBottomWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  content: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: "500",
    color: theme.colors.background,
  },
  subtitle: {
    marginTop: theme.spacing.xs,
    fontSize: 11,
    color: "rgba(255, 255, 255, 0.7)",
  },
  icon: {
    marginLeft: theme.spacing.md,
  },
});

