// Verifact UI redesign
import { View, Text, StyleSheet } from "react-native";
import { useMemo } from "react";
import { Ionicons } from "@expo/vector-icons";
import type { AppTheme } from "../context/DisplaySettingsContext";
import { useAppTheme } from "../hooks/useTheme";
import type { ClaimStatus } from "../types/claim";

function getVerdictConfig(status: ClaimStatus, theme: AppTheme) {
  if (status === "FINALIZED_TRUE" || status === "COMMUNITY_TRUE") {
    return {
      label: "Finalized true",
      badge: "True",
      badgeColor: theme.colors.success,
      badgeTextColor: theme.colors.successBg,
    };
  }

  if (status === "FINALIZED_FAKE" || status === "COMMUNITY_FAKE") {
    return {
      label: "Finalized fake",
      badge: "Fake",
      badgeColor: theme.colors.danger,
      badgeTextColor: theme.colors.dangerBg,
    };
  }

  if (status === "INSUFFICIENT_DATA") {
    return {
      label: "Insufficient data",
      badge: "Insufficient",
      badgeColor: theme.colors.warningBg,
      badgeTextColor: theme.colors.warningText,
    };
  }

  if (status === "NEEDS_MORE_EVIDENCE") {
    return {
      label: "Needs more evidence",
      badge: "Unsure",
      badgeColor: theme.colors.warningBg,
      badgeTextColor: theme.colors.warningText,
    };
  }

  if (status === "EARLY_VERDICT") {
    return {
      label: "Early verdict candidate",
      badge: "Early",
      badgeColor: theme.colors.warningBg,
      badgeTextColor: theme.colors.warningText,
    };
  }

  if (status === "LOCKED" || status === "VOTING_CLOSED") {
    // 24H MODEL: voting has ended and the server sweep (every ~10 min) is
    // about to publish the verdict — a brief transition, not a dead zone.
    return {
      label: "Finalizing verdict…",
      badge: "Finalizing",
      badgeColor: theme.colors.warningBg,
      badgeTextColor: theme.colors.warningText,
    };
  }

  return {
    label: "Pending",
    badge: "Pending",
    badgeColor: theme.colors.warningBg,
    badgeTextColor: theme.colors.warningText,
  };
}

interface VerdictBannerProps {
  status: ClaimStatus;
  verdictLabel?: string;
  // PHASE 4 STEP 26
  currentPhase: number;
  timeLabel: string;
  minVotesLabel: string;
  earlyVerdictFired: boolean;
}

export function VerdictBanner({
  status,
  verdictLabel,
  currentPhase,
  timeLabel,
  minVotesLabel,
  earlyVerdictFired,
}: VerdictBannerProps) {
  const appTheme = useAppTheme();
  const styles = useMemo(() => createStyles(appTheme), [appTheme]);
  const config = getVerdictConfig(status, appTheme);
  const verdictIconName =
    status === "FINALIZED_TRUE" || status === "COMMUNITY_TRUE"
      ? "checkmark-circle-outline"
      : status === "FINALIZED_FAKE" || status === "COMMUNITY_FAKE"
      ? "close-circle-outline"
      : "help-circle-outline";

  return (
    <View style={styles.banner}>
      <Text style={styles.kicker}>System verdict</Text>
      <View style={styles.verdictRow}>
        <Text style={styles.verdict}>{verdictLabel ?? config.label}</Text>
        <View
          style={[styles.badge, { backgroundColor: config.badgeColor }]}
          accessible
          accessibilityRole="text"
          accessibilityLabel={`Verdict: ${config.badge}`}
        >
          <Ionicons name={verdictIconName} size={12} color={config.badgeTextColor} />
          <Text style={[styles.badgeText, { color: config.badgeTextColor }]}>{config.badge}</Text>
        </View>
      </View>
      <View style={styles.scoreGrid}>
        <View style={styles.scoreCell}>
          <Text style={styles.scoreValue}>Phase {currentPhase}</Text>
          <Text style={styles.scoreLabel}>Current phase</Text>
        </View>
        <View style={[styles.scoreCell, styles.scoreDivider]}>
          <Text style={styles.scoreValue}>{timeLabel}</Text>
          <Text style={styles.scoreLabel}>Time remaining</Text>
        </View>
        <View style={[styles.scoreCell, styles.scoreDivider]}>
          <Text style={styles.scoreValue}>{minVotesLabel}</Text>
          <Text style={styles.scoreLabel}>{earlyVerdictFired ? "Early verdict fired" : "Minimum votes"}</Text>
        </View>
      </View>
    </View>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
  banner: {
    backgroundColor: theme.colors.navy,
    borderTopLeftRadius: theme.radius.md,
    borderTopRightRadius: theme.radius.md,
    paddingHorizontal: 14,
    paddingTop: 14,
  },
  kicker: {
    color: theme.colors.bannerSubtitle,
    fontSize: 11,
    fontWeight: "500",
    letterSpacing: 0,
    textTransform: "uppercase",
  },
  verdictRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    justifyContent: "space-between",
    marginTop: 5,
  },
  verdict: {
    color: theme.colors.chipActiveText,
    flex: 1,
    fontSize: 20,
    fontWeight: "500",
  },
  badge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "500",
  },
  scoreGrid: {
    borderTopColor: theme.colors.border,
    borderTopWidth: 0.5,
    flexDirection: "row",
    marginTop: 14,
  },
  scoreCell: {
    flex: 1,
    paddingVertical: 12,
  },
  scoreDivider: {
    borderLeftColor: theme.colors.border,
    borderLeftWidth: 0.5,
    paddingLeft: 12,
  },
  scoreValue: {
    color: theme.colors.chipActiveText,
    fontSize: 18,
    fontWeight: "500",
  },
  scoreLabel: {
    color: theme.colors.bannerSubtitle,
    fontSize: 10,
    fontWeight: "400",
    marginTop: 2,
  },
  });
}
