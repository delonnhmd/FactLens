// PHASE 1 STEP 4
import { memo, useCallback, useState } from "react";
import { Alert, Image, Share, TouchableOpacity, View, Text, StyleSheet, TextInput } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { Claim, ReportReason, VoteOption } from "../types/claim";
import { StatusBadge } from "./StatusBadge";
import { SourceQualityBadge } from "./SourceQualityBadge";
import { VoteButtons } from "./VoteButtons";
import { reportReasons } from "../constants/reportReasons";
import { theme } from "../constants/theme";
import { useAuth } from "../context/AuthContext";
import { calculateAutomaticVerdict, getTimeRemaining, getVoteWindowClosesAt, isVotingOpen } from "../services/claimVoting";
import { getSourceQuality } from "../services/sourceQuality";

// PHASE 2 STEP 8
const aiCheckLabels = {
  PENDING: "Pending",
  LIKELY_TRUE: "Likely True",
  LIKELY_FAKE: "Likely Fake",
  NEEDS_MORE_EVIDENCE: "Needs More Evidence",
};

// PHASE 3 STEP 10
const verdictLabels = {
  COMMUNITY_TRUE: "Community Says True",
  COMMUNITY_FAKE: "Community Says Fake",
  NEEDS_MORE_EVIDENCE: "Needs More Evidence",
};

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

interface ClaimCardProps {
  claim: Claim;
  onPress?: () => void;
  onVote: (claimId: string, vote: VoteOption) => void | Promise<void>;
  // PHASE 3 STEP 6
  onReport: (claimId: string, reason: ReportReason, note: string) => void | Promise<void>;
}

function ClaimCardComponent({ claim, onPress, onVote, onReport }: ClaimCardProps) {
  // PHASE 3 STEP 4
  const { isAuthenticated, isVerified } = useAuth();
  // PHASE 2 STEP 6
  const [showReportForm, setShowReportForm] = useState(false);
  const [selectedReportReason, setSelectedReportReason] = useState<ReportReason>("Spam");
  const [reportNote, setReportNote] = useState("");
  const [reportSuccess, setReportSuccess] = useState(false);
  // PHASE 3 STEP 6
  const [reportError, setReportError] = useState("");
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [voteError, setVoteError] = useState("");
  // PHASE 2 STEP 3
  const votingOpen = claim.status === "OPEN" && isVotingOpen(claim);
  const voteWindowClosesAt = getVoteWindowClosesAt(claim.createdAt);
  const voteDisabled = !votingOpen || !isAuthenticated || !isVerified || Boolean(claim.userVote);
  const automaticVerdict = !votingOpen && claim.status !== "VOTING_CLOSED" ? calculateAutomaticVerdict(claim) : undefined;
  // PHASE 3 STEP 5
  const evidenceCount = claim.evidenceCount ?? claim.evidence.length;
  const evidenceLabel = `${evidenceCount} evidence ${evidenceCount === 1 ? "link" : "links"}`;
  // PHASE 2 STEP 5
  const sourceQuality = getSourceQuality(claim.sourceUrl);
  // PHASE 2 STEP 10
  const totalVotes = claim.votesTrue + claim.votesFake + claim.votesUnsure;
  // PHASE 3 STEP 10
  const finalTotalVotes = claim.verdictCalculatedAt ? claim.totalVotes : totalVotes;
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
  const currentVerdict = verdictTitle ?? (claim.status === "VOTING_CLOSED" ? "Locking score" : "Pending");

  // PHASE 3 STEP 6
  const handleSubmitReport = useCallback(async () => {
    setReportError("");
    setReportSubmitting(true);

    try {
      await onReport(claim.id, selectedReportReason, reportNote);
      setReportNote("");
      setSelectedReportReason("Spam");
      setShowReportForm(false);
      setReportSuccess(true);
    } catch (error) {
      setReportError(error instanceof Error ? error.message : "We could not save this report. Please try again.");
    } finally {
      setReportSubmitting(false);
    }
  }, [claim.id, onReport, reportNote, selectedReportReason]);

  const handleVote = useCallback(async (vote: VoteOption) => {
    setVoteError("");

    try {
      await onVote(claim.id, vote);
    } catch (error) {
      setVoteError(error instanceof Error ? error.message : "We could not save your vote. Please try again.");
    }
  }, [claim.id, onVote]);

  const handleShareClaim = useCallback(async () => {
    const message = `Check this claim on FactLens: ${claim.title} ${claim.shareUrl}`;

    try {
      await Share.share({
        title: claim.title,
        message,
        url: claim.shareUrl,
      });
    } catch {
      Alert.alert("Share", message);
    }
  }, [claim.shareUrl, claim.title]);

  const voteMessage = !votingOpen
    ? ""
    : !isAuthenticated
      ? "Log in to vote."
      : !isVerified
        ? "Verify your email to vote."
        : claim.userVote
          ? "Your vote is recorded. Vote changes are not allowed."
          : "Choose one option before voting closes.";

  return (
    <View style={styles.card}>
      <TouchableOpacity onPress={onPress} activeOpacity={0.9} disabled={!onPress}>
        <View style={styles.headerRow}>
          <View style={styles.titleWrapper}>
            <Text style={styles.title}>{claim.title}</Text>
          </View>
          <StatusBadge status={claim.status} />
        </View>

        <View style={styles.authorRow}>
          <Text style={styles.authorName}>{claim.authorDisplayName}</Text>
          {claim.authorVerified ? <Text style={styles.verifiedBadge}>Verified</Text> : null}
          <Text style={styles.authorMeta}>
            @{claim.authorUsername} - {getRelativeTime(claim.createdAt)}
          </Text>
        </View>

        <Text style={styles.description} numberOfLines={3}>
          {claim.description}
        </Text>
        {/* PHASE 3 STEP 7 */}
        {claim.media.imageUrl ? (
          <Image source={{ uri: claim.media.imageUrl }} style={styles.claimImage} resizeMode="cover" />
        ) : null}
        {/* PHASE 3 STEP 8 */}
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
        {/* PHASE 2 STEP 2 */}
        {claim.category ? <Text style={styles.category}>{claim.category}</Text> : null}
        <Text style={styles.source} numberOfLines={1}>
          Source: {claim.sourceUrl}
        </Text>
        <View style={styles.qualityRow}>
          <Text style={styles.qualityLabel}>Source Quality:</Text>
          <SourceQualityBadge quality={sourceQuality} />
        </View>
        <View style={styles.aiBadge}>
          <Text style={styles.aiBadgeText}>AI Check: {aiCheckLabels[claim.aiCheck.status]}</Text>
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

      <View style={styles.windowRow}>
        <Text style={[styles.windowText, !votingOpen && styles.closedText]}>
          {votingOpen ? `${getTimeRemaining(voteWindowClosesAt)} remaining` : "Voting closed"}
        </Text>
      </View>

      <View style={styles.verificationPanel}>
        <View style={styles.verificationRow}>
          <Text style={styles.verificationText}>Mode: {claim.mode === "test" ? "Test" : "Production"}</Text>
          <Text style={styles.verificationText}>Phase {claim.currentPhase}</Text>
        </View>
        <Text style={styles.verificationText}>Vote closes: {new Date(claim.voteAcceptUntil).toLocaleTimeString()}</Text>
        <Text style={styles.verificationText}>Score locks: {new Date(claim.scoreLockAt).toLocaleTimeString()}</Text>
        <View style={styles.verificationRow}>
          <Text style={styles.verificationText}>AI {formatPercent(claim.aiCheck.confidence)}</Text>
          <Text style={styles.verificationText}>Community {formatPercent(claim.weightedCommunityScore)}</Text>
        </View>
        <View style={styles.verificationRow}>
          <Text style={styles.verificationStrong}>Final {formatPercent(claim.finalScore)}</Text>
          <Text style={styles.verificationStrong}>{currentVerdict}</Text>
        </View>
        <Text style={styles.verificationText}>
          Min votes: {finalTotalVotes}/{claim.minVotesRequired}
        </Text>
      </View>

      {!votingOpen && verdictTitle ? (
        <View style={styles.verdictPanel}>
          <Text style={styles.verdictLabel}>System Verdict</Text>
          <Text style={styles.verdictTitle}>{verdictTitle}</Text>
          {verdictReason ? <Text style={styles.verdictReason}>{verdictReason}</Text> : null}
          <Text style={styles.verdictMeta}>{finalTotalVotes} total votes</Text>
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
          <VoteButtons disabled={voteDisabled} userVote={claim.userVote} onVote={handleVote} />
          {voteMessage ? <Text style={styles.voteMessage}>{voteMessage}</Text> : null}
          {voteError ? <Text style={styles.voteError}>{voteError}</Text> : null}
        </View>
      ) : null}

      <View style={styles.actionRow}>
        <TouchableOpacity
          style={styles.actionButton}
          activeOpacity={0.8}
          disabled={!onPress}
          onPress={onPress}
        >
          <Ionicons name="chatbubble-outline" size={17} color={theme.colors.subtext} />
          <Text style={styles.actionText}>Reply / Evidence</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.iconActionButton}
          activeOpacity={0.8}
          onPress={() => Alert.alert("Repost will be added later.")}
        >
          <Ionicons name="repeat-outline" size={18} color={theme.colors.subtext} />
          <Text style={styles.actionText}>Repost</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.iconActionButton} activeOpacity={0.8} onPress={handleShareClaim}>
          <Ionicons name="share-outline" size={18} color={theme.colors.subtext} />
          <Text style={styles.actionText}>Share</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.iconActionButton}
          activeOpacity={0.8}
          onPress={() => {
            setShowReportForm((currentValue) => !currentValue);
            setReportSuccess(false);
            setReportError("");
          }}
        >
          <Ionicons name="flag-outline" size={17} color={theme.colors.subtext} />
          <Text style={styles.actionText}>Report</Text>
        </TouchableOpacity>
        <View style={styles.voteSummary}>
          <Ionicons name="stats-chart-outline" size={16} color={theme.colors.subtext} />
          <Text style={styles.actionText}>{totalVotes} votes</Text>
        </View>
      </View>

      {reportSuccess ? <Text style={styles.reportSuccess}>Report submitted.</Text> : null}

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
                  onPress={() => {
                    setSelectedReportReason(reason);
                    setReportSuccess(false);
                    setReportError("");
                  }}
                >
                  <Text style={[styles.reasonButtonText, selected && styles.reasonButtonTextSelected]}>{reason}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <TextInput
            value={reportNote}
            onChangeText={(value) => {
              setReportNote(value);
              setReportSuccess(false);
              setReportError("");
            }}
            placeholder="Optional note"
            placeholderTextColor={theme.colors.muted}
            style={styles.reportInput}
            multiline
          />
          <TouchableOpacity
            style={[styles.submitReportButton, reportSubmitting && styles.disabledButton]}
            activeOpacity={0.8}
            onPress={handleSubmitReport}
            disabled={reportSubmitting}
          >
            <Text style={styles.submitReportButtonText}>{reportSubmitting ? "Submitting..." : "Submit report"}</Text>
          </TouchableOpacity>
          {reportError ? <Text style={styles.reportError}>{reportError}</Text> : null}
        </View>
      ) : null}
    </View>
  );
}

// PHASE 3 STEP 11
export const ClaimCard = memo(ClaimCardComponent);

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
  authorRow: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  authorName: {
    color: theme.colors.text,
    fontSize: theme.typography.small.fontSize,
    fontWeight: "700",
  },
  authorMeta: {
    color: theme.colors.subtext,
    fontSize: theme.typography.small.fontSize,
  },
  verifiedBadge: {
    backgroundColor: "#DCFCE7",
    borderColor: "#BBF7D0",
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    color: theme.colors.success,
    fontSize: theme.typography.small.fontSize,
    fontWeight: "700",
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
  },
  description: {
    fontSize: theme.typography.body.fontSize,
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
    lineHeight: theme.typography.body.lineHeight,
  },
  claimImage: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.sm,
    height: 160,
    maxHeight: 180,
    marginBottom: theme.spacing.md,
    width: "100%",
  },
  videoPreview: {
    backgroundColor: theme.colors.card,
    borderColor: theme.colors.lightBorder,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.md,
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
    fontWeight: "700",
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
    fontWeight: "700",
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
  reportSuccess: {
    color: theme.colors.success,
    fontSize: theme.typography.small.fontSize,
    fontWeight: "700",
    marginTop: theme.spacing.md,
  },
  reportError: {
    color: theme.colors.danger,
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
  disabledButton: {
    opacity: 0.55,
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
    fontWeight: "700",
  },
  verificationStrong: {
    color: theme.colors.text,
    fontSize: theme.typography.small.fontSize,
    fontWeight: "700",
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
  verdictMeta: {
    color: theme.colors.subtext,
    fontSize: theme.typography.small.fontSize,
    fontWeight: "700",
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
  voteMessage: {
    color: theme.colors.subtext,
    fontSize: theme.typography.small.fontSize,
    marginTop: theme.spacing.sm,
  },
  voteError: {
    color: theme.colors.danger,
    fontSize: theme.typography.small.fontSize,
    fontWeight: "700",
    marginTop: theme.spacing.sm,
  },
  actionRow: {
    alignItems: "center",
    borderTopColor: theme.colors.lightBorder,
    borderTopWidth: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.sm,
    justifyContent: "space-between",
    marginTop: theme.spacing.md,
    paddingTop: theme.spacing.md,
  },
  actionButton: {
    alignItems: "center",
    flexDirection: "row",
    gap: theme.spacing.xs,
    paddingVertical: theme.spacing.xs,
  },
  iconActionButton: {
    alignItems: "center",
    flexDirection: "row",
    gap: theme.spacing.xs,
    paddingVertical: theme.spacing.xs,
  },
  actionText: {
    color: theme.colors.subtext,
    fontSize: theme.typography.small.fontSize,
    fontWeight: "700",
  },
  voteSummary: {
    alignItems: "center",
    flexDirection: "row",
    gap: theme.spacing.xs,
    paddingVertical: theme.spacing.xs,
  },
});
