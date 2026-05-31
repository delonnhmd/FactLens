// FactLens UI redesign
import { View, Text, StyleSheet } from "react-native";
import { theme } from "../constants/theme";
import type { ClaimStatus } from "../types/claim";

function getVerdictConfig(status: ClaimStatus) {
  if (status === "COMMUNITY_TRUE") {
    return {
      label: "Community says true",
      badge: "True",
      badgeColor: theme.colors.success,
      badgeTextColor: theme.colors.successBg,
    };
  }

  if (status === "COMMUNITY_FAKE") {
    return {
      label: "Community says fake",
      badge: "Fake",
      badgeColor: theme.colors.danger,
      badgeTextColor: theme.colors.dangerBg,
    };
  }

  if (status === "NEEDS_MORE_EVIDENCE") {
    return {
      label: "Needs more evidence",
      badge: "Unsure",
      badgeColor: theme.colors.warning,
      badgeTextColor: theme.colors.warningBg,
    };
  }

  return {
    label: "Pending",
    badge: "Pending",
    badgeColor: theme.colors.warning,
    badgeTextColor: theme.colors.warningBg,
  };
}

interface VerdictBannerProps {
  status: ClaimStatus;
  verdictLabel?: string;
  finalScore: string;
  aiScore: string;
  communityScore: string;
}

export function VerdictBanner({
  status,
  verdictLabel,
  finalScore,
  aiScore,
  communityScore,
}: VerdictBannerProps) {
  const config = getVerdictConfig(status);

  return (
    <View style={styles.banner}>
      <Text style={styles.kicker}>System verdict</Text>
      <View style={styles.verdictRow}>
        <Text style={styles.verdict}>{verdictLabel ?? config.label}</Text>
        <View style={[styles.badge, { backgroundColor: config.badgeColor }]}>
          <Text style={[styles.badgeText, { color: config.badgeTextColor }]}>{config.badge}</Text>
        </View>
      </View>
      <View style={styles.scoreGrid}>
        <View style={styles.scoreCell}>
          <Text style={styles.scoreValue}>{finalScore}</Text>
          <Text style={styles.scoreLabel}>Final score</Text>
        </View>
        <View style={[styles.scoreCell, styles.scoreDivider]}>
          <Text style={styles.scoreValue}>{aiScore}</Text>
          <Text style={styles.scoreLabel}>AI score</Text>
        </View>
        <View style={[styles.scoreCell, styles.scoreDivider]}>
          <Text style={styles.scoreValue}>{communityScore}</Text>
          <Text style={styles.scoreLabel}>Community</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: theme.colors.navy,
    borderTopLeftRadius: theme.radius.md,
    borderTopRightRadius: theme.radius.md,
    paddingHorizontal: 14,
    paddingTop: 14,
  },
  kicker: {
    color: "rgba(255, 255, 255, 0.6)",
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
    color: theme.colors.background,
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
    borderTopColor: "rgba(255, 255, 255, 0.1)",
    borderTopWidth: 0.5,
    flexDirection: "row",
    marginTop: 14,
  },
  scoreCell: {
    flex: 1,
    paddingVertical: 12,
  },
  scoreDivider: {
    borderLeftColor: "rgba(255, 255, 255, 0.1)",
    borderLeftWidth: 0.5,
    paddingLeft: 12,
  },
  scoreValue: {
    color: theme.colors.background,
    fontSize: 18,
    fontWeight: "500",
  },
  scoreLabel: {
    color: "rgba(255, 255, 255, 0.55)",
    fontSize: 10,
    fontWeight: "400",
    marginTop: 2,
  },
});
