// PHASE 1 STEP 4
// Verifact UI redesign
import { View, Text, StyleSheet } from "react-native";
import { useMemo } from "react";
import type { ClaimStatus } from "../types/claim";
import type { AppTheme } from "../context/DisplaySettingsContext";
import { useAppTheme } from "../hooks/useTheme";

// PHASE 2 STEP 3
interface StatusBadgeProps {
  status: ClaimStatus;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const appTheme = useAppTheme();
  const styles = useMemo(() => createStyles(), []);
  const statusConfig = getStatusConfig(appTheme);
  const config = statusConfig[status];

  return (
    <View style={[styles.badge, { backgroundColor: config.backgroundColor }]}>
      <Text style={[styles.text, { color: config.color }]}>{config.label}</Text>
    </View>
  );
}

function getStatusConfig(theme: AppTheme): Record<ClaimStatus, { label: string; backgroundColor: string; color: string }> {
  return {
    // PHASE 4 STEP 26
    PENDING: {
      label: "Pending",
      backgroundColor: theme.colors.secondarySurface,
      color: theme.colors.subtext,
    },
    ACTIVE: {
      label: "Active",
      backgroundColor: theme.colors.phaseBg,
      color: theme.colors.phaseText,
    },
    EARLY_VERDICT: {
      label: "Early verdict",
      backgroundColor: theme.colors.warningBg,
      color: theme.colors.warningText,
    },
    FINALIZED_TRUE: {
      label: "Finalized true",
      backgroundColor: theme.colors.successBg,
      color: theme.colors.success,
    },
    FINALIZED_FAKE: {
      label: "Finalized fake",
      backgroundColor: theme.colors.dangerBg,
      color: theme.colors.danger,
    },
    INSUFFICIENT_DATA: {
      label: "Insufficient data",
      backgroundColor: theme.colors.warningBg,
      color: theme.colors.warningText,
    },
    LOCKED: {
      label: "Locked",
      backgroundColor: theme.colors.secondarySurface,
      color: theme.colors.subtext,
    },
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
      color: theme.colors.warningText,
    },
  };
}

function createStyles() {
  return StyleSheet.create({
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
}
