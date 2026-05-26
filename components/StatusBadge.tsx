// PHASE 1 STEP 4
import { View, Text, StyleSheet } from "react-native";
import type { ClaimStatus } from "../types/claim";
import { theme } from "../constants/theme";

const statusConfig: Record<ClaimStatus, { label: string; backgroundColor: string; color: string }> = {
  pending: {
    label: "Pending",
    backgroundColor: "#E0E7FF",
    color: theme.colors.primary,
  },
  true: {
    label: "True",
    backgroundColor: "#DCFCE7",
    color: theme.colors.success,
  },
  fake: {
    label: "Fake",
    backgroundColor: "#FEE2E2",
    color: theme.colors.danger,
  },
  unsure: {
    label: "Not Sure",
    backgroundColor: "#FEF3C7",
    color: theme.colors.warning,
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
    borderRadius: theme.radius.xl,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
  },
  text: {
    fontSize: theme.typography.small.fontSize,
    fontWeight: "700",
  },
});
