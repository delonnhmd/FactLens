// PHASE 1 STEP 1
import { View, Text, StyleSheet } from "react-native";

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
    padding: 24,
    alignItems: "center",
  },
  message: {
    fontSize: 16,
    color: "#6B7280",
    textAlign: "center",
  },
});
