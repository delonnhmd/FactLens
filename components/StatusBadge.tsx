// PHASE 1 STEP 4
// FactLens UI redesign
import { View, Text, StyleSheet } from "react-native";
import type { ClaimStatus } from "../types/claim";
import { theme } from "../constants/theme";

// PHASE 2 STEP 3
const statusConfig: Record<ClaimStatus, { label: string; backgroundColor: string; color: string }> = {
  OPEN: {
    label: "Open",
    backgroundColor: theme.colors.phaseBg,
    color: theme.colors.phaseText,
  },
  VOTING_CLOSED: {
    label: "Voting closed",
    backgroundColor: theme.colors.secondarySurface,
    color: theme.colors.subtext,
  },
  COMMUNITY_TRUE: {
    label: "Community says true",
    backgroundColor: theme.colors.successBg,
    color: theme.colors.success,
  },
  COMMUNITY_FAKE: {
    label: "Community says fake",
    backgroundColor: theme.colors.dangerBg,
    color: theme.colors.danger,
  },
  NEEDS_MORE_EVIDENCE: {
    label: "Needs more evidence",
    backgroundColor: theme.colors.warningBg,
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
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  text: {
    fontSize: 11,
    fontWeight: "500",
  },
});
