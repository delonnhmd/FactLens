// PHASE 1 STEP 1
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";

export function VoteButtons() {
  return (
    <View style={styles.row}>
      <TouchableOpacity style={[styles.button, styles.primary]} activeOpacity={0.7}>
        <Text style={styles.label}>True</Text>
      </TouchableOpacity>
      <TouchableOpacity style={[styles.button, styles.danger, styles.buttonSpacing]} activeOpacity={0.7}>
        <Text style={styles.label}>Fake</Text>
      </TouchableOpacity>
      <TouchableOpacity style={[styles.button, styles.warning, styles.buttonSpacing]} activeOpacity={0.7}>
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
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  buttonSpacing: {
    marginLeft: 8,
  },
  label: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  primary: {
    backgroundColor: "#2563EB",
  },
  danger: {
    backgroundColor: "#EF4444",
  },
  warning: {
    backgroundColor: "#F59E0B",
  },
});
