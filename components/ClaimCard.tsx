// PHASE 1 STEP 4
// PHASE 3 STEP 28
// PHASE 3 STEP 32
// PHASE 4 STEP 7
// PHASE 4 STEP 8
// PHASE 4 STEP 9
import { memo, useCallback, useState } from "react";
import { Alert, Image, TouchableOpacity, View, Text, StyleSheet, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { Claim, ReportReason, VoteOption } from "../types/claim";
import { StatusBadge } from "./StatusBadge";
import { SourceQualityBadge } from "./SourceQualityBadge";
import { VoteButtons, getVoteOptionLabel } from "./VoteButtons";
import { AiCheckBadge } from "./AiCheckBadge";
import { PhaseStatusRow } from "./PhaseStatusRow";
import { VoteBreakdownBars } from "./VoteBreakdownBars";
import { theme } from "../constants/theme";
import { useAuth } from "../context/AuthContext";
import { calculateAutomaticVerdict, getTimeRemaining, isVotingOpen } from "../services/claimVoting";
import { formatSourceCredibilityScore, getSourceCredibilityLabel, getSourceQuality } from "../services/sourceQuality";
import { getVoteAcceptUntil } from "../utils/verificationTiming";

// PHASE 3 STEP 10
const verdictLabels = {
  COMMUNITY_TRUE: "Community says true",
  COMMUNITY_FAKE: "Community says fake",
  NEEDS_MORE_EVIDENCE: "Needs more evidence",
};

const compactReportReasons: Array<{ label: string; value: ReportReason }> = [
  { label: "Spam", value: "Spam" },
  { label: "Fake source", value: "Fake source" },
  { label: "Misleading", value: "Misleading title" },
  { label: "Duplicate", value: "Duplicate claim" },
  { label: "Abuse", value: "Harassment or abuse" },
];

// PHASE 2 STEP 9
function getRelativeTime(createdAt: string): string {
  const diffMs = Date.now() - new Date(createdAt).getTime();
  const diffMinutes = Math.max(0, Math.floor(diffMs / (60 * 1000)));

  if (diffMinutes < 1) {
    return "Just now";
  }

  if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  }

  const diffHours = Math.floor(diffMinutes / 60);

  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

// PHASE 3 STEP 17
function formatPercent(value: number | null | undefined): string {
  const normalized = value === null || value === undefined ? 0.5 : value > 1 ? value / 100 : value;
  return `${Math.round(normalized * 100)}%`;
}

function formatSourceQuality(value: string | null | undefined): string {
  return getSourceCredibilityLabel(value);
}

// PHASE 4 STEP 7
// PHASE 4 STEP 8
function formatClaimType(value: string | null | undefined): string {
  if (!value) {
    return "Unclear";
  }

  return value
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

interface ClaimCardProps {
  claim: Claim;
  onPress?: () => void;
  // PHASE 3 STEP 20D
  onVote: (claimId: string, vote: VoteOption) => void | string | Promise<void | string>;
  // PHASE 3 STEP 6
  onReport: (claimId: string, reason: ReportReason, note: string) => void | Promise<void>;
}

function ClaimCardComponent({ claim, onPress, onVote, onReport }: ClaimCardProps) {
  // PHASE 3 STEP 4
  const { isAuthenticated, isVerified } = useAuth();
  // PHASE 2 STEP 6
  const [selectedReportReason, setSelectedReportReason] = useState<ReportReason>("Spam");
  const [reportSuccess, setReportSuccess] = useState(false);
  // PHASE 3 STEP 6
  const [reportError, setReportError] = useState("");
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [voteError, setVoteError] = useState("");
  // PHASE 3 STEP 20
  const [voteSuccess, setVoteSuccess] = useState("");
  // PHASE 2 STEP 3
  const votingOpen = claim.status === "OPEN" && isVotingOpen(claim);
  // PHASE 3 STEP 22
  const voteWindowClosesAt = getVoteAcceptUntil(claim);
  // PHASE 3 STEP 22
  const voteDisabled = !votingOpen || !isAuthenticated || !isVerified || Boolean(claim.userVote);
  const automaticVerdict = !votingOpen && claim.status !== "VOTING_CLOSED" ? calculateAutomaticVerdict(claim) : undefined;
  // PHASE 3 STEP 5
  const evidenceCount = claim.evidenceCount ?? claim.evidence.length;
  const evidenceLabel = `${evidenceCount} evidence ${evidenceCount === 1 ? "link" : "links"}`;
  // PHASE 2 STEP 5
  const sourceQuality = getSourceQuality(claim.sourceUrl);
  // PHASE 2 STEP 10
  // PHASE 3 STEP 32
  const totalVotes = claim.totalVotes;
  // PHASE 3 STEP 10
  const finalTotalVotes = claim.totalVotes;
  const verdictTitle =
    claim.status === "COMMUNITY_TRUE" ||
    claim.status === "COMMUNITY_FAKE" ||
    claim.status === "NEEDS_MORE_EVIDENCE"
      ? verdictLabels[claim.status]
      : automaticVerdict?.resultLabel;
  const verdictReason = claim.verdictReason ?? automaticVerdict?.reason;
  // PHASE 3 STEP 8
  const mediaUrl = claim.media.youtubeUrl ?? claim.media.videoUrl ?? null;
  const mediaPlatform = claim.media.videoPlatform ?? (claim.media.youtubeUrl ? "YouTube" : mediaUrl ? "Video Link" : null);
  const aiSummary =
    claim.aiCheck.sourceNotes ??
    claim.aiSummary ??
    claim.aiCheck.reason ??
    "AI pre-check is pending. Community voting and evidence are still needed.";
  // PHASE 4 STEP 7
  const isNotFactCheckable = claim.aiCheck.status === "NOT_FACT_CHECKABLE";
  // PHASE 4 STEP 9
  const sourceNeedsEvidence = typeof claim.sourceScore === "number" && claim.sourceScore < 50;

  // PHASE 3 STEP 6
  const handleSubmitReport = useCallback(async () => {
    setReportError("");
    setReportSubmitting(true);

    try {
      await onReport(claim.id, selectedReportReason, "");
      setSelectedReportReason("Spam");
      setReportSuccess(true);
    } catch (error) {
      setReportError(error instanceof Error ? error.message : "We could not save this report. Please try again.");
    } finally {
      setReportSubmitting(false);
    }
  }, [claim.id, onReport, selectedReportReason]);

  const handleVote = useCallback(async (vote: VoteOption) => {
    setVoteError("");
    setVoteSuccess("");

    try {
      const message = await onVote(claim.id, vote);
      setVoteSuccess(typeof message === "string" ? message : "Vote saved.");
    } catch (error) {
      setVoteError(error instanceof Error ? error.message : "We could not save your vote. Please try again.");
    }
  }, [claim.id, onVote]);

  const voteMessage = !votingOpen
    ? ""
    : !isAuthenticated
      ? "Please log in to vote."
        : !isVerified
          ? "Please verify your email to vote."
        : claim.userVote
          ? "You already voted on this post."
          : "Choose one option before voting closes.";
  const phaseLabel = claim.phase4Locked
    ? "Phase 4 · Locked"
    : `Phase ${claim.currentPhase} · ${votingOpen ? "Voting" : "Locking"}`;
  const timeLabel = votingOpen ? `${getTimeRemaining(voteWindowClosesAt)} remaining` : "Voting closed";

  return (
    <View style={styles.card}>
      <TouchableOpacity onPress={onPress} activeOpacity={0.9} disabled={!onPress}>
        <View style={styles.body}>
          <View style={styles.authorRow}>
            <Text style={styles.authorName}>{claim.authorDisplayName}</Text>
            {claim.authorVerified ? <Text style={styles.verifiedBadge}>Verified</Text> : null}
            <Text style={styles.authorMeta}>
              @{claim.authorUsername} · {getRelativeTime(claim.createdAt)}
            </Text>
          </View>

          <View style={styles.titleRowCompact}>
            <Text style={styles.title}>{claim.title}</Text>
            <StatusBadge status={claim.status} />
          </View>

          <Text style={styles.description} numberOfLines={3}>
            {claim.description}
          </Text>

          {claim.media.imageUrl ? (
            <Image source={{ uri: claim.media.imageUrl }} style={styles.claimImage} resizeMode="cover" />
          ) : null}

          {mediaUrl && mediaPlatform ? (
            <View style={styles.videoPreview}>
              <View style={styles.videoPreviewHeader}>
                <Text style={styles.videoPlatformBadge}>{mediaPlatform}</Text>
                <Text style={styles.videoPreviewText} numberOfLines={1}>
                  {mediaUrl}
                </Text>
              </View>
              {claim.media.youtubeThumbnailUrl ? (
                <View style={styles.thumbnailWrap}>
                  <Image
                    source={{ uri: claim.media.youtubeThumbnailUrl }}
                    style={styles.videoThumbnail}
                    resizeMode="cover"
                  />
                  <View style={styles.playOverlay}>
                    <Ionicons name="play" size={22} color={theme.colors.background} />
                  </View>
                </View>
              ) : (
                <View style={styles.videoLinkBox}>
                  <Ionicons name="play-circle-outline" size={22} color={theme.colors.primary} />
                  <Text style={styles.videoLinkBoxText}>{mediaPlatform} attached</Text>
                </View>
              )}
            </View>
          ) : null}

          <View style={styles.metaWrap}>
            {claim.category ? <Text style={styles.category}>{claim.category}</Text> : null}
            <SourceQualityBadge quality={sourceQuality} />
            <AiCheckBadge status={claim.aiCheck.status} />
            <Text style={styles.claimTypeBadge}>{formatClaimType(claim.claimType)}</Text>
            <Text style={styles.evidencePill}>{evidenceLabel}</Text>
            {claim.isFlagged ? <Text style={styles.flaggedBadge}>Flagged for review</Text> : null}
          </View>

          <View style={styles.sourceRow}>
            <Ionicons name="link-outline" size={13} color={theme.colors.link} />
            <Text style={styles.source} numberOfLines={1}>
              {claim.sourceUrl}
            </Text>
          </View>
          <View style={styles.aiSignalPanel}>
            <Text style={styles.aiSignalText}>
              AI confidence {formatPercent(claim.aiCheck.confidence)} - Source quality: {formatSourceQuality(claim.sourceQuality)}
            </Text>
            <Text style={styles.aiSignalText}>Source score: {formatSourceCredibilityScore(claim.sourceScore)}</Text>
            <Text style={styles.aiSignalText}>Source domain: {claim.sourceDomain || "Pending"}</Text>
            <Text style={styles.aiSignalText}>Political lean: {claim.sourceLean || sourceQuality.lean || "Unknown"}</Text>
            <Text style={styles.aiSignalText} numberOfLines={2}>
              Reason: {claim.sourceReason || "Source score pending."}
            </Text>
            {sourceNeedsEvidence ? (
              <Text style={styles.sourceWarning}>Source needs stronger supporting evidence.</Text>
            ) : null}
            <Text style={styles.aiSignalText}>Claim type: {formatClaimType(claim.claimType)}</Text>
            <Text style={styles.aiSignalText} numberOfLines={2}>{aiSummary}</Text>
            {claim.redFlags.length > 0 ? (
              <Text style={styles.aiRedFlags} numberOfLines={2}>Red flags: {claim.redFlags.join(", ")}</Text>
            ) : null}
            {isNotFactCheckable ? (
              <Text style={styles.notFactCheckableWarning}>
                This appears to be an opinion or non-factual post. FactLens cannot verify it as True or Fake.
              </Text>
            ) : null}
            <Text style={styles.aiDisclaimer}>
              AI pre-check is only a risk signal. Community voting decides the final result.
            </Text>
          </View>
        </View>
      </TouchableOpacity>

      <PhaseStatusRow timeLabel={timeLabel} phaseLabel={phaseLabel} />

      <View style={styles.scorePreviewRow}>
        <Text style={styles.scorePreviewText}>{claim.mode === "test" ? "Test mode" : "Production mode"}</Text>
        <Text style={styles.scorePreviewText}>Final {formatPercent(claim.finalScore)}</Text>
        <Text style={styles.scorePreviewText}>
          Min votes {finalTotalVotes}/{claim.minVotesRequired}
        </Text>
      </View>

      <VoteBreakdownBars
        votesTrue={claim.votesTrue}
        votesFake={claim.votesFake}
        votesUnsure={claim.votesUnsure}
        totalVotes={totalVotes}
      />

      {!votingOpen && verdictTitle ? (
        <View style={styles.verdictPanel}>
          <Text style={styles.verdictLabel}>System verdict</Text>
          <Text style={styles.verdictTitle}>{verdictTitle}</Text>
          {verdictReason ? <Text style={styles.verdictReason}>{verdictReason}</Text> : null}
        </View>
      ) : null}

      {votingOpen ? (
        <View style={styles.buttonWrap}>
          {claim.userVote ? (
            <Text style={styles.userVoteText}>You voted: {getVoteOptionLabel(claim.userVote)}</Text>
          ) : null}
          <VoteButtons
            disabled={voteDisabled}
            selectedVote={claim.userVote}
            message={voteMessage}
            onVote={handleVote}
          />
          {voteSuccess ? <Text style={styles.voteSuccess}>{voteSuccess}</Text> : null}
          {voteError ? <Text style={styles.voteError}>{voteError}</Text> : null}
        </View>
      ) : null}

      <View style={styles.reportRowCompact}>
        <Text style={styles.reportInlineLabel}>Flag as</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.reportChipRow}
          style={styles.reportChipScroller}
        >
          {compactReportReasons.map((reason) => {
            const selected = selectedReportReason === reason.value;

            return (
              <TouchableOpacity
                key={reason.value}
                style={[styles.reportChip, selected && styles.reportChipSelected]}
                activeOpacity={0.8}
                onPress={() => {
                  setSelectedReportReason(reason.value);
                  setReportSuccess(false);
                  setReportError("");
                }}
              >
                <Text style={[styles.reportChipText, selected && styles.reportChipTextSelected]}>{reason.label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
        <TouchableOpacity
          style={[styles.reportIconButton, reportSubmitting && styles.disabledButton]}
          activeOpacity={0.8}
          disabled={reportSubmitting}
          onPress={handleSubmitReport}
        >
          <Ionicons name="flag-outline" size={14} color={theme.colors.background} />
        </TouchableOpacity>
      </View>
      {claim.reportCount > 0 ? (
        <Text style={styles.reportCountText}>
          {claim.reportCount} {claim.reportCount === 1 ? "report" : "reports"}
        </Text>
      ) : null}
      {reportSuccess ? <Text style={styles.reportSuccess}>Report submitted.</Text> : null}
      {reportError ? <Text style={styles.reportError}>{reportError}</Text> : null}

      <View style={styles.actionRow}>
        <TouchableOpacity
          style={styles.actionButton}
          activeOpacity={0.8}
          disabled={!onPress}
          onPress={onPress}
        >
          <Ionicons name="chatbubble-outline" size={15} color={theme.colors.subtext} />
          <Text style={styles.actionText}>Reply</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, styles.actionDivider]}
          activeOpacity={0.8}
          onPress={() => Alert.alert("Repost will be added later.")}
        >
          <Ionicons name="repeat-outline" size={15} color={theme.colors.subtext} />
          <Text style={styles.actionText}>Repost</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, styles.actionDivider]}
          activeOpacity={0.8}
          disabled={!onPress}
          onPress={onPress}
        >
          <Ionicons name="document-text-outline" size={15} color={theme.colors.subtext} />
          <Text style={styles.actionText}>Evidence</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// PHASE 3 STEP 11
export const ClaimCard = memo(ClaimCardComponent);

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.background,
    borderRadius: theme.radius.md,
    borderWidth: 0.5,
    borderColor: theme.colors.lightBorder,
    marginBottom: 10,
    overflow: "hidden",
  },
  body: {
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
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
    fontSize: 15,
    fontWeight: "500",
    color: theme.colors.text,
    lineHeight: 21,
  },
  titleRowCompact: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 10,
    justifyContent: "space-between",
  },
  authorRow: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  authorName: {
    color: theme.colors.text,
    fontSize: 12,
    fontWeight: "500",
  },
  authorMeta: {
    color: theme.colors.subtext,
    fontSize: 12,
  },
  verifiedBadge: {
    backgroundColor: theme.colors.successBg,
    borderRadius: 999,
    color: theme.colors.success,
    fontSize: 11,
    fontWeight: "500",
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  description: {
    fontSize: 14,
    color: theme.colors.text,
    lineHeight: 20,
  },
  claimImage: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.sm,
    height: 160,
    maxHeight: 180,
    width: "100%",
  },
  videoPreview: {
    backgroundColor: theme.colors.card,
    borderColor: theme.colors.lightBorder,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    gap: theme.spacing.sm,
    overflow: "hidden",
  },
  videoPreviewHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.md,
  },
  videoPlatformBadge: {
    backgroundColor: "#E0E7FF",
    borderColor: theme.colors.primary,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    color: theme.colors.primary,
    fontSize: theme.typography.small.fontSize,
    fontWeight: "500",
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
  },
  videoPreviewText: {
    color: theme.colors.subtext,
    flex: 1,
    fontSize: theme.typography.small.fontSize,
  },
  thumbnailWrap: {
    position: "relative",
  },
  videoThumbnail: {
    backgroundColor: theme.colors.background,
    height: 150,
    width: "100%",
  },
  playOverlay: {
    alignItems: "center",
    backgroundColor: "rgba(15, 23, 42, 0.72)",
    borderRadius: 24,
    height: 48,
    justifyContent: "center",
    left: "50%",
    marginLeft: -24,
    marginTop: -24,
    position: "absolute",
    top: "50%",
    width: 48,
  },
  videoLinkBox: {
    alignItems: "center",
    flexDirection: "row",
    gap: theme.spacing.sm,
    padding: theme.spacing.md,
  },
  videoLinkBoxText: {
    color: theme.colors.text,
    fontSize: theme.typography.small.fontSize,
    fontWeight: "500",
  },
  source: {
    color: theme.colors.link,
    flex: 1,
    fontSize: 12,
  },
  sourceRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 5,
  },
  metaWrap: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  aiSignalPanel: {
    backgroundColor: theme.colors.aiBg,
    borderRadius: theme.radius.sm,
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  aiSignalText: {
    color: theme.colors.ai,
    fontSize: 11,
    lineHeight: 15,
  },
  aiRedFlags: {
    color: theme.colors.danger,
    fontSize: 11,
    lineHeight: 15,
  },
  notFactCheckableWarning: {
    color: theme.colors.warning,
    fontSize: 11,
    fontWeight: "600",
    lineHeight: 15,
  },
  sourceWarning: {
    color: theme.colors.warning,
    fontSize: 11,
    fontWeight: "600",
    lineHeight: 15,
  },
  aiDisclaimer: {
    color: theme.colors.subtext,
    fontSize: 11,
    lineHeight: 15,
  },
  evidenceCount: {
    color: theme.colors.primary,
    fontSize: theme.typography.small.fontSize,
    fontWeight: "500",
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
    fontWeight: "500",
  },
  flaggedBadge: {
    backgroundColor: theme.colors.dangerBg,
    borderRadius: 999,
    color: theme.colors.danger,
    fontSize: 11,
    fontWeight: "500",
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  claimTypeBadge: {
    backgroundColor: theme.colors.warningBg,
    borderRadius: 999,
    color: theme.colors.warning,
    fontSize: 11,
    fontWeight: "500",
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  reportSuccess: {
    color: theme.colors.success,
    fontSize: theme.typography.small.fontSize,
    fontWeight: "500",
    marginTop: theme.spacing.md,
  },
  reportError: {
    color: theme.colors.danger,
    fontSize: theme.typography.small.fontSize,
    fontWeight: "500",
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
    fontWeight: "500",
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
    fontWeight: "500",
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
  disabledButton: {
    opacity: 0.55,
  },
  submitReportButtonText: {
    color: theme.colors.background,
    fontSize: theme.typography.body.fontSize,
    fontWeight: "500",
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
    fontWeight: "500",
  },
  aiBadge: {
    alignSelf: "flex-start",
    backgroundColor: theme.colors.card,
    borderColor: theme.colors.lightBorder,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    marginBottom: theme.spacing.sm,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
  },
  aiBadgeText: {
    color: theme.colors.subtext,
    fontSize: theme.typography.small.fontSize,
    fontWeight: "500",
  },
  category: {
    alignSelf: "flex-start",
    backgroundColor: theme.colors.tagBg,
    borderRadius: 999,
    color: theme.colors.tagText,
    fontSize: 11,
    fontWeight: "500",
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  evidencePill: {
    alignSelf: "flex-start",
    backgroundColor: theme.colors.secondarySurface,
    borderRadius: 999,
    color: theme.colors.subtext,
    fontSize: 11,
    fontWeight: "400",
    paddingHorizontal: 9,
    paddingVertical: 4,
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
    fontWeight: "500",
    color: theme.colors.primary,
  },
  closedText: {
    color: theme.colors.subtext,
  },
  // PHASE 3 STEP 17
  verificationPanel: {
    backgroundColor: theme.colors.card,
    borderColor: theme.colors.lightBorder,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    gap: theme.spacing.xs,
    marginTop: theme.spacing.md,
    padding: theme.spacing.md,
  },
  verificationRow: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.md,
    justifyContent: "space-between",
  },
  verificationText: {
    color: theme.colors.subtext,
    fontSize: theme.typography.small.fontSize,
    fontWeight: "500",
  },
  verificationStrong: {
    color: theme.colors.text,
    fontSize: theme.typography.small.fontSize,
    fontWeight: "500",
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
    fontWeight: "500",
    marginBottom: theme.spacing.xs,
  },
  verdictTitle: {
    color: theme.colors.text,
    fontSize: theme.typography.body.fontSize,
    fontWeight: "500",
    marginBottom: theme.spacing.xs,
  },
  verdictReason: {
    color: theme.colors.subtext,
    fontSize: theme.typography.small.fontSize,
    lineHeight: theme.typography.small.lineHeight,
  },
  verdictMeta: {
    color: theme.colors.subtext,
    fontSize: theme.typography.small.fontSize,
    fontWeight: "500",
    marginTop: theme.spacing.sm,
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
    fontWeight: "500",
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
    borderTopColor: theme.colors.lightBorder,
    borderTopWidth: 0.5,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  voteMessage: {
    color: theme.colors.subtext,
    fontSize: theme.typography.small.fontSize,
    marginTop: theme.spacing.sm,
  },
  userVoteText: {
    color: theme.colors.primary,
    fontSize: theme.typography.small.fontSize,
    fontWeight: "500",
    marginBottom: theme.spacing.sm,
  },
  voteError: {
    color: theme.colors.danger,
    fontSize: theme.typography.small.fontSize,
    fontWeight: "500",
    marginTop: theme.spacing.sm,
  },
  voteSuccess: {
    color: theme.colors.success,
    fontSize: theme.typography.small.fontSize,
    fontWeight: "500",
    marginTop: theme.spacing.sm,
  },
  actionRow: {
    alignItems: "center",
    borderTopColor: theme.colors.lightBorder,
    borderTopWidth: 0.5,
    flexDirection: "row",
    minHeight: 44,
  },
  actionButton: {
    alignItems: "center",
    flex: 1,
    gap: 3,
    justifyContent: "center",
    minHeight: 44,
  },
  actionDivider: {
    borderLeftColor: theme.colors.lightBorder,
    borderLeftWidth: 0.5,
  },
  actionText: {
    color: theme.colors.subtext,
    fontSize: 11,
    fontWeight: "400",
  },
  scorePreviewRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingTop: 10,
  },
  scorePreviewText: {
    color: theme.colors.subtext,
    fontSize: 11,
    fontWeight: "400",
  },
  reportRowCompact: {
    alignItems: "center",
    backgroundColor: theme.colors.secondarySurface,
    borderTopColor: theme.colors.lightBorder,
    borderTopWidth: 0.5,
    flexDirection: "row",
    gap: 8,
    maxHeight: 40,
    minHeight: 40,
    paddingHorizontal: 14,
  },
  reportInlineLabel: {
    color: theme.colors.subtext,
    fontSize: 11,
    fontWeight: "400",
  },
  reportChipScroller: {
    flex: 1,
  },
  reportChipRow: {
    alignItems: "center",
    gap: 6,
  },
  reportChip: {
    borderColor: theme.colors.border,
    borderRadius: 999,
    borderWidth: 0.5,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  reportChipSelected: {
    backgroundColor: theme.colors.dangerBg,
    borderColor: "#F09595",
  },
  reportChipText: {
    color: theme.colors.subtext,
    fontSize: 11,
    fontWeight: "400",
  },
  reportChipTextSelected: {
    color: theme.colors.danger,
  },
  reportIconButton: {
    alignItems: "center",
    backgroundColor: theme.colors.danger,
    borderRadius: 8,
    justifyContent: "center",
    padding: 10,
  },
  reportCountText: {
    color: theme.colors.subtext,
    fontSize: 11,
    paddingHorizontal: 14,
    paddingTop: 8,
  },
});
