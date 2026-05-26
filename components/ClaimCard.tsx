// PHASE 1 STEP 4
import { TouchableOpacity, View, Text, StyleSheet } from "react-native";
import type { Claim, VoteOption } from "../types/claim";
import { StatusBadge } from "./StatusBadge";
import { VoteButtons } from "./VoteButtons";
import { theme } from "../constants/theme";
import { calculateAutomaticVerdict, canUserVote, getTimeRemaining, isVotingOpen } from "../services/claimVoting";

interface ClaimCardProps {
  claim: Claim;
  onPress?: () => void;
  onVote: (claimId: string, vote: VoteOption) => void;
}

export function ClaimCard({ claim, onPress, onVote }: ClaimCardProps) {
  // PHASE 2 STEP 3
  const votingOpen = isVotingOpen(claim);
  const userCanVote = canUserVote(claim);
  const automaticVerdict = votingOpen ? undefined : calculateAutomaticVerdict(claim);
  // PHASE 2 STEP 4
  const evidenceLabel = `${claim.evidence.length} evidence ${claim.evidence.length === 1 ? "link" : "links"}`;

  return (
    <View style={styles.card}>
      <TouchableOpacity onPress={onPress} activeOpacity={0.9} disabled={!onPress}>
        <View style={styles.headerRow}>
          <View style={styles.titleWrapper}>
            <Text style={styles.title}>{claim.title}</Text>
          </View>
          <StatusBadge status={claim.status} />
        </View>

        <Text style={styles.description}>{claim.description}</Text>
        {/* PHASE 2 STEP 2 */}
        {claim.category ? <Text style={styles.category}>{claim.category}</Text> : null}
        <Text style={styles.source} numberOfLines={1}>
          Source: {claim.sourceUrl}
        </Text>
        <Text style={styles.evidenceCount}>{evidenceLabel}</Text>
      </TouchableOpacity>

      <View style={styles.windowRow}>
        <Text style={[styles.windowText, !votingOpen && styles.closedText]}>
          {votingOpen ? `${getTimeRemaining(claim.expiresAt)} remaining` : "Voting closed"}
        </Text>
      </View>

      {!votingOpen && automaticVerdict ? (
        <View style={styles.verdictPanel}>
          <Text style={styles.verdictLabel}>System Verdict</Text>
          <Text style={styles.verdictTitle}>{automaticVerdict.resultLabel}</Text>
          <Text style={styles.verdictReason}>{automaticVerdict.reason}</Text>
        </View>
      ) : null}

      <View style={styles.divider} />

      <View style={styles.voteRow}>
        <View style={styles.voteItem}>
          <Text style={styles.voteValue}>{claim.votesTrue}</Text>
          <Text style={styles.voteLabel}>True</Text>
        </View>
        <View style={styles.dividerVertical} />
        <View style={styles.voteItem}>
          <Text style={styles.voteValue}>{claim.votesFake}</Text>
          <Text style={styles.voteLabel}>Fake</Text>
        </View>
        <View style={styles.dividerVertical} />
        <View style={styles.voteItem}>
          <Text style={styles.voteValue}>{claim.votesUnsure}</Text>
          <Text style={styles.voteLabel}>Not Sure</Text>
        </View>
      </View>

      {votingOpen ? (
        <View style={styles.buttonWrap}>
          <VoteButtons disabled={!userCanVote} userVote={claim.userVote} onVote={(vote) => onVote(claim.id, vote)} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.background,
    borderRadius: theme.radius.md,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.md,
    ...theme.shadows.light,
    borderWidth: 1,
    borderColor: theme.colors.lightBorder,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: theme.spacing.md,
  },
  titleWrapper: {
    flex: 1,
    marginRight: theme.spacing.md,
  },
  title: {
    fontSize: theme.typography.title.fontSize,
    fontWeight: "700",
    color: theme.colors.text,
    lineHeight: theme.typography.title.lineHeight,
  },
  description: {
    fontSize: theme.typography.body.fontSize,
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
    lineHeight: theme.typography.body.lineHeight,
  },
  source: {
    fontSize: theme.typography.small.fontSize,
    color: theme.colors.subtext,
    marginBottom: theme.spacing.sm,
  },
  evidenceCount: {
    color: theme.colors.primary,
    fontSize: theme.typography.small.fontSize,
    fontWeight: "700",
    marginBottom: theme.spacing.md,
  },
  category: {
    alignSelf: "flex-start",
    backgroundColor: theme.colors.card,
    borderColor: theme.colors.lightBorder,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    color: theme.colors.primary,
    fontSize: theme.typography.small.fontSize,
    fontWeight: "700",
    marginBottom: theme.spacing.md,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
  },
  windowRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing.md,
  },
  windowText: {
    flex: 1,
    fontSize: theme.typography.small.fontSize,
    fontWeight: "700",
    color: theme.colors.primary,
  },
  closedText: {
    color: theme.colors.subtext,
  },
  verdictPanel: {
    backgroundColor: theme.colors.card,
    borderColor: theme.colors.lightBorder,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    marginTop: theme.spacing.md,
    padding: theme.spacing.md,
  },
  verdictLabel: {
    color: theme.colors.subtext,
    fontSize: theme.typography.small.fontSize,
    fontWeight: "700",
    marginBottom: theme.spacing.xs,
  },
  verdictTitle: {
    color: theme.colors.text,
    fontSize: theme.typography.body.fontSize,
    fontWeight: "700",
    marginBottom: theme.spacing.xs,
  },
  verdictReason: {
    color: theme.colors.subtext,
    fontSize: theme.typography.small.fontSize,
    lineHeight: theme.typography.small.lineHeight,
  },
  divider: {
    height: 1,
    backgroundColor: theme.colors.lightBorder,
    marginVertical: theme.spacing.md,
  },
  voteRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
  },
  voteItem: {
    alignItems: "center",
    flex: 1,
  },
  voteValue: {
    fontSize: 18,
    fontWeight: "700",
    color: theme.colors.primary,
  },
  voteLabel: {
    fontSize: theme.typography.small.fontSize,
    color: theme.colors.subtext,
    marginTop: theme.spacing.xs,
  },
  dividerVertical: {
    width: 1,
    height: 24,
    backgroundColor: theme.colors.lightBorder,
  },
  buttonWrap: {
    marginTop: theme.spacing.md,
  },
});
