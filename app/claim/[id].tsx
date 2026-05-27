// PHASE 1 STEP 4
import { useEffect, useState } from "react";
import { Alert, Image, Linking, View, Text, ScrollView, StyleSheet, SafeAreaView, TouchableOpacity, TextInput } from "react-native";
import type { DimensionValue } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { EmptyState } from "../../components/EmptyState";
import { SourceQualityBadge } from "../../components/SourceQualityBadge";
import { StatusBadge } from "../../components/StatusBadge";
import { VoteButtons } from "../../components/VoteButtons";
import { useAuth } from "../../context/AuthContext";
import { useClaims } from "../../context/ClaimsContext";
import { reportReasons } from "../../constants/reportReasons";
import { calculateAutomaticVerdict, getTimeRemaining, isVotingOpen } from "../../services/claimVoting";
import { getSourceQuality, type SourceQuality } from "../../services/sourceQuality";
import {
  subscribeToClaimById,
  subscribeToEvidenceForClaim,
  subscribeToReportsForClaim,
  subscribeToVotesForClaim,
  unsubscribe,
} from "../../services/realtimeService";
import type { Evidence, EvidenceType, ReportReason, VoteOption } from "../../types/claim";
import { theme } from "../../constants/theme";

// PHASE 2 STEP 4
type EvidenceFieldName = "url" | "note";
type EvidenceErrors = Partial<Record<EvidenceFieldName, string>>;

const evidenceTypeOptions: EvidenceType[] = ["SUPPORTS_TRUE", "SUPPORTS_FAKE", "ADDS_CONTEXT", "UNCLEAR"];

const evidenceTypeConfig: Record<EvidenceType, { label: string; backgroundColor: string; color: string }> = {
  SUPPORTS_TRUE: {
    label: "Supports True",
    backgroundColor: "#DCFCE7",
    color: theme.colors.success,
  },
  SUPPORTS_FAKE: {
    label: "Supports Fake",
    backgroundColor: "#FEE2E2",
    color: theme.colors.danger,
  },
  ADDS_CONTEXT: {
    label: "Adds Context",
    backgroundColor: "#E0E7FF",
    color: theme.colors.primary,
  },
  UNCLEAR: {
    label: "Unclear",
    backgroundColor: "#FEF3C7",
    color: theme.colors.warning,
  },
};

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
  };
}

export default function ClaimDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
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
  // PHASE 3 STEP 12
  const [liveUpdatesOn, setLiveUpdatesOn] = useState(false);

  const claimId = Array.isArray(id) ? id[0] : id;
  const claim = claimId ? getClaimById(claimId) : undefined;
  // PHASE 3 STEP 6
  const userReport = claim && currentUser ? claim.reports.find((report) => report.userId === currentUser.id) : undefined;

  // PHASE 3 STEP 3
  useEffect(() => {
    if (!claimId || claim) {
      return;
    }

    let mounted = true;
    setDetailLoading(true);
    setDetailError("");

    fetchClaimById(claimId)
      .then((loadedClaim) => {
        if (mounted && !loadedClaim) {
          setDetailError("Claim not found.");
        }
      })
      .catch(() => {
        if (mounted) {
          setDetailError("We could not load this claim. Please try again.");
        }
      })
      .finally(() => {
        if (mounted) {
          setDetailLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [claim, claimId, fetchClaimById]);

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
  };

  const validateEvidence = (): EvidenceErrors => {
    const nextErrors: EvidenceErrors = {};
    const trimmedUrl = evidenceUrl.trim();
    const trimmedNote = evidenceNote.trim();

    if (!trimmedUrl) {
      nextErrors.url = "Evidence URL is required.";
    } else if (!/^https?:\/\//i.test(trimmedUrl)) {
      nextErrors.url = "Evidence URL must start with http:// or https://.";
    }

    if (!trimmedNote) {
      nextErrors.note = "Short note is required.";
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
    const nextErrors = validateEvidence();

    if (Object.keys(nextErrors).length > 0) {
      setEvidenceErrors(nextErrors);
      return;
    }

    setEvidenceSubmitLoading(true);

    try {
      await addEvidence(claim.id, {
        url: evidenceUrl,
        note: evidenceNote,
        type: evidenceType,
      });
      setEvidenceUrl("");
      setEvidenceNote("");
      setEvidenceType("ADDS_CONTEXT");
      setEvidenceErrors({});
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

    try {
      await voteOnClaim(claim.id, vote);
    } catch (error) {
      setVoteError(error instanceof Error ? error.message : "We could not save your vote. Please try again.");
    }
  };

  if (!claim) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
            <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Claim Details</Text>
          <View style={styles.headerSpacer} />
        </View>
        <EmptyState message={detailLoading ? "Loading claim..." : detailError || "Claim not found."} />
      </SafeAreaView>
    );
  }

  const currentVoteTotal = claim.votesTrue + claim.votesFake + claim.votesUnsure;
  const totalVotes = claim.verdictCalculatedAt ? claim.totalVotes : currentVoteTotal;
  const votingOpen = claim.status === "OPEN" && isVotingOpen(claim);
  const voteDisabled = !votingOpen || !isAuthenticated || !isVerified;
  const automaticVerdict = votingOpen ? undefined : calculateAutomaticVerdict(claim);
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
  // PHASE 3 STEP 5
  const evidenceCount = claim.evidenceCount ?? claim.evidence.length;
  // PHASE 3 STEP 1
  const isOwner = currentUser?.id === claim.authorId;
  // PHASE 2 STEP 5
  const mainSourceQuality = getSourceQuality(claim.sourceUrl);
  // PHASE 3 STEP 8
  const mediaUrl = claim.media.youtubeUrl ?? claim.media.videoUrl ?? null;
  const mediaPlatform = claim.media.videoPlatform ?? (claim.media.youtubeUrl ? "YouTube" : mediaUrl ? "Video Link" : null);
  const voteStats = [
    { label: "True", value: claim.votesTrue, color: theme.colors.success },
    { label: "Fake", value: claim.votesFake, color: theme.colors.danger },
    { label: "Not Sure", value: claim.votesUnsure, color: theme.colors.warning },
  ];
  const voteMessage = !votingOpen
    ? ""
    : !isAuthenticated
      ? "Log in to vote."
      : !isVerified
        ? "Verify your email to vote."
        : claim.userVote
          ? "Your vote is recorded. You can change it until voting closes."
          : "Choose one option before voting closes.";

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Claim Details</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* PHASE 3 STEP 12 */}
        {liveUpdatesOn ? <Text style={styles.liveText}>Live updates on</Text> : null}
        <View style={styles.card}>
          <View style={styles.titleRow}>
            <Text style={styles.title}>{claim.title}</Text>
            <StatusBadge status={claim.status} />
          </View>
          {claim.isFlagged ? <Text style={styles.flaggedBadge}>Flagged for Review</Text> : null}
          <View style={styles.aiPanel}>
            <Text style={styles.aiTitle}>AI Check: {aiCheckLabels[claim.aiCheck.status]}</Text>
            <Text style={styles.aiText}>
              {claim.aiCheck.reason ?? "AI pre-check is pending. No real AI API is connected yet."}
            </Text>
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
          <Text style={styles.authorText}>Reputation score: {claim.author.reputationScore}</Text>

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

        <View style={styles.card}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.labelNoMargin}>Report this claim</Text>
            {claim.reportCount > 0 ? (
              <Text style={styles.reportCountBadge}>
                {claim.reportCount} {claim.reportCount === 1 ? "report" : "reports"}
              </Text>
            ) : null}
          </View>
          <Text style={styles.reportHelp}>Flag spam, fake sources, duplicate claims, harmful content, or abuse.</Text>
          {reportLoading ? <Text style={styles.placeholder}>Loading reports...</Text> : null}
          {userReport ? <Text style={styles.reportAlready}>You already reported this claim.</Text> : null}
          <View style={styles.reasonGrid}>
            {reportReasons.map((reason) => {
              const selected = reportReason === reason;

              return (
                <TouchableOpacity
                  key={reason}
                  style={[styles.reasonButton, selected && styles.reasonButtonSelected]}
                  activeOpacity={0.8}
                  onPress={() => {
                    setReportReason(reason);
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
            style={[styles.input, styles.reportNoteInput]}
            multiline
          />
          <TouchableOpacity
            style={[styles.submitReportButton, reportSubmitting && styles.disabledButton]}
            activeOpacity={0.8}
            onPress={handleSubmitReport}
            disabled={reportSubmitting}
          >
            <Text style={styles.submitReportButtonText}>
              {reportSubmitting ? "Submitting report..." : "Submit report"}
            </Text>
          </TouchableOpacity>
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
          <Text style={styles.label}>24-hour voting window</Text>
          <View style={styles.windowPanel}>
            <View>
              <Text style={styles.windowCaption}>{votingOpen ? "Time remaining" : "Voting closed"}</Text>
              <Text style={[styles.windowValue, !votingOpen && styles.closedValue]}>
                {votingOpen ? getTimeRemaining(claim.expiresAt) : "Voting closed"}
              </Text>
            </View>
            <StatusBadge status={votingOpen ? "OPEN" : claim.status} />
          </View>
          <Text style={styles.date}>Posted {new Date(claim.createdAt).toLocaleString()}</Text>
          <Text style={styles.date}>Closes {new Date(claim.expiresAt).toLocaleString()}</Text>
        </View>

        {votingOpen ? (
          <View style={styles.card}>
            <Text style={styles.label}>Cast Your Vote</Text>
            <VoteButtons
              disabled={voteDisabled}
              userVote={claim.userVote}
              onVote={handleVote}
            />
            {voteMessage ? <Text style={styles.voteHint}>{voteMessage}</Text> : null}
            {voteError ? <Text style={styles.voteError}>{voteError}</Text> : null}
          </View>
        ) : null}

        {!votingOpen && verdictTitle ? (
          <View style={styles.card}>
            <Text style={styles.label}>System Verdict</Text>
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
          <Text style={styles.label}>{votingOpen ? "Vote Totals" : "Final Vote Breakdown"}</Text>
          <View style={styles.voteRowDetailed}>
            {voteStats.map((stat) => {
              const width: DimensionValue =
                totalVotes > 0 ? `${Math.max((stat.value / totalVotes) * 100, 8)}%` : "8%";

              return (
                <View key={stat.label} style={styles.voteItemDetailed}>
                  <Text style={styles.voteLabelDetailed}>{stat.label}</Text>
                  <Text style={styles.voteValueDetailed}>{stat.value}</Text>
                  <View style={styles.voteBarTrack}>
                    <View style={[styles.voteBar, { backgroundColor: stat.color, width }]} />
                  </View>
                </View>
              );
            })}
          </View>
        </View>

        {votingOpen ? (
          <View style={styles.card}>
            <Text style={styles.label}>System Verdict</Text>
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
    backgroundColor: theme.colors.background,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  headerTitle: {
    fontSize: theme.typography.title.fontSize,
    fontWeight: "700",
    color: theme.colors.text,
  },
  headerSpacer: {
    width: 24,
  },
  content: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
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
    fontWeight: "700",
    marginBottom: theme.spacing.md,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
  },
  card: {
    backgroundColor: theme.colors.background,
    borderRadius: theme.radius.md,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.md,
    ...theme.shadows.light,
    borderWidth: 1,
    borderColor: theme.colors.lightBorder,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: theme.spacing.sm,
  },
  title: {
    flex: 1,
    fontSize: theme.typography.title.fontSize,
    fontWeight: "700",
    color: theme.colors.text,
    lineHeight: theme.typography.title.lineHeight,
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
    fontWeight: "700",
    marginBottom: theme.spacing.xs,
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
    fontWeight: "700",
  },
  deleteButtonText: {
    color: theme.colors.danger,
    fontSize: theme.typography.small.fontSize,
    fontWeight: "700",
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
    fontWeight: "700",
    marginBottom: theme.spacing.xs,
  },
  aiText: {
    color: theme.colors.subtext,
    fontSize: theme.typography.small.fontSize,
    lineHeight: theme.typography.small.lineHeight,
  },
  flaggedBadge: {
    alignSelf: "flex-start",
    backgroundColor: "#FEE2E2",
    borderColor: "#FECACA",
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    color: theme.colors.danger,
    fontSize: theme.typography.small.fontSize,
    fontWeight: "700",
    marginBottom: theme.spacing.sm,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
  },
  label: {
    fontSize: theme.typography.body.fontSize,
    fontWeight: "700",
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
  },
  labelNoMargin: {
    fontSize: theme.typography.body.fontSize,
    fontWeight: "700",
    color: theme.colors.text,
  },
  description: {
    fontSize: theme.typography.body.fontSize,
    color: theme.colors.text,
    lineHeight: theme.typography.body.lineHeight,
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
    marginTop: theme.spacing.md,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
  },
  sourceUrl: {
    fontSize: theme.typography.body.fontSize,
    color: theme.colors.primary,
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
    fontWeight: "700",
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
    fontWeight: "700",
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
    fontWeight: "700",
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
    fontWeight: "700",
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
    fontWeight: "700",
    marginBottom: theme.spacing.md,
  },
  fieldGroup: {
    marginBottom: theme.spacing.md,
  },
  fieldLabel: {
    color: theme.colors.text,
    fontSize: theme.typography.small.fontSize,
    fontWeight: "700",
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
    fontWeight: "700",
  },
  reportSuccess: {
    color: theme.colors.success,
    fontSize: theme.typography.small.fontSize,
    fontWeight: "700",
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
    fontWeight: "700",
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
    fontWeight: "700",
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
    fontWeight: "700",
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
    fontWeight: "700",
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
  voteError: {
    color: theme.colors.danger,
    fontSize: theme.typography.small.fontSize,
    fontWeight: "700",
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
    fontWeight: "700",
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
  verdictTitle: {
    color: theme.colors.text,
    fontSize: 22,
    fontWeight: "700",
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
    fontWeight: "700",
  },
  placeholder: {
    fontSize: theme.typography.body.fontSize,
    color: theme.colors.muted,
    fontStyle: "italic",
  },
});
