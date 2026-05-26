// PHASE 1 STEP 4
import { View, Text, StyleSheet } from "react-native";
import type { ClaimStatus } from "../types/claim";
import { theme } from "../constants/theme";

// PHASE 2 STEP 3
const statusConfig: Record<ClaimStatus, { label: string; backgroundColor: string; color: string }> = {
  OPEN: {
    label: "Open",
    backgroundColor: "#E0E7FF",
    color: theme.colors.primary,
  },
  VOTING_CLOSED: {
    label: "Voting Closed",
    backgroundColor: "#F3F4F6",
    color: theme.colors.subtext,
  },
  COMMUNITY_TRUE: {
    label: "Community Says True",
    backgroundColor: "#DCFCE7",
    color: theme.colors.success,
  },
  COMMUNITY_FAKE: {
    label: "Community Says Fake",
    backgroundColor: "#FEE2E2",
    color: theme.colors.danger,
  },
  NEEDS_MORE_EVIDENCE: {
    label: "Needs More Evidence",
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
    borderRadius: theme.radius.sm,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
  },
  text: {
    fontSize: theme.typography.small.fontSize,
    fontWeight: "700",
  },
});
