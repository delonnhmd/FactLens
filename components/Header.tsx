// PHASE 1 STEP 4
// Verifact UI redesign
import { TouchableOpacity, View, Text, StyleSheet } from "react-native";
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
      <View style={styles.actionSlot} />
      <View style={styles.content}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {rightIcon ? (
        <TouchableOpacity style={styles.actionSlot} activeOpacity={0.75} onPress={onRightIconPress}>
          <Ionicons name={rightIcon} size={22} color="rgba(255, 255, 255, 0.7)" />
        </TouchableOpacity>
      ) : (
        <View style={styles.actionSlot} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
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
    fontSize: 16,
    fontWeight: "500",
    color: theme.colors.background,
    textAlign: "center",
  },
  subtitle: {
    marginTop: theme.spacing.xs,
    fontSize: 11,
    color: "rgba(255, 255, 255, 0.7)",
  },
  actionSlot: {
    alignItems: "flex-end",
    justifyContent: "center",
    minWidth: 32,
  },
});

