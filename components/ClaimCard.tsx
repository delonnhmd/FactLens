// PHASE 1 STEP 4
import { useState } from "react";
import { TouchableOpacity, View, Text, StyleSheet, TextInput } from "react-native";
import type { Claim, ReportReason, VoteOption } from "../types/claim";
import { StatusBadge } from "./StatusBadge";
import { SourceQualityBadge } from "./SourceQualityBadge";
import { VoteButtons } from "./VoteButtons";
import { reportReasons } from "../constants/reportReasons";
import { theme } from "../constants/theme";
import { calculateAutomaticVerdict, canUserVote, getTimeRemaining, isVotingOpen } from "../services/claimVoting";
import { getSourceQuality } from "../services/sourceQuality";

interface ClaimCardProps {
  claim: Claim;
  onPress?: () => void;
  onVote: (claimId: string, vote: VoteOption) => void;
  onReport: (claimId: string, reason: ReportReason, note: string) => void;
}

export function ClaimCard({ claim, onPress, onVote, onReport }: ClaimCardProps) {
  // PHASE 2 STEP 6
  const [showReportForm, setShowReportForm] = useState(false);
  const [selectedReportReason, setSelectedReportReason] = useState<ReportReason>("Spam");
  const [reportNote, setReportNote] = useState("");
  const [reportSuccess, setReportSuccess] = useState(false);
  // PHASE 2 STEP 3
  const votingOpen = isVotingOpen(claim);
  const userCanVote = canUserVote(claim);
  const automaticVerdict = votingOpen ? undefined : calculateAutomaticVerdict(claim);
  // PHASE 2 STEP 4
  const evidenceLabel = `${claim.evidence.length} evidence ${claim.evidence.length === 1 ? "link" : "links"}`;
  // PHASE 2 STEP 5
  const sourceQuality = getSourceQuality(claim.sourceUrl);

  const handleSubmitReport = () => {
    onReport(claim.id, selectedReportReason, reportNote);
    setReportNote("");
    setSelectedReportReason("Spam");
    setShowReportForm(false);
    setReportSuccess(true);
  };

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
        <View style={styles.qualityRow}>
          <Text style={styles.qualityLabel}>Source Quality:</Text>
          <SourceQualityBadge quality={sourceQuality} />
        </View>
        <Text style={styles.evidenceCount}>{evidenceLabel}</Text>
        {claim.reportCount > 0 || claim.isFlagged ? (
          <View style={styles.reportMetaRow}>
            {claim.reportCount > 0 ? (
              <Text style={styles.reportCount}>
                {claim.reportCount} {claim.reportCount === 1 ? "report" : "reports"}
              </Text>
            ) : null}
            {claim.isFlagged ? <Text style={styles.flaggedBadge}>Flagged for Review</Text> : null}
          </View>
        ) : null}
      </TouchableOpacity>

      <View style={styles.reportActionRow}>
        <TouchableOpacity
          style={styles.reportButton}
          activeOpacity={0.8}
          onPress={() => {
            setShowReportForm((currentValue) => !currentValue);
            setReportSuccess(false);
          }}
        >
          <Text style={styles.reportButtonText}>Report</Text>
        </TouchableOpacity>
        {reportSuccess ? <Text style={styles.reportSuccess}>Report submitted.</Text> : null}
      </View>

      {showReportForm ? (
        <View style={styles.reportPanel}>
          <Text style={styles.reportPanelTitle}>Report claim</Text>
          <View style={styles.reasonGrid}>
            {reportReasons.map((reason) => {
              const selected = selectedReportReason === reason;

              return (
                <TouchableOpacity
                  key={reason}
                  style={[styles.reasonButton, selected && styles.reasonButtonSelected]}
                  activeOpacity={0.8}
                  onPress={() => setSelectedReportReason(reason)}
                >
                  <Text style={[styles.reasonButtonText, selected && styles.reasonButtonTextSelected]}>{reason}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <TextInput
            value={reportNote}
            onChangeText={setReportNote}
            placeholder="Optional note"
            placeholderTextColor={theme.colors.muted}
            style={styles.reportInput}
            multiline
          />
          <TouchableOpacity style={styles.submitReportButton} activeOpacity={0.8} onPress={handleSubmitReport}>
            <Text style={styles.submitReportButtonText}>Submit report</Text>
          </TouchableOpacity>
        </View>
      ) : null}

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
  reportMetaRow: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  reportCount: {
    color: theme.colors.subtext,
    fontSize: theme.typography.small.fontSize,
    fontWeight: "700",
  },
  flaggedBadge: {
    backgroundColor: "#FEE2E2",
    borderColor: "#FECACA",
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    color: theme.colors.danger,
    fontSize: theme.typography.small.fontSize,
    fontWeight: "700",
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
  },
  reportActionRow: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  reportButton: {
    borderColor: theme.colors.border,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  reportButtonText: {
    color: theme.colors.subtext,
    fontSize: theme.typography.small.fontSize,
    fontWeight: "700",
  },
  reportSuccess: {
    color: theme.colors.success,
    fontSize: theme.typography.small.fontSize,
    fontWeight: "700",
  },
  reportPanel: {
    backgroundColor: theme.colors.card,
    borderColor: theme.colors.lightBorder,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    gap: theme.spacing.md,
    marginBottom: theme.spacing.md,
    padding: theme.spacing.md,
  },
  reportPanelTitle: {
    color: theme.colors.text,
    fontSize: theme.typography.body.fontSize,
    fontWeight: "700",
  },
  reasonGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.sm,
  },
  reasonButton: {
    borderColor: theme.colors.border,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  reasonButtonSelected: {
    backgroundColor: "#E0E7FF",
    borderColor: theme.colors.primary,
  },
  reasonButtonText: {
    color: theme.colors.subtext,
    fontSize: theme.typography.small.fontSize,
    fontWeight: "700",
  },
  reasonButtonTextSelected: {
    color: theme.colors.primary,
  },
  reportInput: {
    backgroundColor: theme.colors.background,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    color: theme.colors.text,
    fontSize: theme.typography.body.fontSize,
    minHeight: 72,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    textAlignVertical: "top",
  },
  submitReportButton: {
    alignItems: "center",
    backgroundColor: theme.colors.danger,
    borderRadius: theme.radius.sm,
    paddingVertical: theme.spacing.md,
  },
  submitReportButtonText: {
    color: theme.colors.background,
    fontSize: theme.typography.body.fontSize,
    fontWeight: "700",
  },
  qualityRow: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
  },
  qualityLabel: {
    color: theme.colors.subtext,
    fontSize: theme.typography.small.fontSize,
    fontWeight: "700",
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
