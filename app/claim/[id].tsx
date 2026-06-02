// PHASE 1 STEP 4
// PHASE 3 STEP 28
// PHASE 3 STEP 32
// PHASE 4 STEP 6
// PHASE 4 STEP 7
// PHASE 4 STEP 8
// PHASE 4 STEP 9
// PHASE 4 STEP 10
import { useCallback, useEffect, useState } from "react";
import { Alert, Image, Linking, View, Text, ScrollView, StyleSheet, SafeAreaView, TouchableOpacity, TextInput } from "react-native";
import { useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { EmptyState } from "../../components/EmptyState";
import { SourceQualityBadge } from "../../components/SourceQualityBadge";
import { StatusBadge } from "../../components/StatusBadge";
import { VoteButtons, getVoteOptionLabel } from "../../components/VoteButtons";
import { AiCheckBadge } from "../../components/AiCheckBadge";
import { PhaseStatusRow } from "../../components/PhaseStatusRow";
import { VerdictBanner } from "../../components/VerdictBanner";
import { VoteBreakdownBars } from "../../components/VoteBreakdownBars";
import { useAuth } from "../../context/AuthContext";
import { useClaims } from "../../context/ClaimsContext";
import { calculateAutomaticVerdict, getTimeRemaining, isVotingOpen } from "../../services/claimVoting";
import {
  formatSourceCredibilityScore,
  getSourceCredibilityLabel,
  getSourceQuality,
  type SourceQuality,
} from "../../services/sourceQuality";
import { getScoreLockAt, getVoteAcceptUntil } from "../../utils/verificationTiming";
import {
  subscribeToClaimById,
  subscribeToEvidenceForClaim,
  subscribeToReportsForClaim,
  subscribeToVotesForClaim,
  unsubscribe,
} from "../../services/realtimeService";
import type { Evidence, EvidenceType, ReportReason, VoteOption } from "../../types/claim";
import { theme } from "../../constants/theme";
import { isValidSourceUrl, normalizeUrl } from "../../utils/url";

// PHASE 2 STEP 4
type EvidenceFieldName = "url" | "note";
type EvidenceErrors = Partial<Record<EvidenceFieldName, string>>;

const evidenceTypeOptions: EvidenceType[] = ["SUPPORTS_TRUE", "SUPPORTS_FAKE", "ADDS_CONTEXT", "UNCLEAR"];

const evidenceTypeConfig: Record<EvidenceType, { label: string; backgroundColor: string; color: string }> = {
  SUPPORTS_TRUE: {
    label: "Supports true",
    backgroundColor: theme.colors.successBg,
    color: theme.colors.success,
  },
  SUPPORTS_FAKE: {
    label: "Supports fake",
    backgroundColor: theme.colors.dangerBg,
    color: theme.colors.danger,
  },
  ADDS_CONTEXT: {
    label: "Adds context",
    backgroundColor: theme.colors.sourceBg,
    color: theme.colors.sourceText,
  },
  UNCLEAR: {
    label: "Unclear",
    backgroundColor: theme.colors.warningBg,
    color: theme.colors.warning,
  },
};

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

const CLAIM_REFETCH_DELAY_MS = 300;

function waitForClaimRefetch() {
  return new Promise((resolve) => setTimeout(resolve, CLAIM_REFETCH_DELAY_MS));
}

// PHASE 3 STEP 5
function getEvidenceSourceQuality(evidence: Evidence): SourceQuality {
  const fallbackQuality = getSourceQuality(evidence.url);

  if (!evidence.sourceQualityLabel) {
    return fallbackQuality;
  }

  return {
    label: evidence.sourceQualityLabel as SourceQuality["label"],
    score: evidence.sourceQualityScore ?? fallbackQuality.score,
    reason: evidence.sourceQualityReason ?? fallbackQuality.reason,
    lean: fallbackQuality.lean,
  };
}

// PHASE 3 STEP 17
function formatPercent(value: number | null | undefined): string {
  const normalized = value === null || value === undefined ? 0.5 : value > 1 ? value / 100 : value;
  return `${Math.round(normalized * 100)}%`;
}

function formatSourceQualityLabel(value: string | null | undefined): string {
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

export default function ClaimDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const navigation = useNavigation();
  // PHASE 2 STEP 9
  const { currentUser, isAuthenticated, isVerified } = useAuth();
  // PHASE 2 STEP 3
  const {
    getClaimById,
    fetchClaimById,
    voteOnClaim,
    fetchEvidenceForClaim,
    addEvidence,
    fetchReportsForClaim,
    reportClaim,
    refreshClaimVerdict,
    runAiPrecheckForClaimId,
    retryAiPrecheckWithEvidenceForClaimId,
  } = useClaims();
  // PHASE 2 STEP 4
  const [evidenceUrl, setEvidenceUrl] = useState("");
  const [evidenceNote, setEvidenceNote] = useState("");
  const [evidenceType, setEvidenceType] = useState<EvidenceType>("ADDS_CONTEXT");
  const [evidenceErrors, setEvidenceErrors] = useState<EvidenceErrors>({});
  // PHASE 3 STEP 5
  const [evidenceLoading, setEvidenceLoading] = useState(false);
  const [evidenceSubmitLoading, setEvidenceSubmitLoading] = useState(false);
  const [evidenceError, setEvidenceError] = useState("");
  // PHASE 4 STEP 14
  const [evidenceSuccess, setEvidenceSuccess] = useState("");
  // PHASE 2 STEP 6
  const [reportReason, setReportReason] = useState<ReportReason>("Spam");
  const [reportNote, setReportNote] = useState("");
  const [reportSuccess, setReportSuccess] = useState(false);
  // PHASE 3 STEP 6
  const [reportLoading, setReportLoading] = useState(false);
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportError, setReportError] = useState("");
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [voteError, setVoteError] = useState("");
  // PHASE 3 STEP 20
  const [voteSuccess, setVoteSuccess] = useState("");
  // PHASE 4 STEP 2
  const [aiPrecheckLoading, setAiPrecheckLoading] = useState(false);
  // PHASE 4 STEP 10
  const [aiEvidenceRecheckLoading, setAiEvidenceRecheckLoading] = useState(false);
  const [aiPrecheckMessage, setAiPrecheckMessage] = useState("");
  const [aiPrecheckError, setAiPrecheckError] = useState("");
  // PHASE 3 STEP 12
  const [liveUpdatesOn, setLiveUpdatesOn] = useState(false);

  const claimId = Array.isArray(id) ? id[0] : id;
  const claim = claimId ? getClaimById(claimId) : undefined;
  // PHASE 3 STEP 6
  const userReport = claim && currentUser ? claim.reports.find((report) => report.userId === currentUser.id) : undefined;

  // PHASE 3 STEP 3
  // PHASE 3 STEP 32
  const refreshDetailClaim = useCallback(async (mountedRef?: { current: boolean }) => {
    if (!claimId) {
      return undefined;
    }

    setDetailLoading(true);
    setDetailError("");

    try {
      const loadedClaim = await fetchClaimById(claimId);

      if (mountedRef && !mountedRef.current) {
        return loadedClaim;
      }

      if (!loadedClaim) {
        setDetailError("Claim not found.");
      } else {
        console.log("[detail] refreshed claim:", {
          id: loadedClaim.id,
          votesTrue: loadedClaim.votesTrue,
          votesFake: loadedClaim.votesFake,
          votesUnsure: loadedClaim.votesUnsure,
          totalVotes: loadedClaim.totalVotes,
          aiStatus: loadedClaim.aiCheck.status,
          aiConfidence: loadedClaim.aiCheck.confidence,
          claimType: loadedClaim.claimType,
        });
      }

      return loadedClaim;
    } catch {
      if (!mountedRef || mountedRef.current) {
        setDetailError("We could not load this claim. Please try again.");
      }

      return undefined;
    } finally {
      if (!mountedRef || mountedRef.current) {
        setDetailLoading(false);
      }
    }
  }, [claimId, fetchClaimById]);

  useEffect(() => {
    const mountedRef = { current: true };

    void refreshDetailClaim(mountedRef);

    const unsubscribe = navigation.addListener?.("focus", () => {
      void refreshDetailClaim(mountedRef);
    });

    return () => {
      mountedRef.current = false;

      if (typeof unsubscribe === "function") {
        unsubscribe();
      }
    };
  }, [navigation, refreshDetailClaim]);

  // PHASE 3 STEP 12
  useEffect(() => {
    if (!claimId) {
      return;
    }

    let mounted = true;
    let activeSubscriptions = 0;

    const handleRealtimeStatus = (status: "active" | "error" | "closed") => {
      if (!mounted) {
        return;
      }

      if (status === "active") {
        activeSubscriptions += 1;
        setLiveUpdatesOn(true);
        return;
      }

      activeSubscriptions = Math.max(0, activeSubscriptions - 1);
      setLiveUpdatesOn(activeSubscriptions > 0);
    };

    const refreshClaim = () => {
      refreshClaimVerdict(claimId).catch(() => undefined);
    };

    const refreshEvidence = () => {
      fetchEvidenceForClaim(claimId).catch((error) => {
        if (mounted) {
          setEvidenceError(error instanceof Error ? error.message : "We could not load evidence right now.");
        }
      });
    };

    const refreshReports = () => {
      refreshClaim();

      if (!currentUser) {
        return;
      }

      fetchReportsForClaim(claimId).catch((error) => {
        if (mounted) {
          setReportError(error instanceof Error ? error.message : "We could not load reports right now.");
        }
      });
    };

    const channels = [
      subscribeToClaimById(claimId, refreshClaim, handleRealtimeStatus),
      subscribeToVotesForClaim(claimId, refreshClaim, handleRealtimeStatus),
      subscribeToEvidenceForClaim(
        claimId,
        () => {
          refreshEvidence();
          refreshClaim();
        },
        handleRealtimeStatus,
      ),
      subscribeToReportsForClaim(claimId, refreshReports, handleRealtimeStatus),
    ];

    return () => {
      mounted = false;
      setLiveUpdatesOn(false);
      channels.forEach(unsubscribe);
    };
  }, [claimId, currentUser, fetchEvidenceForClaim, fetchReportsForClaim, refreshClaimVerdict]);

  // PHASE 3 STEP 10
  useEffect(() => {
    if (!claimId) {
      return;
    }

    let mounted = true;

    refreshClaimVerdict(claimId).catch((error) => {
      if (mounted) {
        setDetailError(error instanceof Error ? error.message : "We could not refresh this verdict.");
      }
    });

    return () => {
      mounted = false;
    };
  }, [claimId, refreshClaimVerdict]);

  // PHASE 3 STEP 5
  useEffect(() => {
    if (!claim?.id) {
      return;
    }

    let mounted = true;
    setEvidenceLoading(true);
    setEvidenceError("");

    fetchEvidenceForClaim(claim.id)
      .catch((error) => {
        if (mounted) {
          setEvidenceError(error instanceof Error ? error.message : "We could not load evidence right now.");
        }
      })
      .finally(() => {
        if (mounted) {
          setEvidenceLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [claim?.id, fetchEvidenceForClaim]);

  // PHASE 3 STEP 6
  useEffect(() => {
    if (!claim?.id || !currentUser) {
      return;
    }

    let mounted = true;
    setReportLoading(true);
    setReportError("");

    fetchReportsForClaim(claim.id)
      .catch((error) => {
        if (mounted) {
          setReportError(error instanceof Error ? error.message : "We could not load reports right now.");
        }
      })
      .finally(() => {
        if (mounted) {
          setReportLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [claim?.id, currentUser, fetchReportsForClaim]);

  // PHASE 3 STEP 6
  useEffect(() => {
    if (!userReport) {
      return;
    }

    setReportReason(userReport.reason);
    setReportNote(userReport.note);
  }, [userReport?.id]);

  const updateEvidenceField = (field: EvidenceFieldName, value: string) => {
    if (field === "url") {
      setEvidenceUrl(value);
    }

    if (field === "note") {
      setEvidenceNote(value);
    }

    if (evidenceErrors[field]) {
      setEvidenceErrors((currentErrors) => ({ ...currentErrors, [field]: undefined }));
    }

    if (evidenceError || evidenceSuccess) {
      setEvidenceError("");
      setEvidenceSuccess("");
    }
  };

  const validateEvidence = (): EvidenceErrors => {
    const nextErrors: EvidenceErrors = {};
    const trimmedUrl = evidenceUrl.trim();
    const trimmedNote = evidenceNote.trim();

    if (!trimmedUrl) {
      nextErrors.url = "Evidence URL is required.";
    } else if (!isValidSourceUrl(trimmedUrl)) {
      nextErrors.url = "Enter a valid evidence URL.";
    }

    if (!trimmedNote) {
      // PHASE 4 STEP 14B
      nextErrors.note = "Evidence note is required.";
    } else if (trimmedNote.length < 10) {
      nextErrors.note = "Short note must be at least 10 characters.";
    }

    return nextErrors;
  };

  const handleAddEvidence = async () => {
    if (!claim) {
      return;
    }

    setEvidenceError("");
    setEvidenceSuccess("");
    const nextErrors = validateEvidence();

    if (Object.keys(nextErrors).length > 0) {
      setEvidenceErrors(nextErrors);
      return;
    }

    setEvidenceSubmitLoading(true);

    try {
      await addEvidence(claim.id, {
        url: normalizeUrl(evidenceUrl),
        note: evidenceNote,
        type: evidenceType,
      });
      setEvidenceUrl("");
      setEvidenceNote("");
      setEvidenceType("ADDS_CONTEXT");
      setEvidenceErrors({});
      setEvidenceSuccess("Evidence saved.");
    } catch (error) {
      setEvidenceError(error instanceof Error ? error.message : "We could not save this evidence. Please try again.");
    } finally {
      setEvidenceSubmitLoading(false);
    }
  };

  // PHASE 3 STEP 6
  const handleSubmitReport = async () => {
    if (!claim) {
      return;
    }

    setReportError("");
    setReportSubmitting(true);

    try {
      await reportClaim(claim.id, reportReason, reportNote);
      setReportSuccess(true);
    } catch (error) {
      setReportError(error instanceof Error ? error.message : "We could not save this report. Please try again.");
    } finally {
      setReportSubmitting(false);
    }
  };

  // PHASE 3 STEP 4
  const handleVote = async (vote: VoteOption) => {
    if (!claim) {
      return;
    }

    setVoteError("");
    setVoteSuccess("");

    try {
      // PHASE 3 STEP 20D
      // PHASE 3 STEP 32
      const message = await voteOnClaim(claim.id, vote);
      setVoteSuccess(typeof message === "string" ? message : "Vote saved.");
      await waitForClaimRefetch();
      await refreshDetailClaim();
    } catch (error) {
      setVoteError(error instanceof Error ? error.message : "We could not save your vote. Please try again.");
    }
  };

  // PHASE 4 STEP 3
  // PHASE 4 STEP 10B
  const handleRunAiPrecheck = async () => {
    if (!claim) {
      return;
    }

    setAiPrecheckLoading(true);
    setAiPrecheckMessage("");
    setAiPrecheckError("");

    try {
      const updatedClaim = await runAiPrecheckForClaimId(claim.id);
      if (!updatedClaim) {
        throw new Error("AI pre-check completed, but claim refresh failed.");
      }

      await waitForClaimRefetch();
      await refreshDetailClaim();
      setAiPrecheckMessage("AI pre-check updated.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "AI pre-check unavailable.";
      setAiPrecheckError(`AI pre-check failed: ${message}`);
    } finally {
      setAiPrecheckLoading(false);
    }
  };

  // PHASE 4 STEP 10
  const handleRecheckWithEvidence = async () => {
    if (!claim) {
      return;
    }

    setAiEvidenceRecheckLoading(true);
    setAiPrecheckMessage("");
    setAiPrecheckError("");

    try {
      await retryAiPrecheckWithEvidenceForClaimId(claim.id);
      await waitForClaimRefetch();
      await refreshDetailClaim();
      setAiPrecheckMessage("AI re-check updated.");
    } catch {
      setAiPrecheckError("AI re-check failed. Try later.");
    } finally {
      setAiEvidenceRecheckLoading(false);
    }
  };

  if (!claim) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
            <Ionicons name="arrow-back" size={24} color="rgba(255, 255, 255, 0.7)" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Claim details</Text>
          <View style={styles.headerSpacer} />
        </View>
        <EmptyState message={detailLoading ? "Loading claim..." : detailError || "Claim not found."} />
      </SafeAreaView>
    );
  }

  // PHASE 3 STEP 32
  const totalVotes = claim.totalVotes;
  const votingOpen = claim.status === "OPEN" && isVotingOpen(claim);
  // PHASE 3 STEP 22
  const voteWindowClosesAt = getVoteAcceptUntil(claim);
  const scoreLockAt = getScoreLockAt(claim);
  // PHASE 3 STEP 22
  const voteDisabled = !votingOpen || !isAuthenticated || !isVerified || Boolean(claim.userVote);
  const automaticVerdict = !votingOpen && claim.status !== "VOTING_CLOSED" ? calculateAutomaticVerdict(claim) : undefined;
  // PHASE 3 STEP 10
  const verdictTitle =
    claim.status === "COMMUNITY_TRUE" ||
    claim.status === "COMMUNITY_FAKE" ||
    claim.status === "NEEDS_MORE_EVIDENCE"
      ? verdictLabels[claim.status]
      : automaticVerdict?.resultLabel;
  const verdictReason = claim.verdictReason ?? automaticVerdict?.reason;
  const verdictCalculatedText = claim.verdictCalculatedAt
    ? new Date(claim.verdictCalculatedAt).toLocaleString()
    : "Pending save";
  const engineVerdict = verdictTitle ?? (claim.status === "VOTING_CLOSED" ? "Locking score" : "Pending");
  // PHASE 3 STEP 5
  const evidenceCount = claim.evidenceCount ?? claim.evidence.length;
  // PHASE 4 STEP 10
  const evidenceUsedCount = claim.evidenceUsedCount ?? 0;
  const hasEvidenceLinks = evidenceCount > 0 || claim.evidence.length > 0;
  // PHASE 3 STEP 1
  const isOwner = currentUser?.id === claim.authorId;
  // PHASE 2 STEP 5
  const mainSourceQuality = getSourceQuality(claim.sourceUrl);
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
  // PHASE 4 STEP 3
  const canRetryAiPrecheck =
    claim.aiCheck.status === "PENDING" ||
    claim.aiCheck.status === "ERROR" ||
    claim.aiCheck.status === "NEEDS_MORE_EVIDENCE" ||
    claim.aiCheck.confidence === null ||
    claim.aiCheck.confidence === undefined;
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
  const shareClaim = () => {
    Alert.alert("Share link copied.", claim.shareUrl);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="arrow-back" size={24} color="rgba(255, 255, 255, 0.7)" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Claim details</Text>
        <TouchableOpacity onPress={shareClaim} hitSlop={8}>
          <Ionicons name="share-outline" size={22} color="rgba(255, 255, 255, 0.7)" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* PHASE 3 STEP 12 */}
        {liveUpdatesOn ? <Text style={styles.liveText}>Live updates on</Text> : null}
        <View style={styles.cardFlush}>
          <VerdictBanner
            status={claim.status}
            verdictLabel={engineVerdict}
            finalScore={formatPercent(claim.finalScore)}
            aiScore={formatPercent(claim.aiCheck.confidence)}
            communityScore={formatPercent(claim.weightedCommunityScore)}
          />
          <View style={styles.claimBody}>
            <View style={styles.titleRow}>
              <Text style={styles.title}>{claim.title}</Text>
              <StatusBadge status={claim.status} />
            </View>
            <Text style={styles.description}>{claim.description}</Text>
            <View style={styles.metaWrap}>
              {claim.category ? <Text style={styles.category}>{claim.category}</Text> : null}
              <SourceQualityBadge quality={mainSourceQuality} />
              <AiCheckBadge status={claim.aiCheck.status} />
              <Text style={styles.claimTypeBadge}>{formatClaimType(claim.claimType)}</Text>
              {claim.isFlagged ? <Text style={styles.flaggedBadge}>Flagged for review</Text> : null}
            </View>
            <View style={styles.sourceLinkRow}>
              <Ionicons name="link-outline" size={13} color={theme.colors.link} />
              <Text style={styles.sourceUrl} selectable>
                {claim.sourceUrl}
              </Text>
            </View>
            <View style={styles.aiDetailPanel}>
              <Text style={styles.aiDetailTitle}>AI pre-check</Text>
              <View style={styles.aiDetailGrid}>
                <View style={styles.aiDetailItem}>
                  <Text style={styles.aiDetailLabel}>Confidence</Text>
                  <Text style={styles.aiDetailValue}>{formatPercent(claim.aiCheck.confidence)}</Text>
                </View>
                <View style={styles.aiDetailItem}>
                  <Text style={styles.aiDetailLabel}>Source quality</Text>
                  <Text style={styles.aiDetailValue}>{formatSourceQualityLabel(claim.sourceQuality)}</Text>
                </View>
                <View style={styles.aiDetailItem}>
                  <Text style={styles.aiDetailLabel}>Source score</Text>
                  <Text style={styles.aiDetailValue}>{formatSourceCredibilityScore(claim.sourceScore)}</Text>
                </View>
                <View style={styles.aiDetailItem}>
                  <Text style={styles.aiDetailLabel}>Political lean</Text>
                  <Text style={styles.aiDetailValue}>{claim.sourceLean || mainSourceQuality.lean || "Unknown"}</Text>
                </View>
                <View style={styles.aiDetailItem}>
                  <Text style={styles.aiDetailLabel}>Claim type</Text>
                  <Text style={styles.aiDetailValue}>{formatClaimType(claim.claimType)}</Text>
                </View>
              </View>
              <Text style={styles.aiText}>Source domain: {claim.sourceDomain || "Pending"}</Text>
              <Text style={styles.aiText}>Source reason: {claim.sourceReason || "Source score pending."}</Text>
              {sourceNeedsEvidence ? (
                <Text style={styles.sourceWarning}>Source needs stronger supporting evidence.</Text>
              ) : null}
              <Text style={styles.aiText}>Evidence used by AI: {evidenceUsedCount}</Text>
              <Text style={styles.aiText}>
                {evidenceUsedCount > 0
                  ? `AI reviewed ${evidenceUsedCount} evidence links.`
                  : "No evidence links were used in this AI check."}
              </Text>
              <Text style={styles.aiText}>{aiSummary}</Text>
              {claim.redFlags.length > 0 ? (
                <Text style={styles.aiRedFlags}>Red flags: {claim.redFlags.join(", ")}</Text>
              ) : null}
              {isNotFactCheckable ? (
                <Text style={styles.notFactCheckableWarning}>
                  This appears to be an opinion or non-factual post. FactLens cannot verify it as True or Fake.
                </Text>
              ) : null}
              <Text style={styles.aiDisclaimer}>
                AI pre-check is only a risk signal. Community voting decides the final result.
              </Text>
              {canRetryAiPrecheck ? (
                <TouchableOpacity
                  style={[styles.aiRetryButton, (aiPrecheckLoading || aiEvidenceRecheckLoading) && styles.disabledButton]}
                  activeOpacity={0.85}
                  disabled={aiPrecheckLoading || aiEvidenceRecheckLoading}
                  onPress={handleRunAiPrecheck}
                >
                  <Text style={styles.aiRetryButtonText}>
                    {aiPrecheckLoading ? "Checking..." : "Run AI Pre-check"}
                  </Text>
                </TouchableOpacity>
              ) : null}
              {hasEvidenceLinks ? (
                <TouchableOpacity
                  style={[styles.aiRetryButton, (aiPrecheckLoading || aiEvidenceRecheckLoading) && styles.disabledButton]}
                  activeOpacity={0.85}
                  disabled={aiPrecheckLoading || aiEvidenceRecheckLoading}
                  onPress={handleRecheckWithEvidence}
                >
                  <Text style={styles.aiRetryButtonText}>
                    {aiEvidenceRecheckLoading ? "Re-checking..." : "Re-check with Evidence"}
                  </Text>
                </TouchableOpacity>
              ) : null}
              {aiPrecheckMessage ? <Text style={styles.aiRetryMessage}>{aiPrecheckMessage}</Text> : null}
              {aiPrecheckError ? <Text style={styles.aiRetryError}>{aiPrecheckError}</Text> : null}
            </View>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Author</Text>
          <View style={styles.authorHeaderRow}>
            <View style={styles.authorInfo}>
              <Text style={styles.authorName}>{claim.authorDisplayName}</Text>
              <Text style={styles.authorText}>@{claim.authorUsername}</Text>
            </View>
            {claim.authorVerified ? <Text style={styles.verifiedBadge}>Verified</Text> : null}
          </View>
          {/* PHASE 4 STEP 12 */}
          <Text style={styles.authorText}>Reputation score: {claim.authorReputation}</Text>

          {isOwner ? (
            <View style={styles.ownerActionRow}>
              <TouchableOpacity
                style={styles.ownerButton}
                activeOpacity={0.8}
                onPress={() => Alert.alert("Edit claim will be added later.")}
              >
                <Text style={styles.ownerButtonText}>Edit Claim</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.ownerButton, styles.deleteButton]}
                activeOpacity={0.8}
                onPress={() => Alert.alert("Delete claim will be added later.")}
              >
                <Text style={styles.deleteButtonText}>Delete Claim</Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Description</Text>
          <Text style={styles.description}>{claim.description}</Text>
          {claim.category ? <Text style={styles.category}>{claim.category}</Text> : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Main Source</Text>
          <Text style={styles.sourceUrl} selectable>
            {claim.sourceUrl}
          </Text>
          <View style={styles.sourceQualityPanel}>
            <SourceQualityBadge quality={mainSourceQuality} showScore />
            <Text style={styles.sourceQualityReason}>Source quality: {formatSourceQualityLabel(claim.sourceQuality)}</Text>
            <Text style={styles.sourceQualityReason}>Source score: {formatSourceCredibilityScore(claim.sourceScore)}</Text>
            <Text style={styles.sourceQualityReason}>Source domain: {claim.sourceDomain || "Pending"}</Text>
            <Text style={styles.sourceQualityReason}>Political lean: {claim.sourceLean || mainSourceQuality.lean || "Unknown"}</Text>
            <Text style={styles.sourceQualityReason}>Source reason: {claim.sourceReason || "Source score pending."}</Text>
            {sourceNeedsEvidence ? (
              <Text style={styles.sourceWarning}>Source needs stronger supporting evidence.</Text>
            ) : null}
            <Text style={styles.sourceQualityReason}>{mainSourceQuality.reason}</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Share Link</Text>
          <Text style={styles.sourceUrl} selectable>
            {claim.shareUrl}
          </Text>
          <TouchableOpacity
            style={styles.copyButton}
            activeOpacity={0.8}
            onPress={() => Alert.alert("Share link copied.")}
          >
            <Text style={styles.copyButtonText}>Copy Share Link</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Media</Text>
          {mediaUrl || claim.media.imageUrl ? (
            <View style={styles.mediaList}>
              {/* PHASE 3 STEP 7 */}
              {claim.media.imageUrl ? (
                <Image source={{ uri: claim.media.imageUrl }} style={styles.detailImage} resizeMode="cover" />
              ) : null}
              {/* PHASE 3 STEP 8 */}
              {mediaUrl && mediaPlatform ? (
                <View style={styles.videoDetailPanel}>
                  <Text style={styles.videoPlatformBadge}>{mediaPlatform}</Text>
                  {claim.media.youtubeThumbnailUrl ? (
                    <View style={styles.detailThumbnailWrap}>
                      <Image
                        source={{ uri: claim.media.youtubeThumbnailUrl }}
                        style={styles.detailVideoThumbnail}
                        resizeMode="cover"
                      />
                      <View style={styles.detailPlayOverlay}>
                        <Ionicons name="play" size={24} color={theme.colors.background} />
                      </View>
                    </View>
                  ) : null}
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => {
                      Linking.openURL(mediaUrl).catch(() => {
                        Alert.alert("We could not open this link.");
                      });
                    }}
                  >
                    <Text style={styles.mediaLinkText} selectable>
                      {mediaUrl}
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : null}
            </View>
          ) : (
            <Text style={styles.placeholder}>No image or video attached yet.</Text>
          )}
          <Text style={styles.mediaNote}>Video upload and real image moderation will be added later.</Text>
        </View>

        <View style={styles.compactCard}>
          <View style={styles.reportRowCompact}>
            <Text style={styles.reportInlineLabel}>Flag as</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.reportChipRow}
              style={styles.reportChipScroller}
            >
              {compactReportReasons.map((reason) => {
                const selected = reportReason === reason.value;

                return (
                  <TouchableOpacity
                    key={reason.value}
                    style={[styles.reasonButton, selected && styles.reasonButtonSelected]}
                    activeOpacity={0.8}
                    onPress={() => {
                      setReportReason(reason.value);
                      setReportSuccess(false);
                      setReportError("");
                    }}
                  >
                    <Text style={[styles.reasonButtonText, selected && styles.reasonButtonTextSelected]}>
                      {reason.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <TouchableOpacity
              style={[styles.reportIconButton, reportSubmitting && styles.disabledButton]}
              activeOpacity={0.8}
              onPress={handleSubmitReport}
              disabled={reportSubmitting}
            >
              <Ionicons name="flag-outline" size={14} color={theme.colors.background} />
            </TouchableOpacity>
          </View>
          {reportLoading ? <Text style={styles.reportMetaText}>Loading reports...</Text> : null}
          {userReport ? <Text style={styles.reportMetaText}>You already reported this claim.</Text> : null}
          {claim.reportCount > 0 ? (
            <Text style={styles.reportMetaText}>
              {claim.reportCount} {claim.reportCount === 1 ? "report" : "reports"}
            </Text>
          ) : null}
          {reportError ? <Text style={styles.errorText}>{reportError}</Text> : null}
          {reportSuccess ? <Text style={styles.reportSuccess}>Report submitted.</Text> : null}
        </View>

        <View style={styles.card}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.labelNoMargin}>Evidence</Text>
            <Text style={styles.countBadge}>
              {evidenceCount} {evidenceCount === 1 ? "link" : "links"}
            </Text>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Evidence URL</Text>
            <TextInput
              value={evidenceUrl}
              onChangeText={(value) => updateEvidenceField("url", value)}
              placeholder="https://example.com/source"
              style={[styles.input, evidenceErrors.url && styles.inputError]}
              placeholderTextColor={theme.colors.muted}
              keyboardType="url"
              autoCapitalize="none"
              autoCorrect={false}
            />
            {evidenceErrors.url ? <Text style={styles.errorText}>{evidenceErrors.url}</Text> : null}
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Short note</Text>
            <TextInput
              value={evidenceNote}
              onChangeText={(value) => updateEvidenceField("note", value)}
              placeholder="Explain what this source adds"
              style={[styles.input, styles.textArea, evidenceErrors.note && styles.inputError]}
              placeholderTextColor={theme.colors.muted}
              multiline
            />
            {evidenceErrors.note ? <Text style={styles.errorText}>{evidenceErrors.note}</Text> : null}
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Evidence type</Text>
            <View style={styles.typeGrid}>
              {evidenceTypeOptions.map((option) => {
                const config = evidenceTypeConfig[option];
                const selected = evidenceType === option;

                return (
                  <TouchableOpacity
                    key={option}
                    style={[
                      styles.typeButton,
                      selected && {
                        backgroundColor: config.backgroundColor,
                        borderColor: config.color,
                      },
                    ]}
                    activeOpacity={0.8}
                    onPress={() => setEvidenceType(option)}
                  >
                    <Text style={[styles.typeButtonText, selected && { color: config.color }]}>{config.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {evidenceError ? <Text style={styles.errorText}>{evidenceError}</Text> : null}
          {evidenceSuccess ? <Text style={styles.reportSuccess}>{evidenceSuccess}</Text> : null}

          <TouchableOpacity
            style={[styles.addEvidenceButton, evidenceSubmitLoading && styles.disabledButton]}
            onPress={handleAddEvidence}
            activeOpacity={0.8}
            disabled={evidenceSubmitLoading}
          >
            <Text style={styles.addEvidenceButtonText}>
              {evidenceSubmitLoading ? "Saving Evidence..." : "Add Evidence"}
            </Text>
          </TouchableOpacity>

          <View style={styles.evidenceList}>
            {evidenceLoading ? <Text style={styles.placeholder}>Loading evidence...</Text> : null}
            {!evidenceLoading && claim.evidence.length > 0 ? (
              claim.evidence.map((item) => {
                const config = evidenceTypeConfig[item.type];
                const sourceQuality = getEvidenceSourceQuality(item);

                return (
                  <View key={item.id} style={styles.evidenceItem}>
                    <Text
                      style={[
                        styles.evidenceBadge,
                        {
                          backgroundColor: config.backgroundColor,
                          color: config.color,
                        },
                      ]}
                    >
                      {config.label}
                    </Text>
                    <Text style={styles.evidenceUrl} selectable>
                      {item.url}
                    </Text>
                    <View style={styles.evidenceQuality}>
                      <SourceQualityBadge quality={sourceQuality} showScore />
                      <Text style={styles.sourceQualityReason}>{sourceQuality.reason}</Text>
                    </View>
                    <Text style={styles.evidenceNote}>{item.note}</Text>
                    <Text style={styles.evidenceTime}>{new Date(item.createdAt).toLocaleString()}</Text>
                  </View>
                );
              })
            ) : null}
            {!evidenceLoading && claim.evidence.length === 0 ? (
              <Text style={styles.placeholder}>No evidence links added yet.</Text>
            ) : null}
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Test voting window</Text>
          <PhaseStatusRow timeLabel={timeLabel} phaseLabel={phaseLabel} />
          <Text style={styles.date}>Posted {new Date(claim.createdAt).toLocaleString()}</Text>
          <Text style={styles.date}>Voting closes {new Date(voteWindowClosesAt).toLocaleString()}</Text>
          <Text style={styles.date}>Verdict locks {new Date(scoreLockAt).toLocaleString()}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Verification Engine</Text>
          <View style={styles.engineGrid}>
            <View style={styles.engineItem}>
              <Text style={styles.engineLabel}>Mode</Text>
              <Text style={styles.engineValue}>{claim.mode === "test" ? "Test" : "Production"}</Text>
            </View>
            <View style={styles.engineItem}>
              <Text style={styles.engineLabel}>Current phase</Text>
              <Text style={styles.engineValue}>{claim.currentPhase}</Text>
            </View>
            <View style={styles.engineItem}>
              <Text style={styles.engineLabel}>Vote count / minimum</Text>
              <Text style={styles.engineValue}>
                {totalVotes}/{claim.minVotesRequired}
              </Text>
            </View>
            <View style={styles.engineItem}>
              <Text style={styles.engineLabel}>AI confidence</Text>
              <Text style={styles.engineValue}>{formatPercent(claim.aiCheck.confidence)}</Text>
            </View>
            <View style={styles.engineItem}>
              <Text style={styles.engineLabel}>Weighted community</Text>
              <Text style={styles.engineValue}>{formatPercent(claim.weightedCommunityScore)}</Text>
            </View>
            <View style={styles.engineItem}>
              <Text style={styles.engineLabel}>Final score</Text>
              <Text style={styles.engineValue}>{formatPercent(claim.finalScore)}</Text>
            </View>
            <View style={styles.engineItem}>
              <Text style={styles.engineLabel}>Early verdict</Text>
              <Text style={styles.engineValue}>{claim.earlyVerdictFired ? "Fired" : "No"}</Text>
            </View>
            <View style={styles.engineItem}>
              <Text style={styles.engineLabel}>Phase 4 lock</Text>
              <Text style={styles.engineValue}>{claim.phase4Locked ? "Locked" : "Open"}</Text>
            </View>
            <View style={styles.engineItem}>
              <Text style={styles.engineLabel}>Suspicious activity</Text>
              <Text style={styles.engineValue}>{claim.suspiciousActivity ? "Flagged" : "No"}</Text>
            </View>
            <View style={styles.engineItemWide}>
              <Text style={styles.engineLabel}>Verdict</Text>
              <Text style={styles.engineValue}>{engineVerdict}</Text>
            </View>
          </View>
        </View>

        {votingOpen ? (
          <View style={styles.card}>
            <Text style={styles.label}>Cast Your Vote</Text>
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

        {!votingOpen && verdictTitle ? (
          <View style={styles.card}>
            <Text style={styles.label}>System verdict</Text>
            <StatusBadge status={claim.status === "OPEN" ? automaticVerdict?.status ?? "NEEDS_MORE_EVIDENCE" : claim.status} />
            <Text style={styles.verdictTitle}>{verdictTitle}</Text>
            {verdictReason ? <Text style={styles.verdictReason}>{verdictReason}</Text> : null}
            <View style={styles.verdictMetaPanel}>
              <Text style={styles.verdictMetaText}>Total votes: {totalVotes}</Text>
              <Text style={styles.verdictMetaText}>Calculated: {verdictCalculatedText}</Text>
            </View>
          </View>
        ) : null}

        <View style={styles.card}>
          <VoteBreakdownBars
            votesTrue={claim.votesTrue}
            votesFake={claim.votesFake}
            votesUnsure={claim.votesUnsure}
            totalVotes={totalVotes}
          />
        </View>

        {votingOpen ? (
          <View style={styles.card}>
            <Text style={styles.label}>System verdict</Text>
            <Text style={styles.placeholder}>Result appears when voting closes.</Text>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.card,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    backgroundColor: theme.colors.navy,
    borderBottomWidth: 0,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "500",
    color: theme.colors.background,
  },
  headerSpacer: {
    width: 24,
  },
  content: {
    paddingHorizontal: 10,
    paddingTop: 10,
    paddingBottom: theme.spacing.xl,
  },
  // PHASE 3 STEP 12
  liveText: {
    alignSelf: "flex-start",
    backgroundColor: "#DCFCE7",
    borderColor: "#BBF7D0",
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    color: theme.colors.success,
    fontSize: theme.typography.small.fontSize,
    fontWeight: "500",
    marginBottom: theme.spacing.md,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
  },
  card: {
    backgroundColor: theme.colors.background,
    borderRadius: theme.radius.md,
    padding: 14,
    marginBottom: 10,
    borderWidth: 0.5,
    borderColor: theme.colors.lightBorder,
  },
  cardFlush: {
    backgroundColor: theme.colors.background,
    borderColor: theme.colors.lightBorder,
    borderRadius: theme.radius.md,
    borderWidth: 0.5,
    marginBottom: 10,
    overflow: "hidden",
  },
  compactCard: {
    backgroundColor: theme.colors.background,
    borderColor: theme.colors.lightBorder,
    borderRadius: theme.radius.md,
    borderWidth: 0.5,
    marginBottom: 10,
    overflow: "hidden",
  },
  claimBody: {
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: theme.spacing.sm,
  },
  title: {
    flex: 1,
    fontSize: 15,
    fontWeight: "500",
    color: theme.colors.text,
    lineHeight: 21,
    marginRight: theme.spacing.md,
  },
  authorText: {
    fontSize: theme.typography.small.fontSize,
    color: theme.colors.subtext,
  },
  authorHeaderRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    justifyContent: "space-between",
    gap: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  authorInfo: {
    flex: 1,
  },
  authorName: {
    color: theme.colors.text,
    fontSize: theme.typography.title.fontSize,
    fontWeight: "500",
    marginBottom: theme.spacing.xs,
  },
  verifiedBadge: {
    backgroundColor: "#DCFCE7",
    borderColor: "#BBF7D0",
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    color: theme.colors.success,
    fontSize: theme.typography.small.fontSize,
    fontWeight: "500",
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
  },
  ownerActionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.sm,
    marginTop: theme.spacing.md,
  },
  ownerButton: {
    alignItems: "center",
    borderColor: theme.colors.primary,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    flexGrow: 1,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
  },
  deleteButton: {
    borderColor: theme.colors.danger,
  },
  ownerButtonText: {
    color: theme.colors.primary,
    fontSize: theme.typography.small.fontSize,
    fontWeight: "500",
  },
  deleteButtonText: {
    color: theme.colors.danger,
    fontSize: theme.typography.small.fontSize,
    fontWeight: "500",
  },
  aiPanel: {
    backgroundColor: theme.colors.card,
    borderColor: theme.colors.lightBorder,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    marginTop: theme.spacing.md,
    padding: theme.spacing.md,
  },
  aiTitle: {
    color: theme.colors.primary,
    fontSize: theme.typography.small.fontSize,
    fontWeight: "500",
    marginBottom: theme.spacing.xs,
  },
  aiText: {
    color: theme.colors.subtext,
    fontSize: theme.typography.small.fontSize,
    lineHeight: theme.typography.small.lineHeight,
  },
  aiDetailPanel: {
    backgroundColor: theme.colors.aiBg,
    borderRadius: theme.radius.sm,
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  aiDetailTitle: {
    color: theme.colors.ai,
    fontSize: 12,
    fontWeight: "500",
  },
  aiDetailGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  aiDetailItem: {
    flexBasis: "48%",
    flexGrow: 1,
  },
  aiDetailLabel: {
    color: theme.colors.subtext,
    fontSize: 10,
  },
  aiDetailValue: {
    color: theme.colors.ai,
    fontSize: 16,
    fontWeight: "500",
    marginTop: 2,
  },
  aiRedFlags: {
    color: theme.colors.danger,
    fontSize: 11,
    lineHeight: 15,
  },
  aiDisclaimer: {
    color: theme.colors.subtext,
    fontSize: 11,
    lineHeight: 15,
  },
  // PHASE 4 STEP 2
  aiRetryButton: {
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: theme.colors.ai,
    borderRadius: theme.radius.sm,
    marginTop: 2,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  aiRetryButtonText: {
    color: theme.colors.background,
    fontSize: 12,
    fontWeight: "500",
  },
  aiRetryMessage: {
    color: theme.colors.success,
    fontSize: 11,
    fontWeight: "500",
  },
  aiRetryError: {
    color: theme.colors.danger,
    fontSize: 11,
    fontWeight: "500",
  },
  notFactCheckableWarning: {
    color: theme.colors.warning,
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 17,
  },
  sourceWarning: {
    color: theme.colors.warning,
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 17,
  },
  flaggedBadge: {
    alignSelf: "flex-start",
    backgroundColor: theme.colors.dangerBg,
    borderRadius: 999,
    color: theme.colors.danger,
    fontSize: 11,
    fontWeight: "500",
    marginBottom: theme.spacing.sm,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  label: {
    fontSize: 12,
    fontWeight: "500",
    color: theme.colors.subtext,
    marginBottom: theme.spacing.md,
  },
  labelNoMargin: {
    fontSize: 12,
    fontWeight: "500",
    color: theme.colors.subtext,
  },
  description: {
    fontSize: 14,
    color: theme.colors.text,
    lineHeight: 20,
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
  claimTypeBadge: {
    alignSelf: "flex-start",
    backgroundColor: theme.colors.warningBg,
    borderRadius: 999,
    color: theme.colors.warning,
    fontSize: 11,
    fontWeight: "500",
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  sourceUrl: {
    color: theme.colors.link,
    flex: 1,
    fontSize: 12,
  },
  sourceLinkRow: {
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
  sourceQualityPanel: {
    backgroundColor: theme.colors.card,
    borderColor: theme.colors.lightBorder,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    gap: theme.spacing.sm,
    marginTop: theme.spacing.md,
    padding: theme.spacing.md,
  },
  sourceQualityReason: {
    color: theme.colors.subtext,
    fontSize: theme.typography.small.fontSize,
    lineHeight: theme.typography.small.lineHeight,
  },
  copyButton: {
    alignItems: "center",
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.sm,
    marginTop: theme.spacing.md,
    paddingVertical: theme.spacing.md,
  },
  copyButtonText: {
    color: theme.colors.background,
    fontSize: theme.typography.body.fontSize,
    fontWeight: "500",
  },
  mediaList: {
    gap: theme.spacing.sm,
  },
  mediaLinkText: {
    color: theme.colors.primary,
    fontSize: theme.typography.small.fontSize,
    lineHeight: theme.typography.small.lineHeight,
  },
  detailImage: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.sm,
    height: 260,
    width: "100%",
  },
  videoDetailPanel: {
    backgroundColor: theme.colors.card,
    borderColor: theme.colors.lightBorder,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    gap: theme.spacing.md,
    overflow: "hidden",
    padding: theme.spacing.md,
  },
  videoPlatformBadge: {
    alignSelf: "flex-start",
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
  detailThumbnailWrap: {
    position: "relative",
  },
  detailVideoThumbnail: {
    backgroundColor: theme.colors.background,
    borderRadius: theme.radius.sm,
    height: 210,
    width: "100%",
  },
  detailPlayOverlay: {
    alignItems: "center",
    backgroundColor: "rgba(15, 23, 42, 0.72)",
    borderRadius: 26,
    height: 52,
    justifyContent: "center",
    left: "50%",
    marginLeft: -26,
    marginTop: -26,
    position: "absolute",
    top: "50%",
    width: 52,
  },
  mediaNote: {
    color: theme.colors.subtext,
    fontSize: theme.typography.small.fontSize,
    lineHeight: theme.typography.small.lineHeight,
    marginTop: theme.spacing.md,
  },
  sectionHeaderRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: theme.spacing.md,
  },
  countBadge: {
    backgroundColor: theme.colors.card,
    borderColor: theme.colors.lightBorder,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    color: theme.colors.primary,
    fontSize: theme.typography.small.fontSize,
    fontWeight: "500",
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
  },
  reportCountBadge: {
    backgroundColor: "#FEE2E2",
    borderColor: "#FECACA",
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    color: theme.colors.danger,
    fontSize: theme.typography.small.fontSize,
    fontWeight: "500",
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
  },
  reportHelp: {
    color: theme.colors.subtext,
    fontSize: theme.typography.small.fontSize,
    lineHeight: theme.typography.small.lineHeight,
    marginBottom: theme.spacing.md,
  },
  reportAlready: {
    color: theme.colors.warning,
    fontSize: theme.typography.small.fontSize,
    fontWeight: "500",
    marginBottom: theme.spacing.md,
  },
  fieldGroup: {
    marginBottom: theme.spacing.md,
  },
  fieldLabel: {
    color: theme.colors.text,
    fontSize: theme.typography.small.fontSize,
    fontWeight: "500",
    marginBottom: theme.spacing.sm,
  },
  input: {
    backgroundColor: theme.colors.background,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    color: theme.colors.text,
    fontSize: theme.typography.body.fontSize,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
  },
  inputError: {
    borderColor: theme.colors.danger,
  },
  errorText: {
    color: theme.colors.danger,
    fontSize: theme.typography.small.fontSize,
    marginTop: theme.spacing.sm,
  },
  textArea: {
    minHeight: 88,
    textAlignVertical: "top",
  },
  typeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.sm,
  },
  reasonGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  reasonButton: {
    borderColor: theme.colors.border,
    borderRadius: 999,
    borderWidth: 0.5,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  reasonButtonSelected: {
    backgroundColor: theme.colors.dangerBg,
    borderColor: "#F09595",
  },
  reasonButtonText: {
    color: theme.colors.subtext,
    fontSize: 11,
    fontWeight: "400",
  },
  reasonButtonTextSelected: {
    color: theme.colors.danger,
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
  },
  reportChipScroller: {
    flex: 1,
  },
  reportChipRow: {
    alignItems: "center",
    gap: 6,
  },
  reportIconButton: {
    alignItems: "center",
    backgroundColor: theme.colors.danger,
    borderRadius: 8,
    justifyContent: "center",
    padding: 10,
  },
  reportMetaText: {
    color: theme.colors.subtext,
    fontSize: 11,
    paddingHorizontal: 14,
    paddingTop: 8,
  },
  reportNoteInput: {
    minHeight: 88,
    textAlignVertical: "top",
  },
  submitReportButton: {
    alignItems: "center",
    backgroundColor: theme.colors.danger,
    borderRadius: theme.radius.sm,
    marginTop: theme.spacing.md,
    paddingVertical: theme.spacing.md,
  },
  submitReportButtonText: {
    color: theme.colors.background,
    fontSize: theme.typography.body.fontSize,
    fontWeight: "500",
  },
  reportSuccess: {
    color: theme.colors.success,
    fontSize: theme.typography.small.fontSize,
    fontWeight: "500",
    marginTop: theme.spacing.md,
  },
  typeButton: {
    borderColor: theme.colors.border,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  typeButtonText: {
    color: theme.colors.subtext,
    fontSize: theme.typography.small.fontSize,
    fontWeight: "500",
  },
  addEvidenceButton: {
    alignItems: "center",
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.sm,
    paddingVertical: theme.spacing.md,
  },
  disabledButton: {
    opacity: 0.55,
  },
  addEvidenceButtonText: {
    color: theme.colors.background,
    fontSize: theme.typography.body.fontSize,
    fontWeight: "500",
  },
  evidenceList: {
    marginTop: theme.spacing.lg,
  },
  evidenceItem: {
    borderTopColor: theme.colors.lightBorder,
    borderTopWidth: 1,
    paddingVertical: theme.spacing.md,
  },
  evidenceBadge: {
    alignSelf: "flex-start",
    borderRadius: theme.radius.sm,
    fontSize: theme.typography.small.fontSize,
    fontWeight: "500",
    marginBottom: theme.spacing.sm,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
  },
  evidenceUrl: {
    color: theme.colors.primary,
    fontSize: theme.typography.small.fontSize,
    marginBottom: theme.spacing.sm,
  },
  evidenceQuality: {
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
  },
  evidenceNote: {
    color: theme.colors.text,
    fontSize: theme.typography.body.fontSize,
    lineHeight: theme.typography.body.lineHeight,
    marginBottom: theme.spacing.xs,
  },
  evidenceTime: {
    color: theme.colors.subtext,
    fontSize: theme.typography.small.fontSize,
  },
  date: {
    fontSize: theme.typography.body.fontSize,
    color: theme.colors.subtext,
    marginTop: theme.spacing.sm,
  },
  windowPanel: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing.md,
    padding: theme.spacing.md,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.lightBorder,
  },
  windowCaption: {
    fontSize: theme.typography.small.fontSize,
    color: theme.colors.subtext,
    marginBottom: theme.spacing.xs,
  },
  windowValue: {
    fontSize: 22,
    fontWeight: "500",
    color: theme.colors.primary,
  },
  closedValue: {
    color: theme.colors.subtext,
  },
  voteHint: {
    marginTop: theme.spacing.md,
    fontSize: theme.typography.small.fontSize,
    color: theme.colors.subtext,
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
  voteRowDetailed: {
    gap: theme.spacing.md,
  },
  voteItemDetailed: {
    gap: theme.spacing.xs,
  },
  voteLabelDetailed: {
    fontSize: theme.typography.small.fontSize,
    color: theme.colors.subtext,
  },
  voteValueDetailed: {
    fontSize: 20,
    fontWeight: "500",
    color: theme.colors.text,
  },
  voteBarTrack: {
    height: 6,
    overflow: "hidden",
    borderRadius: 3,
    backgroundColor: theme.colors.lightBorder,
  },
  voteBar: {
    height: 6,
    borderRadius: 3,
  },
  // PHASE 3 STEP 17
  engineGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.sm,
  },
  engineItem: {
    backgroundColor: theme.colors.phaseBg,
    borderColor: theme.colors.lightBorder,
    borderRadius: theme.radius.sm,
    borderWidth: 0.5,
    flexBasis: "48%",
    flexGrow: 1,
    gap: theme.spacing.xs,
    padding: theme.spacing.md,
  },
  engineItemWide: {
    backgroundColor: theme.colors.phaseBg,
    borderColor: theme.colors.lightBorder,
    borderRadius: theme.radius.sm,
    borderWidth: 0.5,
    flexBasis: "100%",
    gap: theme.spacing.xs,
    padding: theme.spacing.md,
  },
  engineLabel: {
    color: theme.colors.phaseText,
    fontSize: 11,
    fontWeight: "400",
  },
  engineValue: {
    color: theme.colors.navy,
    fontSize: 18,
    fontWeight: "500",
  },
  verdictTitle: {
    color: theme.colors.text,
    fontSize: 22,
    fontWeight: "500",
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.xs,
  },
  verdictReason: {
    fontSize: theme.typography.small.fontSize,
    color: theme.colors.subtext,
    lineHeight: theme.typography.small.lineHeight,
  },
  verdictMetaPanel: {
    backgroundColor: theme.colors.card,
    borderColor: theme.colors.lightBorder,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    gap: theme.spacing.xs,
    marginTop: theme.spacing.md,
    padding: theme.spacing.md,
  },
  verdictMetaText: {
    color: theme.colors.subtext,
    fontSize: theme.typography.small.fontSize,
    fontWeight: "500",
  },
  placeholder: {
    fontSize: theme.typography.body.fontSize,
    color: theme.colors.muted,
    fontStyle: "italic",
  },
});
