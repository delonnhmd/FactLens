// PHASE 1 STEP 4
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { theme } from "../constants/theme";

export function VoteButtons() {
  return (
    <View style={styles.row}>
      <TouchableOpacity style={[styles.button, styles.primary]} activeOpacity={0.8}>
        <Text style={styles.label}>True</Text>
      </TouchableOpacity>
      <TouchableOpacity style={[styles.button, styles.danger, styles.buttonSpacing]} activeOpacity={0.8}>
        <Text style={styles.label}>Fake</Text>
      </TouchableOpacity>
      <TouchableOpacity style={[styles.button, styles.warning, styles.buttonSpacing]} activeOpacity={0.8}>
        <Text style={styles.label}>Not Sure</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  button: {
    flex: 1,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.radius.lg,
    alignItems: "center",
  },
  buttonSpacing: {
    marginLeft: theme.spacing.sm,
  },
  label: {
    color: theme.colors.background,
    fontWeight: "700",
    fontSize: theme.typography.body.fontSize,
  },
  primary: {
    backgroundColor: theme.colors.primary,
  },
  danger: {
    backgroundColor: theme.colors.danger,
  },
  warning: {
    backgroundColor: theme.colors.warning,
  },
});
