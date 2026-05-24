// PHASE 1 STEP 2
import { View, Text, StyleSheet } from "react-native";
import type { ClaimStatus } from "../types/claim";
import { colors } from "../constants/colors";

const statusConfig: Record<ClaimStatus, { label: string; backgroundColor: string; color: string }> = {
  pending: {
    label: "Pending",
    backgroundColor: "#E0E7FF",
    color: colors.primary,
  },
  true: {
    label: "True",
    backgroundColor: "#DCFCE7",
    color: colors.success,
  },
  fake: {
    label: "Fake",
    backgroundColor: "#FEE2E2",
    color: colors.danger,
  },
  unsure: {
    label: "Not Sure",
    backgroundColor: "#FEF3C7",
    color: colors.warning,
  },
};

interface StatusBadgeProps {
  status: ClaimStatus;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const config = statusConfig[status];

  return (
    <View style={[styles.badge, { backgroundColor: config.backgroundColor }]}> 
      <Text style={[styles.text, { color: config.color }]}>{config.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  text: {
    fontSize: 12,
    fontWeight: "700",
  },
});
