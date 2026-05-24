// PHASE 1 STEP 4
import { View, Text, StyleSheet } from "react-native";
import { theme } from "../constants/theme";

interface EmptyStateProps {
  message: string;
}

export function EmptyState({ message }: EmptyStateProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.message}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: theme.spacing.lg,
    alignItems: "center",
  },
  message: {
    fontSize: theme.typography.body.fontSize,
    color: theme.colors.subtext,
    textAlign: "center",
  },
});
