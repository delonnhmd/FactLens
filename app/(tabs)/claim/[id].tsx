// APPLE GUIDELINE 1.2 — "Block user" added next to the report flow (NEW)
// JS-only change. Deploy: eas update --channel preview
// Do NOT run eas build. Apple review response pending.
// Backend deploys to Render independently.
// PHASE 1 STEP 4
// PHASE 3 STEP 28
// PHASE 3 STEP 32
// PHASE 4 STEP 6
// PHASE 4 STEP 7
// PHASE 4 STEP 8
// PHASE 4 STEP 9
// PHASE 4 STEP 10
// PHASE 4 STEP 15
// PHASE 4 STEP 18
// PHASE 4 STEP 18B
// PHASE 4 STEP 22
// PHASE 4 STEP 23
// PHASE 5 STEP 5 PRE-LAUNCH
// PHASE 5 STEP 6
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Image, Linking, View, Text, ScrollView, StyleSheet, SafeAreaView, Share, TouchableOpacity, TextInput } from "react-native";
import { useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { EmptyState } from "../../../components/EmptyState";
import { SourceQualityBadge } from "../../../components/SourceQualityBadge";
import { StatusBadge } from "../../../components/StatusBadge";
import { VoteButtons, getVoteOptionLabel } from "../../../components/VoteButtons";
import { AiCheckBadge } from "../../../components/AiCheckBadge";
import { PhaseStatusRow } from "../../../components/PhaseStatusRow";
import { VerdictBanner } from "../../../components/VerdictBanner";
import { VoteBreakdownBars } from "../../../components/VoteBreakdownBars";
import { MentionText } from "../../../components/MentionText";
import { MentionTextInput } from "../../../components/MentionTextInput";
import { FirstClaimCongratulationsModal } from "../../../components/onboarding/FirstClaimCongratulationsModal";
// Shared media block (image / YouTube thumb / link) — identical logic to the feed card.
import { ClaimMedia } from "../../../components/ClaimMedia";
import { resolveClaimMedia } from "../../../utils/claimMedia";
import { useAuth } from "../../../context/AuthContext";
import { useClaims } from "../../../context/ClaimsContext";
// Admin moderation: hide/unhide a claim from the detail screen (admins only).
import { hideClaimFromFeeds, unhideClaim } from "../../../services/moderationService";
import type { AppTheme } from "../../../context/DisplaySettingsContext";
import { useScrollAwareTabBar } from "../../../context/TabBarVisibilityContext";
import { useAppTheme } from "../../../hooks/useTheme";
// CLAIM TRANSLATION (NEW): shared with the feed card.
import { useClaimTranslation } from "../../../hooks/useClaimTranslation";
import { calculateAutomaticVerdict, getTimeRemaining, isVotingOpen } from "../../../services/claimVoting";
import {
  formatSourceCredibilityScore,
  getSourceMessage,
  getSourceQuality,
  getSourceTrustLabel,
  type SourceMessageColor,
  type SourceQuality,
} from "../../../services/sourceQuality";
import { getVoteAcceptUntil } from "../../../utils/verificationTiming";
import {
  cleanSourceReviewText,
  cleanUserError,
  SOURCE_REVIEW_UNAVAILABLE_BODY,
  SOURCE_REVIEW_UNAVAILABLE_NOTE,
  SOURCE_REVIEW_UNAVAILABLE_TITLE,
} from "../../../utils/debugError";
import {
  subscribeToClaimById,
  subscribeToEvidenceForClaim,
  subscribeToReportsForClaim,
  subscribeToVotesForClaim,
  unsubscribe,
} from "../../../services/realtimeService";
import type { Evidence, EvidenceType, ReportReason, VoteOption } from "../../../types/claim";
import { normalizeUrl } from "../../../utils/url";
import { getTopBadges } from "../../../utils/reputation";
// Author self-delete (NEW): 3-hour / finalization window rule (shared with feed).
import { canAuthorDeleteClaim, formatDeleteWindowRemaining, getClaimDeleteWindowMsRemaining } from "../../../utils/claimDeletion";
import { reportEvidence } from "../../../services/reportService";
// Report note step (shared with the feed card "..." menu)
import { ReportNoteModal } from "../../../components/ReportClaimFlow";
import {
  formatImageSize,
  pickImageFromCamera,
  pickImageFromLibrary,
  type PickedOptimizedImage,
} from "../../../services/imageUploadService";
import { EVIDENCE_MENTION_LIMIT, getMentionLimitError } from "../../../utils/mentions";

// PHASE 2 STEP 4
type EvidenceFieldName = "url" | "note";
type EvidenceErrors = Partial<Record<EvidenceFieldName, string>>;
const EVIDENCE_NOTE_MAX_LENGTH = 500;
const EVIDENCE_DOMAIN_PATTERN = /^(?:[a-z0-9-]+\.)+[a-z]{2,}$/i;

const evidenceTypeOptions: EvidenceType[] = ["SUPPORTS_TRUE", "SUPPORTS_FAKE", "ADDS_CONTEXT", "UNCLEAR"];

function getEvidenceTypeConfig(theme: AppTheme): Record<EvidenceType, { label: string; backgroundColor: string; color: string }> {
  return {
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
      color: theme.colors.warningText,
    },
  };
}

// PHASE 3 STEP 10
const verdictLabels = {
  // PHASE 4 STEP 26
  FINALIZED_TRUE: "Finalized true",
  FINALIZED_FAKE: "Finalized fake",
  INSUFFICIENT_DATA: "Insufficient data",
  // 24H MODEL: closed-but-unpublished claims are just waiting on the server
  // sweep (runs every ~10 min) — never a dead "Locked" state.
  LOCKED: "Finalizing verdict…",
  EARLY_VERDICT: "Early verdict candidate",
  ACTIVE: "Active voting",
  PENDING: "Pending",
  COMMUNITY_TRUE: "Community says true",
  COMMUNITY_FAKE: "Community says fake",
  NEEDS_MORE_EVIDENCE: "Needs more evidence",
  VOTING_CLOSED: "Finalizing verdict…",
  OPEN: "Open voting",
};

const compactReportReasons: Array<{ label: string; value: ReportReason }> = [
  { label: "Spam", value: "Spam" },
  { label: "Fake source", value: "Fake source" },
  { label: "Misleading", value: "Misleading title" },
  { label: "Duplicate", value: "Duplicate claim" },
  { label: "Abuse", value: "Harassment or abuse" },
  // PHASE 5 STEP 2
  { label: "Misinformation", value: "Misinformation abuse" },
  { label: "Explicit", value: "Explicit content" },
];

const CLAIM_REFETCH_DELAY_MS = 300;
const AI_SOURCE_REVIEW_RUNNING_MESSAGE = "Running AI source review...";
const AI_REVIEW_FALLBACK_MESSAGE = "AI review unavailable. Community verification can continue.";

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
    messageColor: fallbackQuality.messageColor,
  };
}

// PHASE 4 STEP 23
function sanitizeEvidenceNoteInput(value: string): string {
  return value.replace(/[<>]/g, "").slice(0, EVIDENCE_NOTE_MAX_LENGTH);
}

// PHASE 4 STEP 23
function isValidEvidenceUrl(input: string): boolean {
  const normalizedUrl = normalizeUrl(input);

  if (!/^https?:\/\//i.test(normalizedUrl)) {
    return false;
  }

  try {
    const parsedUrl = new URL(normalizedUrl);
    const hostname = parsedUrl.hostname.replace(/^www\./i, "").toLowerCase();

    return (
      (parsedUrl.protocol === "http:" || parsedUrl.protocol === "https:") &&
      !parsedUrl.username &&
      !parsedUrl.password &&
      Boolean(hostname) &&
      EVIDENCE_DOMAIN_PATTERN.test(hostname)
    );
  } catch {
    return false;
  }
}

// PHASE 4 STEP 23
function getEvidenceSourceDomain(url: string): string {
  try {
    return new URL(normalizeUrl(url)).hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return "Not verified";
  }
}

// PHASE 3 STEP 17
function formatPercent(value: number | null | undefined): string {
  const normalized = value === null || value === undefined ? 0.5 : value > 1 ? value / 100 : value;
  return `${Math.round(normalized * 100)}%`;
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

// PHASE 4 STEP 22
function getSourceReadStatusLabel(status: string | null | undefined): string {
  if (status === "read") {
    return "Source page read";
  }

  if (status === "failed") {
    return SOURCE_REVIEW_UNAVAILABLE_TITLE;
  }

  return "Source not checked yet.";
}

// PHASE 4 STEP 22
function getSourceSupportLabel(sourceSupportsClaim: boolean | null | undefined): string {
  if (sourceSupportsClaim === true) {
    return "Source appears to support this claim";
  }

  if (sourceSupportsClaim === false) {
    return "Source may not support this claim";
  }

  return "Source support unclear";
}

// PHASE 4 STEP 22
function getSourceSupportIcon(sourceSupportsClaim: boolean | null | undefined): "checkmark-circle-outline" | "alert-circle-outline" | "help-circle-outline" {
  if (sourceSupportsClaim === true) {
    return "checkmark-circle-outline";
  }

  if (sourceSupportsClaim === false) {
    return "alert-circle-outline";
  }

  return "help-circle-outline";
}

// PHASE 4 STEP 22
function getSourceSupportColor(sourceSupportsClaim: boolean | null | undefined, theme: AppTheme): string {
  if (sourceSupportsClaim === true) {
    return theme.colors.success;
  }

  if (sourceSupportsClaim === false) {
    return theme.colors.warning;
  }

  return theme.colors.subtext;
}

// PHASE 4 STEP 22
function getSourceSupportTextStyle(
  sourceSupportsClaim: boolean | null | undefined,
  styles: ReturnType<typeof createStyles>,
) {
  if (sourceSupportsClaim === true) {
    return styles.sourceSupportPositive;
  }

  if (sourceSupportsClaim === false) {
    return styles.sourceSupportWarning;
  }

  return styles.sourceSupportNeutral;
}

function getSourceMessageStyle(color: SourceMessageColor, styles: ReturnType<typeof createStyles>) {
  if (color === "green") {
    return styles.sourceMessageGreen;
  }

  if (color === "blue") {
    return styles.sourceMessageBlue;
  }

  if (color === "red") {
    return styles.sourceMessageRed;
  }

  return styles.sourceMessageAmber;
}

export default function ClaimDetailScreen() {
  const { id, firstClaim } = useLocalSearchParams<{ id?: string | string[]; firstClaim?: string }>();
  const router = useRouter();
  const navigation = useNavigation();
  const appTheme = useAppTheme();
  const styles = useMemo(() => createStyles(appTheme), [appTheme]);
  const evidenceTypeConfig = useMemo(() => getEvidenceTypeConfig(appTheme), [appTheme]);
  const { contentBottomPadding, showTabBar } = useScrollAwareTabBar();
  const contentContainerStyle = useMemo(
    () => [styles.content, { paddingBottom: contentBottomPadding }],
    [contentBottomPadding, styles.content],
  );
  // PHASE 2 STEP 9
  const { currentUser, isAuthenticated, isVerified, profile } = useAuth();
  // Admin moderation: hide/unhide + delete from the claim detail (admins only).
  const isAdmin = Boolean(profile?.is_admin);
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
    // APPLE GUIDELINE 1.2 — user blocking (NEW)
    blockUser,
    // Save/unsave claims
    savedClaimIds,
    toggleSaveClaim,
    // Author self-delete (3-hour window)
    deleteOwnClaim,
    // Admin moderation soft-delete (removes from feed state on success)
    adminDeleteClaim,
  } = useClaims();
  // PHASE 2 STEP 4
  const [evidenceUrl, setEvidenceUrl] = useState("");
  const [evidenceNote, setEvidenceNote] = useState("");
  const [evidenceType, setEvidenceType] = useState<EvidenceType>("ADDS_CONTEXT");
  // PHASE 5 STEP 6
  const [selectedEvidenceImage, setSelectedEvidenceImage] = useState<PickedOptimizedImage | null>(null);
  const [evidenceImageError, setEvidenceImageError] = useState("");
  const [evidenceErrors, setEvidenceErrors] = useState<EvidenceErrors>({});
  // PHASE 3 STEP 5
  const [evidenceLoading, setEvidenceLoading] = useState(false);
  const [evidenceSubmitLoading, setEvidenceSubmitLoading] = useState(false);
  const [evidenceError, setEvidenceError] = useState("");
  // PHASE 4 STEP 14
  const [evidenceSuccess, setEvidenceSuccess] = useState("");
  // PHASE 2 STEP 6
  const [reportReason, setReportReason] = useState<ReportReason>("Spam");
  // PHASE 4 STEP 16
  const [selectedReportReason, setSelectedReportReason] = useState<ReportReason | null>(null);
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
  // PHASE 4 STEP 24
  const [voteSubmitting, setVoteSubmitting] = useState(false);
  // PHASE 3 STEP 12
  const [liveUpdatesOn, setLiveUpdatesOn] = useState(false);
  // PHASE 5 PRE-LAUNCH: AI pre-check section collapsed by default, expands on tap.
  const [aiExpanded, setAiExpanded] = useState(false);
  // PHASE 4 STEP 15
  const detailFetchInFlightRef = useRef(false);
  const evidenceFetchInFlightRef = useRef(false);

  const claimId = Array.isArray(id) ? id[0] : id;
  const claim = claimId ? getClaimById(claimId) : undefined;
  const [showFirstClaimCongrats, setShowFirstClaimCongrats] = useState(firstClaim === "1");
  const closeFirstClaimCongrats = useCallback(() => {
    setShowFirstClaimCongrats(false);
    if (claimId) {
      router.replace(`/claim/${claimId}`);
    }
  }, [claimId, router]);
  const [authorAvatarLoadFailed, setAuthorAvatarLoadFailed] = useState(false);
  // CLAIM TRANSLATION (NEW): same hook the feed card uses, so the detail page
  // shows the identical translate → disclaimer → see-original flow. Called
  // before any early return with safe fallbacks (hooks must run every render).
  const translation = useClaimTranslation({
    id: claim?.id ?? "",
    title: claim?.title ?? "",
    description: claim?.description ?? "",
  });
  const evidenceNoteMentionLimitError = getMentionLimitError(
    evidenceNote,
    EVIDENCE_MENTION_LIMIT,
    "Evidence note",
  );
  // PHASE 3 STEP 6
  const userReport = claim && currentUser ? claim.reports.find((report) => report.userId === currentUser.id) : undefined;

  // PHASE 3 STEP 3
  // PHASE 3 STEP 32
  useEffect(() => {
    showTabBar();
  }, [showTabBar]);

  useEffect(() => {
    setAuthorAvatarLoadFailed(false);
  }, [claim?.authorAvatarUrl]);

  // PHASE 3 STEP 3
  // PHASE 3 STEP 32
  const refreshDetailClaim = useCallback(async (mountedRef?: { current: boolean }) => {
    if (!claimId) {
      return undefined;
    }

    // PHASE 4 STEP 15
    if (detailFetchInFlightRef.current) {
      console.log("[detail] fetch already running, skip");
      return undefined;
    }

    detailFetchInFlightRef.current = true;
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
        setDetailError("Could not load claim details.");
      }

      return undefined;
    } finally {
      if (!mountedRef || mountedRef.current) {
        setDetailLoading(false);
      }

      detailFetchInFlightRef.current = false;
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
        setEvidenceError("Could not load evidence.");
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
          setReportError("Could not load reports right now.");
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
        setDetailError("Could not load claim details.");
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
    // PHASE 4 STEP 15
    if (evidenceFetchInFlightRef.current) {
      console.log("[evidence] detail fetch already running, skip");
      return () => {
        mounted = false;
      };
    }

    evidenceFetchInFlightRef.current = true;
    setEvidenceLoading(true);
    setEvidenceError("");

    fetchEvidenceForClaim(claim.id)
      .catch((error) => {
        if (mounted) {
          setEvidenceError("Could not load evidence.");
        }
      })
      .finally(() => {
        if (mounted) {
          setEvidenceLoading(false);
        }

        evidenceFetchInFlightRef.current = false;
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
          setReportError("Could not load reports right now.");
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
  // PHASE 4 STEP 16
  useEffect(() => {
    setReportReason("Spam");
    setSelectedReportReason(null);
    setReportNote("");
    setReportSuccess(false);
    setReportError("");
  }, [claim?.id]);

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
      setEvidenceNote(sanitizeEvidenceNoteInput(value));
    }

    if (evidenceErrors[field]) {
      setEvidenceErrors((currentErrors) => ({ ...currentErrors, [field]: undefined }));
    }

    if (evidenceError || evidenceSuccess) {
      setEvidenceError("");
      setEvidenceSuccess("");
    }
  };

  // PHASE 5 STEP 6
  const handlePickEvidenceImageFromSource = async (source: "camera" | "library") => {
    setEvidenceImageError("");

    try {
      const image = source === "camera" ? await pickImageFromCamera() : await pickImageFromLibrary();

      if (image) {
        setSelectedEvidenceImage(image);
      }
    } catch (error) {
      setEvidenceImageError(error instanceof Error ? error.message : "Could not select this image right now.");
    }
  };

  // PHASE 5 STEP 6
  const handlePickEvidenceImage = () => {
    Alert.alert("Add evidence image", "Choose a source for this evidence image.", [
      {
        text: "Camera",
        onPress: () => {
          void handlePickEvidenceImageFromSource("camera");
        },
      },
      {
        text: "Photo Library",
        onPress: () => {
          void handlePickEvidenceImageFromSource("library");
        },
      },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const validateEvidence = (): EvidenceErrors => {
    const nextErrors: EvidenceErrors = {};
    const trimmedUrl = evidenceUrl.trim();
    const trimmedNote = evidenceNote.trim();

    if (!trimmedUrl) {
      nextErrors.url = "Evidence URL is required.";
    } else if (!isValidEvidenceUrl(trimmedUrl)) {
      nextErrors.url = "Please check the source URL.";
    }

    if (!trimmedNote) {
      // PHASE 4 STEP 14B
      nextErrors.note = "Evidence note is required.";
    } else if (trimmedNote.length < 10) {
      nextErrors.note = "Short note must be at least 10 characters.";
    } else if (trimmedNote.length > EVIDENCE_NOTE_MAX_LENGTH) {
      nextErrors.note = `Evidence note must be ${EVIDENCE_NOTE_MAX_LENGTH} characters or fewer.`;
    } else if (evidenceNoteMentionLimitError) {
      nextErrors.note = evidenceNoteMentionLimitError;
    }

    return nextErrors;
  };

  const handleAddEvidence = async () => {
    // PHASE 4 STEP 15
    if (!claim || evidenceSubmitLoading) {
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
        note: evidenceNote.replace(/\s+/g, " ").trim(),
        type: evidenceType,
        // PHASE 5 STEP 6
        imageAsset: selectedEvidenceImage,
      });
      setEvidenceUrl("");
      setEvidenceNote("");
      setEvidenceType("ADDS_CONTEXT");
      setSelectedEvidenceImage(null);
      setEvidenceImageError("");
      setEvidenceErrors({});
      setEvidenceSuccess("Evidence saved.");
    } catch (error) {
      setEvidenceError("Could not add evidence. Check the URL and try again.");
    } finally {
      setEvidenceSubmitLoading(false);
    }
  };

  // PHASE 4 STEP 23
  const handleOpenEvidenceSource = async (url: string) => {
    try {
      await Linking.openURL(normalizeUrl(url));
    } catch {
      Alert.alert("Could not open source.", "Check the evidence URL and try again.");
    }
  };

  // PHASE 5 STEP 2
  const handleReportEvidence = async (evidenceId: string) => {
    if (!currentUser) {
      Alert.alert("Log in to report evidence.");
      return;
    }

    if (!isVerified) {
      Alert.alert("Verify your email to report evidence.");
      return;
    }

    const result = await reportEvidence(evidenceId, currentUser.id, "Malicious evidence");

    if (result.error) {
      Alert.alert(cleanUserError(result.error));
      return;
    }

    Alert.alert("Report submitted.");
  };

  // Optional-note step shown between the reason chips and the submit call.
  const [reportNoteModalVisible, setReportNoteModalVisible] = useState(false);

  const handleReportButtonPress = () => {
    if (!selectedReportReason) {
      setReportError("Choose a report reason.");
      return;
    }

    setReportError("");
    setReportNoteModalVisible(true);
  };

  // PHASE 3 STEP 6
  const handleSubmitReport = async (noteOverride?: string) => {
    if (!claim) {
      return;
    }

    // PHASE 4 STEP 16
    const reasonToSubmit = selectedReportReason;

    if (!reasonToSubmit) {
      setReportError("Choose a report reason.");
      return;
    }

    const noteToSubmit = noteOverride ?? reportNote;

    setReportError("");
    setReportSubmitting(true);

    try {
      await reportClaim(claim.id, reasonToSubmit, noteToSubmit);
      setReportNote(noteToSubmit);
      setReportReason(reasonToSubmit);
      setSelectedReportReason(reasonToSubmit);
      setReportSuccess(true);
    } catch (error) {
      setReportError("Could not submit report right now.");
    } finally {
      setReportSubmitting(false);
    }
  };

  // APPLE GUIDELINE 1.2 — user blocking (NEW). Lives next to the report flow
  // (same compact card). Navigates back first: the context filter removes
  // this claim the instant the block lands, so staying here would strand the
  // user on an empty detail screen.
  const handleBlockAuthor = () => {
    if (!claim) {
      return;
    }

    Alert.alert(
      `Block @${claim.authorUsername || "this user"}?`,
      "You won't see their claims anymore. This also notifies Verifact moderation.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Block",
          style: "destructive",
          onPress: () => {
            router.back();
            blockUser(claim.authorId, claim.id)
              .then(() => Alert.alert("User blocked."))
              .catch(() => Alert.alert("Could not block this user right now."));
          },
        },
      ],
    );
  };

  // Save/unsave claims: optimistic toggle via context (the detail screen has
  // no "..." menu, so the action lives next to Block in the same card).
  const claimIsSaved = claim ? savedClaimIds.includes(claim.id) : false;

  const handleToggleSaveClaim = () => {
    if (!claim) {
      return;
    }

    toggleSaveClaim(claim.id)
      .then((saved) => Alert.alert(saved ? "Saved" : "Removed"))
      .catch(() => Alert.alert("Could not update saved claims right now."));
  };

  // Author self-delete (NEW): shown only to the author inside the 3-hour window.
  // Confirm → backend delete (context removes it from state) → navigate back to
  // the feed. A 403 (window passed / finalized) shows the backend's message and
  // keeps the user on the page.
  const handleDeleteOwnClaim = () => {
    if (!claim) {
      return;
    }

    Alert.alert("Delete this claim?", "This can't be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          deleteOwnClaim(claim.id)
            .then(() => {
              router.back();
              Alert.alert("Claim removed.");
            })
            .catch((error) =>
              Alert.alert(error instanceof Error ? error.message : "Could not remove the claim right now."),
            );
        },
      },
    ]);
  };

  // Admin moderation (NEW): hide/unhide this claim from the detail screen.
  // Surfaces the backend's exact error; refetches the claim on success so the
  // hidden badge/state updates in place.
  const handleAdminToggleHidden = () => {
    if (!claim) {
      return;
    }

    const currentlyHidden = Boolean(claim.hidden);
    const request = currentlyHidden
      ? unhideClaim(claim.id)
      : hideClaimFromFeeds(claim.id, "Hidden by moderation.");

    request
      .then((result) => {
        if (!result.ok) {
          throw new Error(result.error ?? "Admin action failed.");
        }
        void fetchClaimById(claim.id);
        Alert.alert(currentlyHidden ? "Post unhidden." : "Post hidden from feeds.");
      })
      .catch((error) =>
        Alert.alert(error instanceof Error ? error.message : "Could not update this claim right now."),
      );
  };

  // Admin moderation (NEW): soft-delete this claim, then leave the detail screen
  // (context drops it from feed state). Surfaces the backend's exact error.
  const handleAdminDeleteClaim = () => {
    if (!claim) {
      return;
    }

    Alert.alert(
      "Delete this claim?",
      "It will be removed from the app. You can restore it from the admin dashboard.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            adminDeleteClaim(claim.id)
              .then(() => {
                router.back();
                Alert.alert("Claim deleted.");
              })
              .catch((error) =>
                Alert.alert(error instanceof Error ? error.message : "Could not delete this claim right now."),
              );
          },
        },
      ],
    );
  };

  // Claim detail "..." menu. Keep everyday actions first, followed by admin-
  // only moderation actions, so normal users never see Hide/Delete.
  const handleOptions = () => {
    if (!claim) {
      return;
    }

    Alert.alert("Post options", undefined, [
      {
        text: "Report",
        style: "destructive",
        onPress: handleReportButtonPress,
      },
      ...(currentUser && currentUser.id !== claim.authorId
        ? [
            {
              text: "Block user",
              style: "destructive" as const,
              onPress: handleBlockAuthor,
            },
          ]
        : []),
      ...(currentUser
        ? [
            {
              text: claimIsSaved ? "Unsave claim" : "Save claim",
              onPress: () => void handleToggleSaveClaim(),
            },
          ]
        : []),
      ...(isAdmin
        ? [
            {
              text: claim.hidden ? "Unhide post" : "Hide post",
              style: claim.hidden ? ("default" as const) : ("destructive" as const),
              onPress: handleAdminToggleHidden,
            },
            {
              text: "Delete claim",
              style: "destructive" as const,
              onPress: handleAdminDeleteClaim,
            },
          ]
        : []),
      {
        text: "Share",
        onPress: shareClaim,
      },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  // PHASE 3 STEP 4
  const handleVote = async (vote: VoteOption) => {
    if (!claim || voteSubmitting) {
      return;
    }

    setVoteError("");
    setVoteSuccess("");
    setVoteSubmitting(true);

    try {
      // PHASE 3 STEP 20D
      // PHASE 3 STEP 32
      const message = await voteOnClaim(claim.id, vote);
      setVoteSuccess(typeof message === "string" ? message : "Vote saved.");
      await waitForClaimRefetch();
      await refreshDetailClaim();
    } catch (error) {
      setVoteError("Could not record your vote. Please try again.");
    } finally {
      setVoteSubmitting(false);
    }
  };

  if (!claim) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
            <Ionicons name="arrow-back" size={24} color={appTheme.colors.bannerSubtitle} />
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
  // PHASE 4 STEP 26
  const votingOpen =
    (claim.status === "OPEN" || claim.status === "ACTIVE" || claim.status === "EARLY_VERDICT") &&
    isVotingOpen(claim);
  // PHASE 3 STEP 22
  const voteWindowClosesAt = getVoteAcceptUntil(claim);
  // PHASE 3 STEP 22
  const voteDisabled = !votingOpen || !isAuthenticated || !isVerified || Boolean(claim.userVote) || voteSubmitting;
  const finalStatus =
    claim.status === "FINALIZED_TRUE" ||
    claim.status === "FINALIZED_FAKE" ||
    claim.status === "INSUFFICIENT_DATA" ||
    claim.status === "NEEDS_MORE_EVIDENCE" ||
    claim.status === "COMMUNITY_TRUE" ||
    claim.status === "COMMUNITY_FAKE";
  const automaticVerdict = finalStatus ? calculateAutomaticVerdict(claim, claim.mode) : undefined;
  // PHASE 3 STEP 10
  const verdictTitle =
    claim.status === "FINALIZED_TRUE" ||
    claim.status === "FINALIZED_FAKE" ||
    claim.status === "INSUFFICIENT_DATA" ||
    claim.status === "EARLY_VERDICT" ||
    claim.status === "LOCKED" ||
    claim.status === "COMMUNITY_TRUE" ||
    claim.status === "COMMUNITY_FAKE" ||
    claim.status === "NEEDS_MORE_EVIDENCE"
      ? verdictLabels[claim.status]
      : automaticVerdict?.resultLabel;
  const verdictReason = claim.verdictReason ?? automaticVerdict?.reason;
  const verdictCalculatedText = claim.verdictCalculatedAt
    ? new Date(claim.verdictCalculatedAt).toLocaleString()
    : "Pending save";
  const engineVerdict = verdictTitle ?? (votingOpen ? "Pending" : "Finalizing verdict…");
  // PHASE 3 STEP 5
  const evidenceCount = claim.evidenceCount ?? claim.evidence.length;
  // PHASE 4 STEP 10
  const evidenceUsedCount = claim.evidenceUsedCount ?? 0;
  // PHASE 4 STEP 23
  const sortedEvidence = [...claim.evidence].sort(
    (firstEvidence, secondEvidence) =>
      new Date(secondEvidence.createdAt).getTime() - new Date(firstEvidence.createdAt).getTime(),
  );
  // PHASE 5 STEP 1E
  const openContributorProfile = (
    slugOrUsername?: string | null,
    userId?: string | null,
    username?: string | null,
  ) => {
    const identifier = userId || slugOrUsername || username;

    if (!identifier) {
      return;
    }

    router.push({
      pathname: "/profile/[slug]",
      params: {
        slug: identifier,
        ...(userId ? { userId } : {}),
        ...(username ? { username } : {}),
      },
    });
  };
  // PHASE 3 STEP 1
  // PHASE 2 STEP 5
  const mainSourceQuality = getSourceQuality(claim.sourceUrl);
  // Source trust label update
  const displayedSourceScore = typeof claim.sourceScore === "number" ? claim.sourceScore : mainSourceQuality.score;
  const displayedSourceTrust = claim.sourceReadStatus === "failed"
    ? "Not verified"
    : typeof claim.sourceScore === "number"
      ? getSourceTrustLabel(claim.sourceScore, claim.sourceQuality)
      : mainSourceQuality.label;
  const displayedSourceMessage = claim.sourceReadStatus === "failed"
    ? {
        text: "Source review unavailable. Community verification is important for this source.",
        color: "amber" as const,
      }
    : getSourceMessage(displayedSourceScore, mainSourceQuality.label);
  const claimSourceDomain = getEvidenceSourceDomain(claim.sourceUrl);
  // PHASE 3 STEP 8
  const mediaUrl = claim.media.youtubeUrl ?? claim.media.videoUrl ?? null;
  const mediaPlatform = claim.media.videoPlatform ?? (claim.media.youtubeUrl ? "YouTube" : mediaUrl ? "Video Link" : null);
  const aiSummary =
    claim.aiCheck.sourceNotes ??
    claim.aiSummary ??
    claim.aiCheck.reason ??
    (claim.aiCheck.status === "PENDING"
      ? "No AI result yet. Verifact will check this claim shortly."
      : "No AI result yet.");
  const aiRiskSummary = claim.redFlags.length > 0
    ? "AI found source or evidence concerns. Review the source support summary."
    : aiSummary;
  // PHASE 4 STEP 22
  const sourceReadStatusLabel = getSourceReadStatusLabel(claim.sourceReadStatus);
  const sourceSupportLabel = getSourceSupportLabel(claim.sourceSupportsClaim);
  const sourceSupportIcon = getSourceSupportIcon(claim.sourceSupportsClaim);
  const sourceSupportColor = getSourceSupportColor(claim.sourceSupportsClaim, appTheme);
  const sourceSupportTextStyle = getSourceSupportTextStyle(claim.sourceSupportsClaim, styles);
  const sourcePageTitle = claim.sourcePageTitle?.trim();
  const sourceReviewUnavailable = claim.sourceReadStatus === "failed";
  const sourceSupportSummary = sourceReviewUnavailable
    ? SOURCE_REVIEW_UNAVAILABLE_BODY
    : cleanSourceReviewText(claim.sourceSupportSummary);
  // PHASE 5 election positioning UI
  const showNeutralPoliticsBadge = claim.category === "Politics" || claim.subCategory === "Election 2026";
  // PHASE 4 STEP 7
  const isNotFactCheckable = claim.aiCheck.status === "NOT_FACT_CHECKABLE";
  const aiReviewStatusMessage =
    claim.aiCheck.status === "PENDING"
      ? AI_SOURCE_REVIEW_RUNNING_MESSAGE
      : claim.aiCheck.status === "ERROR"
        ? AI_REVIEW_FALLBACK_MESSAGE
        : "";
  const aiReviewStatusStyle =
    claim.aiCheck.status === "ERROR" ? styles.aiReviewFallback : styles.aiReviewRunning;
  const voteMessage = voteSubmitting
    ? "Saving vote..."
    : !votingOpen
    ? ""
    : !isAuthenticated
      ? "Please log in to vote."
        : !isVerified
          ? "Please verify your email to vote."
        : claim.userVote
          ? "You already voted on this claim."
          : "Choose one option before voting closes.";
  // 24H MODEL: voting runs the full 24 hours and the server sweep finalizes
  // at that same mark — countdown while open, a brief "Finalizing…" while
  // waiting for the sweep, then the published verdict.
  const phaseLabel = finalStatus
    ? "Verdict published"
    : `Phase ${claim.currentPhase} - ${votingOpen ? "Voting" : "Finalizing"}`;
  const timeLabel = votingOpen
    ? `Voting ends in ${getTimeRemaining(voteWindowClosesAt)}`
    : finalStatus
      ? "Finalized"
      : "Finalizing…";
  const minVotesLabel = `${totalVotes}/${claim.minVotesRequired}`;
  // PHASE 4 STEP 16
  const reportButtonActive = reportSubmitting || Boolean(selectedReportReason);
  const authorAvatarInitial = (claim.authorUsername || claim.authorDisplayName || "U").slice(0, 1).toUpperCase();
  const showAuthorAvatarImage = Boolean(
    claim.authorAvatarUrl && !authorAvatarLoadFailed && claim.authorUsername !== "deleted_user",
  );
  // Native OS share sheet (Messages, Mail, X, WhatsApp, Copy, …) via React
  // Native's built-in Share API — no new dependency. `claim.shareUrl` is already
  // built from SHARE_BASE_URL, i.e. https://factfight.com/claim/{id}.
  const shareClaim = async () => {
    try {
      const url = claim.shareUrl;
      await Share.share({
        message: `${claim.title}\n\nSee the evidence and vote on FactFight:\n${url}`,
        url, // iOS rich preview
        title: claim.title, // Android dialog title
      });
    } catch {
      // user cancelled — no alert needed
    }
  };

  // PHASE 5 STEP 3
  if (claim.hidden) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
            <Ionicons name="arrow-back" size={24} color={appTheme.colors.bannerSubtitle} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Claim details</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.hiddenDetailCard}>
          <Ionicons name="shield-checkmark-outline" size={26} color={appTheme.colors.subtext} />
          <Text style={styles.hiddenDetailTitle}>Content removed</Text>
          <Text style={styles.hiddenDetailText}>
            This content was removed for violating community guidelines.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="arrow-back" size={24} color={appTheme.colors.bannerSubtitle} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Claim details</Text>
        <TouchableOpacity
          onPress={handleOptions}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="More claim options"
        >
          <Ionicons name="ellipsis-horizontal" size={22} color={appTheme.colors.bannerSubtitle} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={contentContainerStyle} showsVerticalScrollIndicator={false}>
        {/* PHASE 3 STEP 12 */}
        {liveUpdatesOn ? <Text style={styles.liveText}>Live updates on</Text> : null}

        {/* CONTENT SAFETY server gate — author-only lifecycle badge. Public
            readers never receive PENDING/BLOCKED rows (RLS), so this only ever
            renders for the author (or an admin) viewing their own claim. */}
        {currentUser?.id === claim.authorId && claim.safetyStatus !== "APPROVED" ? (
          <View style={claim.safetyStatus === "BLOCKED" ? styles.safetyBadgeBlocked : styles.safetyBadgePending}>
            <Ionicons
              name={claim.safetyStatus === "BLOCKED" ? "close-circle-outline" : "time-outline"}
              size={16}
              color={claim.safetyStatus === "BLOCKED" ? appTheme.colors.danger : appTheme.colors.warningText}
            />
            <Text
              style={
                claim.safetyStatus === "BLOCKED" ? styles.safetyBadgeBlockedText : styles.safetyBadgePendingText
              }
            >
              {claim.safetyStatus === "BLOCKED"
                ? "Removed — community guidelines. Only you can see this."
                : "Under review — visible to others shortly."}
            </Text>
          </View>
        ) : null}
        {detailLoading ? <Text style={styles.inlineLoadingText}>Loading claim detail...</Text> : null}
        <View style={styles.cardFlush}>
          <VerdictBanner
            status={claim.status}
            verdictLabel={engineVerdict}
            currentPhase={claim.currentPhase}
            timeLabel={timeLabel}
            minVotesLabel={minVotesLabel}
            earlyVerdictFired={claim.earlyVerdictFired}
          />
          <View style={styles.claimBody}>
            <View style={styles.titleRow}>
              <Text style={styles.title}>{translation.displayTitle}</Text>
              <StatusBadge status={claim.status} />
            </View>
            <MentionText text={translation.displayDescription} style={styles.description} />
            {/* CLAIM TRANSLATION (NEW): same flow as the feed card. */}
            {translation.isShowingTranslation ? (
              <View style={styles.translateRow}>
                <Text style={styles.translateDisclaimer}>
                  Translated by AI — may not be fully accurate.{" "}
                </Text>
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={translation.showOriginal}
                  accessibilityRole="button"
                  accessibilityLabel="See original"
                >
                  <Text style={styles.translateLink}>See original</Text>
                </TouchableOpacity>
              </View>
            ) : translation.canTranslate ? (
              <TouchableOpacity
                style={styles.translateRow}
                activeOpacity={0.7}
                disabled={translation.isTranslating}
                onPress={translation.promptTranslate}
                accessibilityRole="button"
                accessibilityLabel="Translate this claim"
                accessibilityHint="Choose a language to translate the claim into"
              >
                <Ionicons name="language-outline" size={13} color={appTheme.colors.link} />
                <Text style={styles.translateLink}>
                  {translation.isTranslating ? "Translating…" : "Translate"}
                </Text>
              </TouchableOpacity>
            ) : null}
            {/* Shared media block (image / YouTube thumb / link) at the top of
                the claim body — same helper + rendering as the feed card. Opens
                the underlying media in the browser on tap. Nothing renders (and
                no margin is reserved) when the claim has no media. */}
            {resolveClaimMedia(claim.media).kind !== "none" ? (
              <View style={styles.heroMediaBlock}>
                <ClaimMedia
                  media={claim.media}
                  fullResolution
                  borderRadius={appTheme.radius.sm}
                  onPress={() => {
                    const target =
                      claim.media.imageUrl || claim.media.youtubeUrl || claim.media.videoUrl;

                    if (target) {
                      Linking.openURL(target).catch(() => {
                        Alert.alert("Could not open this media.");
                      });
                    }
                  }}
                />
              </View>
            ) : null}
            <View style={styles.metaWrap}>
              {claim.category ? <Text style={styles.category}>{claim.category}</Text> : null}
              {/* PHASE 5 election positioning UI */}
              {claim.subCategory === "Election 2026" ? (
                <Text style={styles.electionBadge}>Election 2026</Text>
              ) : null}
              <SourceQualityBadge quality={mainSourceQuality} />
              <AiCheckBadge status={claim.aiCheck.status} />
              <Text style={styles.claimTypeBadge}>{formatClaimType(claim.claimType)}</Text>
              {claim.isFlagged ? <Text style={styles.flaggedBadge}>Flagged for review</Text> : null}
            </View>
            {/* PHASE 5 election positioning UI */}
            {showNeutralPoliticsBadge ? (
              <Text style={styles.neutralPoliticsBadge}>
                Community reviewed {"\u00B7"} AI assisted {"\u00B7"} politically neutral
              </Text>
            ) : null}
            <View style={styles.sourceLinkRow}>
              <Ionicons name="link-outline" size={13} color={appTheme.colors.link} />
              <Text style={styles.sourceUrl} selectable numberOfLines={1}>
                {claimSourceDomain}
              </Text>
            </View>
            {/* PHASE 4 STEP 24 */}
            <View style={styles.communitySummaryPanel}>
              <Text style={styles.communitySummaryTitle}>Community vote results</Text>
              <VoteBreakdownBars
                votesTrue={claim.votesTrue}
                votesFake={claim.votesFake}
                votesUnsure={claim.votesUnsure}
                totalVotes={totalVotes}
              />
            </View>
            <View style={styles.aiDetailPanel}>
              {/* PHASE 5 PRE-LAUNCH: tappable header toggles the full details. */}
              <TouchableOpacity
                style={styles.aiDetailHeaderRow}
                activeOpacity={0.7}
                onPress={() => setAiExpanded((current) => !current)}
                accessibilityRole="button"
                accessibilityState={{ expanded: aiExpanded }}
                accessibilityLabel="AI pre-check"
                accessibilityHint={aiExpanded ? "Collapse AI pre-check details" : "Expand AI pre-check details"}
              >
                <Text style={styles.aiDetailTitle}>AI pre-check</Text>
                <Ionicons
                  name={aiExpanded ? "chevron-up" : "chevron-down"}
                  size={16}
                  color={appTheme.colors.ai}
                />
              </TouchableOpacity>
              <View style={styles.aiDetailGrid}>
                <View style={styles.aiDetailItem}>
                  <Text style={styles.aiDetailLabel}>Confidence</Text>
                  <Text style={styles.aiDetailValue}>{formatPercent(claim.aiCheck.confidence)}</Text>
                </View>
                <View style={styles.aiDetailItem}>
                  <Text style={styles.aiDetailLabel}>Source trust</Text>
                  <Text style={styles.aiDetailValue}>{displayedSourceTrust}</Text>
                </View>
                <View style={styles.aiDetailItem}>
                  <Text style={styles.aiDetailLabel}>Source score</Text>
                  <Text style={styles.aiDetailValue}>{formatSourceCredibilityScore(displayedSourceScore)}</Text>
                </View>
                <View style={styles.aiDetailItem}>
                  <Text style={styles.aiDetailLabel}>Claim type</Text>
                  <Text style={styles.aiDetailValue}>{formatClaimType(claim.claimType)}</Text>
                </View>
              </View>
              {aiExpanded ? (
                <>
                  <Text style={[styles.sourceMessage, getSourceMessageStyle(displayedSourceMessage.color, styles)]}>{displayedSourceMessage.text}</Text>
                  {/* PHASE 4 STEP 22 */}
                  <View style={styles.sourceSupportPanel}>
                    <Text style={styles.sourceSupportKicker}>Source support signal</Text>
                    <View style={styles.sourceSupportRow}>
                      <Ionicons
                        name={claim.sourceReadStatus === "read" ? "document-text-outline" : "warning-outline"}
                        size={15}
                        color={claim.sourceReadStatus === "read" ? appTheme.colors.success : appTheme.colors.warning}
                      />
                      <Text style={styles.sourceSupportText}>{sourceReadStatusLabel}</Text>
                    </View>
                    {sourceReviewUnavailable ? (
                      <Text style={styles.sourceSupportTitle} numberOfLines={2}>
                        {SOURCE_REVIEW_UNAVAILABLE_TITLE}
                      </Text>
                    ) : sourcePageTitle ? (
                      <Text style={styles.sourceSupportTitle} numberOfLines={2}>
                        {sourcePageTitle}
                      </Text>
                    ) : null}
                    {sourceReviewUnavailable ? null : (
                      <View style={styles.sourceSupportRow}>
                        <Ionicons name={sourceSupportIcon} size={15} color={sourceSupportColor} />
                        <Text style={[styles.sourceSupportText, sourceSupportTextStyle]}>{sourceSupportLabel}</Text>
                      </View>
                    )}
                    {sourceSupportSummary ? (
                      <Text style={styles.sourceSupportSummary} numberOfLines={5}>{sourceSupportSummary}</Text>
                    ) : (
                      <Text style={styles.sourceSupportSummary}>Source support has not been summarized yet.</Text>
                    )}
                    {sourceReviewUnavailable ? (
                      <Text style={styles.sourceSupportDisclaimer}>{SOURCE_REVIEW_UNAVAILABLE_NOTE}</Text>
                    ) : null}
                    <Text style={styles.sourceSupportDisclaimer}>
                      This only checks whether the source appears to support the claim. It is not a final truth decision.
                    </Text>
                  </View>
                  <Text style={styles.aiText} numberOfLines={2}>{aiRiskSummary}</Text>
                  {isNotFactCheckable ? (
                    <Text style={styles.notFactCheckableWarning}>
                      This appears to be an opinion or non-factual post. Verifact cannot verify it as True or Fake.
                    </Text>
                  ) : null}
                  <Text style={styles.aiDisclaimer}>
                    AI pre-check is only a risk signal. Community voting decides the final result.
                  </Text>
                  {aiReviewStatusMessage ? <Text style={aiReviewStatusStyle}>{aiReviewStatusMessage}</Text> : null}
                </>
              ) : null}
            </View>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Author</Text>
          <TouchableOpacity
            style={styles.authorHeaderRow}
            activeOpacity={0.85}
            onPress={() => {
              // Public user profile with claims; anonymized/deleted authors
              // are not navigable.
              if (!claim.author.id || claim.authorUsername === "deleted_user") {
                return;
              }

              router.push(`/user/${claim.author.id}`);
            }}
          >
            <View style={styles.detailAuthorAvatar}>
              {showAuthorAvatarImage && claim.authorAvatarUrl ? (
                <Image
                  source={{ uri: claim.authorAvatarUrl }}
                  style={styles.detailAuthorAvatarImage}
                  onError={() => setAuthorAvatarLoadFailed(true)}
                />
              ) : (
                <Text style={styles.detailAuthorAvatarText}>{authorAvatarInitial}</Text>
              )}
            </View>
            <View style={styles.authorInfo}>
              <Text style={styles.authorName}>{claim.authorDisplayName}</Text>
              <Text style={styles.authorText}>@{claim.authorUsername}</Text>
              {/* PHASE 5 STEP 1 */}
              <View style={styles.contributorMetaRow}>
                <Text style={styles.rankPill}>{claim.author.rankTitle}</Text>
                {getTopBadges(claim.author.badgeList, 1).map((badge) => (
                  <Text key={badge.id} style={styles.smallBadge}>
                    {badge.name}
                  </Text>
                ))}
              </View>
            </View>
            {claim.authorVerified ? <Text style={styles.verifiedBadge}>Verified</Text> : null}
          </TouchableOpacity>
          {/* PHASE 4 STEP 12 */}
          <Text style={styles.authorText}>Reputation: {claim.author.reputationPoints.toLocaleString()} pts</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Share</Text>
          <Text style={styles.sourceUrl} selectable>
            {claim.shareUrl}
          </Text>
          <TouchableOpacity
            style={styles.shareButton}
            activeOpacity={0.8}
            onPress={shareClaim}
            accessibilityRole="button"
            accessibilityLabel="Share this claim"
            accessibilityHint="Opens the system share sheet"
          >
            <Ionicons name="share-outline" size={16} color={appTheme.colors.chipActiveText} />
            <Text style={styles.shareButtonText}>Share</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Media</Text>
          {/* PHASE 5 PRE-LAUNCH: the claim image now renders inline above; this card is video-only. */}
          {mediaUrl ? (
            <View style={styles.mediaList}>
              {/* PHASE 3 STEP 8 */}
              {mediaUrl && mediaPlatform ? (
                <View style={styles.videoDetailPanel}>
                  <Text style={styles.videoPlatformBadge}>{mediaPlatform}</Text>
                  {/* The video thumbnail now renders in the shared media block at
                      the top of the claim body; this panel keeps just the
                      platform badge + the raw link. */}
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => {
                      Linking.openURL(mediaUrl).catch(() => {
                        Alert.alert("Could not open this link.");
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
            <Text style={styles.placeholder}>No video attached yet.</Text>
          )}
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
                // PHASE 4 STEP 16
                const selected = selectedReportReason === reason.value;

                return (
                  <TouchableOpacity
                    key={reason.value}
                    style={[styles.reasonButton, selected && styles.reasonButtonSelected]}
                    activeOpacity={0.8}
                    onPress={() => {
                      setReportReason(reason.value);
                      setSelectedReportReason(reason.value);
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
              style={[
                styles.reportIconButton,
                reportButtonActive && styles.reportIconButtonActive,
                reportSubmitting && styles.disabledButton,
              ]}
              activeOpacity={0.8}
              onPress={handleReportButtonPress}
              disabled={reportSubmitting}
            >
              <Ionicons
                name="flag-outline"
                size={14}
                color={reportButtonActive ? appTheme.colors.chipActiveText : appTheme.colors.muted}
              />
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
          {/* Step 2 of the report flow: optional note before the existing submit. */}
          <ReportNoteModal
            visible={reportNoteModalVisible}
            submitting={reportSubmitting}
            onCancel={() => setReportNoteModalVisible(false)}
            onSubmit={(note) => {
              setReportNoteModalVisible(false);
              void handleSubmitReport(note);
            }}
          />
          {/* Save/unsave claims: logged-in only, same rule as voting/blocking. */}
          {currentUser ? (
            <TouchableOpacity
              style={styles.saveClaimButton}
              activeOpacity={0.8}
              onPress={handleToggleSaveClaim}
              accessibilityRole="button"
              accessibilityLabel={claimIsSaved ? "Unsave claim" : "Save claim"}
              accessibilityHint={
                claimIsSaved ? "Removes this claim from your saved list" : "Adds this claim to your saved list"
              }
            >
              <Ionicons
                name={claimIsSaved ? "bookmark" : "bookmark-outline"}
                size={14}
                color={appTheme.colors.link}
              />
              <Text style={styles.saveClaimButtonText}>
                {claimIsSaved ? "Unsave claim" : "Save claim"}
              </Text>
            </TouchableOpacity>
          ) : null}
          {/* APPLE GUIDELINE 1.2 — user blocking (NEW): same card as the
              report flow; hidden on the user's own claims and when logged out. */}
          {currentUser && currentUser.id !== claim.authorId ? (
            <TouchableOpacity
              style={styles.blockUserButton}
              activeOpacity={0.8}
              onPress={handleBlockAuthor}
              accessibilityRole="button"
              accessibilityLabel={`Block ${claim.authorUsername ? `@${claim.authorUsername}` : "this user"}`}
              accessibilityHint="Removes this user's claims from your feed and notifies moderation"
            >
              <Ionicons name="ban-outline" size={14} color={appTheme.colors.danger} />
              <Text style={styles.blockUserButtonText}>
                Block {claim.authorUsername ? `@${claim.authorUsername}` : "user"}
              </Text>
            </TouchableOpacity>
          ) : null}
          {/* Author self-delete (NEW): own claim, not finalized, < 3h since
              posting. Hidden entirely otherwise; backend re-enforces the rule. */}
          {canAuthorDeleteClaim(claim, currentUser?.id) ? (
            <TouchableOpacity
              style={styles.deleteClaimButton}
              activeOpacity={0.8}
              onPress={handleDeleteOwnClaim}
              accessibilityRole="button"
              accessibilityLabel="Delete claim"
              accessibilityHint="Permanently removes your claim within the 3-hour window"
            >
              <Ionicons name="trash-outline" size={14} color={appTheme.colors.danger} />
              <Text style={styles.deleteClaimButtonText}>
                Delete claim ({formatDeleteWindowRemaining(getClaimDeleteWindowMsRemaining(claim))} left)
              </Text>
            </TouchableOpacity>
          ) : null}
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
              placeholder="example.com/source"
              style={[styles.input, evidenceErrors.url && styles.inputError]}
              placeholderTextColor={appTheme.colors.muted}
              keyboardType="url"
              autoCapitalize="none"
              autoCorrect={false}
            />
            {evidenceErrors.url ? <Text style={styles.errorText}>{evidenceErrors.url}</Text> : null}
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Short note</Text>
            <MentionTextInput
              value={evidenceNote}
              onChangeText={(value) => updateEvidenceField("note", value)}
              placeholder="Explain what this source adds"
              inputStyle={[styles.input, styles.textArea, evidenceErrors.note && styles.inputError]}
              placeholderTextColor={appTheme.colors.muted}
              multiline
              maxLength={EVIDENCE_NOTE_MAX_LENGTH}
            />
            <Text style={styles.fieldHint}>
              {evidenceNote.length}/{EVIDENCE_NOTE_MAX_LENGTH}
            </Text>
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

          {/* PHASE 5 STEP 6 */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Evidence image (optional)</Text>
            {selectedEvidenceImage ? (
              <View style={styles.evidenceImagePreviewPanel}>
                <Image source={{ uri: selectedEvidenceImage.uri }} style={styles.evidenceImagePreview} resizeMode="cover" />
                <Text style={styles.fieldHint}>
                  {formatImageSize(selectedEvidenceImage.fileSize)}
                  {selectedEvidenceImage.warning ? `  •  ${selectedEvidenceImage.warning}` : ""}
                </Text>
                <TouchableOpacity
                  style={styles.removeEvidenceImageButton}
                  activeOpacity={0.8}
                  onPress={() => {
                    setSelectedEvidenceImage(null);
                    setEvidenceImageError("");
                  }}
                  disabled={evidenceSubmitLoading}
                >
                  <Text style={styles.removeEvidenceImageText}>Remove image</Text>
                </TouchableOpacity>
              </View>
            ) : null}
            <TouchableOpacity
              style={[styles.openSourceButton, evidenceSubmitLoading && styles.disabledButton]}
              activeOpacity={0.8}
              onPress={handlePickEvidenceImage}
              disabled={evidenceSubmitLoading}
            >
              <Text style={styles.openSourceButtonText}>Add Image</Text>
              <Ionicons name="image-outline" size={13} color={appTheme.colors.link} />
            </TouchableOpacity>
            {evidenceImageError ? <Text style={styles.errorText}>{evidenceImageError}</Text> : null}
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
              {evidenceSubmitLoading ? "Uploading..." : "Add Evidence"}
            </Text>
          </TouchableOpacity>

          <View style={styles.evidenceList}>
            {evidenceLoading ? <Text style={styles.placeholder}>Loading evidence...</Text> : null}
            {!evidenceLoading && sortedEvidence.length > 0 ? (
              sortedEvidence.map((item) => {
                const config = evidenceTypeConfig[item.type];
                const sourceQuality = getEvidenceSourceQuality(item);
                const sourceDomain = getEvidenceSourceDomain(item.url);
                const contributorInitial = (item.contributorUsername || item.contributorDisplayName || "U")
                  .slice(0, 1)
                  .toUpperCase();

                if (item.hidden) {
                  return (
                    <View key={item.id} style={styles.evidenceItem}>
                      <View style={styles.hiddenEvidenceBox}>
                        <Ionicons name="shield-checkmark-outline" size={18} color={appTheme.colors.subtext} />
                        <Text style={styles.hiddenEvidenceText}>
                          This content was removed for violating community guidelines.
                        </Text>
                      </View>
                    </View>
                  );
                }

                return (
                  <View key={item.id} style={styles.evidenceItem}>
                    <View style={styles.evidenceHeaderRow}>
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
                      <Text style={styles.evidenceTime}>{new Date(item.createdAt).toLocaleString()}</Text>
                    </View>
                    {/* PHASE 5 STEP 1 */}
                    {item.contributorUsername ? (
                      <TouchableOpacity
                        style={styles.evidenceContributorRow}
                        activeOpacity={0.85}
                        onPress={() => openContributorProfile(item.contributorProfileSlug || item.contributorUsername, item.userId, item.contributorUsername)}
                      >
                        <View style={styles.evidenceContributorAvatar}>
                          {item.contributorAvatarUrl ? (
                            <Image source={{ uri: item.contributorAvatarUrl }} style={styles.evidenceContributorAvatarImage} />
                          ) : (
                            <Text style={styles.evidenceContributorAvatarText}>{contributorInitial}</Text>
                          )}
                        </View>
                        <Text style={styles.evidenceContributorText} numberOfLines={1}>
                          @{item.contributorUsername}    {item.contributorRankTitle ?? "Claim Checker"}
                        </Text>
                        {getTopBadges(item.contributorBadges ?? [], 1).map((badge) => (
                          <Text key={badge.id} style={styles.smallBadge}>
                            {badge.name}
                          </Text>
                        ))}
                        {item.contributorEvidenceCount !== null && item.contributorEvidenceCount !== undefined ? (
                          <Text style={styles.evidenceContributorSubtext}>
                            Evidence count: {item.contributorEvidenceCount}
                          </Text>
                        ) : null}
                      </TouchableOpacity>
                    ) : null}
                    <TouchableOpacity
                      style={styles.evidenceSourceRow}
                      activeOpacity={0.75}
                      onPress={() => handleOpenEvidenceSource(item.url)}
                    >
                      <Ionicons name="link-outline" size={14} color={appTheme.colors.link} />
                      <Text style={styles.evidenceDomain} numberOfLines={1}>
                        {sourceDomain}
                      </Text>
                    </TouchableOpacity>
                    <View style={styles.evidenceQuality}>
                      <SourceQualityBadge quality={sourceQuality} showScore />
                      <Text style={styles.sourceQualityReason}>{sourceQuality.reason}</Text>
                    </View>
                    {/* PHASE 5 STEP 6 */}
                    {item.thumbnailUrl || item.imageUrl ? (
                      <TouchableOpacity
                        activeOpacity={0.85}
                        onPress={() => {
                          Linking.openURL(item.imageUrl || item.thumbnailUrl || "").catch(() => {
                            Alert.alert("Could not open image.");
                          });
                        }}
                      >
                        <Image
                          source={{ uri: item.thumbnailUrl || item.imageUrl || "" }}
                          style={styles.evidenceImage}
                          resizeMode="cover"
                        />
                      </TouchableOpacity>
                    ) : null}
                    <MentionText text={item.note} style={styles.evidenceNote} numberOfLines={6} />
                    <TouchableOpacity
                      style={styles.openSourceButton}
                      activeOpacity={0.8}
                      onPress={() => handleOpenEvidenceSource(item.url)}
                    >
                      <Text style={styles.openSourceButtonText}>Open Source</Text>
                      <Ionicons name="open-outline" size={13} color={appTheme.colors.link} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.reportEvidenceButton}
                      activeOpacity={0.8}
                      onPress={() => handleReportEvidence(item.id)}
                    >
                      <Ionicons name="flag-outline" size={13} color={appTheme.colors.danger} />
                      <Text style={styles.reportEvidenceButtonText}>Report Evidence</Text>
                    </TouchableOpacity>
                  </View>
                );
              })
            ) : null}
            {!evidenceLoading && sortedEvidence.length === 0 ? (
              <EmptyState
                icon="link-outline"
                title="No evidence yet"
                message="Add a source to help the community verify this claim."
              />
            ) : null}
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

        <View style={styles.card}>
          <Text style={styles.label}>Verification timeline</Text>
          <PhaseStatusRow timeLabel={timeLabel} phaseLabel={phaseLabel} />
          <Text style={styles.date}>Posted {new Date(claim.createdAt).toLocaleString()}</Text>
          {/* 24H MODEL: voting ends and the verdict publishes at the same mark. */}
          <Text style={styles.date}>Voting ends & verdict publishes {new Date(voteWindowClosesAt).toLocaleString()}</Text>
          <Text style={styles.date}>Minimum votes: {minVotesLabel}</Text>
          <Text style={styles.date}>
            Early verdict: {claim.earlyVerdictFired ? "Candidate triggered" : "Not triggered"}
          </Text>
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

        {!votingOpen && finalStatus && verdictTitle ? (
          <View style={styles.card}>
            <Text style={styles.label}>System verdict</Text>
            <StatusBadge status={claim.status} />
            <Text style={styles.verdictTitle}>{verdictTitle}</Text>
            {verdictReason ? <Text style={styles.verdictReason}>{verdictReason}</Text> : null}
            <View style={styles.verdictMetaPanel}>
              <Text style={styles.verdictMetaText}>Total votes: {totalVotes}</Text>
              <Text style={styles.verdictMetaText}>Calculated: {verdictCalculatedText}</Text>
            </View>
          </View>
        ) : null}

        {votingOpen ? (
          <View style={styles.card}>
            <Text style={styles.label}>System verdict</Text>
            <Text style={styles.placeholder}>Result appears when voting closes.</Text>
          </View>
        ) : null}
      </ScrollView>
      {claim ? (
        <FirstClaimCongratulationsModal
          claimId={claim.id}
          claimTitle={claim.title}
          onClose={closeFirstClaimCongrats}
          shareUrl={claim.shareUrl}
          userId={currentUser?.id ?? null}
          visible={showFirstClaimCongrats}
        />
      ) : null}
    </SafeAreaView>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
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
    color: theme.colors.chipActiveText,
  },
  headerSpacer: {
    width: 24,
  },
  content: {
    paddingHorizontal: 10,
    paddingTop: 10,
  },
  // PHASE 3 STEP 12
  liveText: {
    alignSelf: "flex-start",
    backgroundColor: theme.colors.successBg,
    borderColor: theme.colors.success,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    color: theme.colors.success,
    fontSize: theme.typography.small.fontSize,
    fontWeight: "500",
    marginBottom: theme.spacing.md,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
  },
  // CONTENT SAFETY server gate — author-only lifecycle badges.
  safetyBadgePending: {
    alignItems: "center",
    backgroundColor: theme.colors.warningBg,
    borderColor: theme.colors.warningBorder,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    flexDirection: "row",
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  safetyBadgePendingText: {
    color: theme.colors.warningText,
    flex: 1,
    fontSize: theme.typography.small.fontSize,
    fontWeight: "500",
  },
  safetyBadgeBlocked: {
    alignItems: "center",
    backgroundColor: theme.colors.dangerBg ?? theme.colors.warningBg,
    borderColor: theme.colors.danger,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    flexDirection: "row",
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  safetyBadgeBlockedText: {
    color: theme.colors.danger,
    flex: 1,
    fontSize: theme.typography.small.fontSize,
    fontWeight: "600",
  },
  // PHASE 4 STEP 24
  inlineLoadingText: {
    alignSelf: "flex-start",
    color: theme.colors.subtext,
    fontSize: 12,
    marginBottom: theme.spacing.sm,
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
  // PHASE 5 STEP 1
  contributorMetaRow: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.sm,
    marginTop: theme.spacing.sm,
  },
  rankPill: {
    backgroundColor: theme.colors.phaseBg,
    borderRadius: 999,
    color: theme.colors.phaseText,
    fontSize: 11,
    fontWeight: "500",
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  smallBadge: {
    backgroundColor: theme.colors.sourceBg,
    borderRadius: 999,
    color: theme.colors.sourceText,
    fontSize: 10,
    fontWeight: "500",
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  evidenceContributorRow: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
  },
  evidenceContributorAvatar: {
    alignItems: "center",
    backgroundColor: theme.colors.leaderboardAvatar,
    borderRadius: 11,
    height: 22,
    justifyContent: "center",
    width: 22,
  },
  evidenceContributorAvatarImage: {
    borderRadius: 11,
    height: 22,
    width: 22,
  },
  evidenceContributorAvatarText: {
    color: theme.colors.leaderboardAvatarText,
    fontSize: 10,
    fontWeight: "500",
  },
  evidenceContributorText: {
    color: theme.colors.subtext,
    flexShrink: 1,
    fontSize: 12,
    fontWeight: "500",
  },
  // PHASE 5 STEP 1E
  evidenceContributorSubtext: {
    color: theme.colors.subtext,
    fontSize: 11,
    width: "100%",
  },
  authorHeaderRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    justifyContent: "space-between",
    gap: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  detailAuthorAvatar: {
    alignItems: "center",
    backgroundColor: theme.colors.leaderboardAvatar,
    borderRadius: 18,
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  detailAuthorAvatarImage: {
    borderRadius: 18,
    height: 36,
    width: 36,
  },
  detailAuthorAvatarText: {
    color: theme.colors.leaderboardAvatarText,
    fontSize: 14,
    fontWeight: "500",
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
    backgroundColor: theme.colors.successBg,
    borderColor: theme.colors.success,
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
  // PHASE 5 PRE-LAUNCH
  aiDetailHeaderRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
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
  aiReviewRunning: {
    color: theme.colors.ai,
    fontSize: 11,
    fontWeight: "500",
    lineHeight: 15,
  },
  aiReviewFallback: {
    color: theme.colors.warningText,
    fontSize: 11,
    fontWeight: "500",
    lineHeight: 15,
  },
  notFactCheckableWarning: {
    color: theme.colors.warningText,
    fontSize: 12,
    fontWeight: "500",
    lineHeight: 17,
  },
  sourceWarning: {
    color: theme.colors.warningText,
    fontSize: 12,
    fontWeight: "500",
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
  // CLAIM TRANSLATION (NEW)
  translateRow: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
    marginTop: 6,
  },
  translateLink: {
    color: theme.colors.link,
    fontSize: 13,
    fontWeight: "500",
  },
  translateDisclaimer: {
    color: theme.colors.subtext,
    fontSize: 12,
    fontWeight: "400",
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
  // PHASE 5 election positioning UI
  electionBadge: {
    alignSelf: "flex-start",
    backgroundColor: theme.colors.phaseBg,
    borderRadius: 999,
    color: theme.colors.phaseText,
    fontSize: 11,
    fontWeight: "500",
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  neutralPoliticsBadge: {
    alignSelf: "flex-start",
    backgroundColor: theme.colors.secondarySurface,
    borderColor: theme.colors.lightBorder,
    borderRadius: 999,
    borderWidth: 0.5,
    color: theme.colors.subtext,
    fontSize: 11,
    fontWeight: "500",
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  claimTypeBadge: {
    alignSelf: "flex-start",
    backgroundColor: theme.colors.warningBg,
    borderRadius: 999,
    color: theme.colors.warningText,
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
  // PHASE 4 STEP 24
  communitySummaryPanel: {
    backgroundColor: theme.colors.card,
    borderColor: theme.colors.lightBorder,
    borderRadius: theme.radius.sm,
    borderWidth: 0.5,
    overflow: "hidden",
  },
  communitySummaryTitle: {
    color: theme.colors.subtext,
    fontSize: 12,
    fontWeight: "500",
    paddingHorizontal: 14,
    paddingTop: 12,
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
  sourceMessage: {
    fontSize: theme.typography.small.fontSize,
    fontWeight: "500",
    lineHeight: theme.typography.small.lineHeight,
  },
  sourceMessageGreen: {
    color: theme.colors.success,
  },
  sourceMessageBlue: {
    color: theme.colors.sourceText,
  },
  sourceMessageAmber: {
    color: theme.colors.warningText,
  },
  sourceMessageRed: {
    color: theme.colors.danger,
  },
  // PHASE 4 STEP 22
  sourceSupportPanel: {
    backgroundColor: theme.colors.background,
    borderColor: theme.colors.lightBorder,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    gap: 7,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  sourceSupportKicker: {
    color: theme.colors.ai,
    fontSize: 11,
    fontWeight: "500",
  },
  sourceSupportRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 6,
  },
  sourceSupportText: {
    color: theme.colors.text,
    flex: 1,
    fontSize: 12,
    fontWeight: "500",
    lineHeight: 16,
  },
  sourceSupportPositive: {
    color: theme.colors.success,
  },
  sourceSupportWarning: {
    color: theme.colors.warningText,
  },
  sourceSupportNeutral: {
    color: theme.colors.subtext,
  },
  sourceSupportTitle: {
    color: theme.colors.text,
    fontSize: 13,
    fontWeight: "500",
    lineHeight: 18,
  },
  sourceSupportSummary: {
    color: theme.colors.subtext,
    fontSize: 12,
    lineHeight: 17,
  },
  sourceSupportDisclaimer: {
    color: theme.colors.muted,
    fontSize: 11,
    lineHeight: 15,
  },
  shareButton: {
    alignItems: "center",
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.sm,
    flexDirection: "row",
    gap: theme.spacing.sm,
    justifyContent: "center",
    marginTop: theme.spacing.md,
    paddingVertical: theme.spacing.md,
  },
  shareButtonText: {
    color: theme.colors.chipActiveText,
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
  // Shared media block wrapper under the description (image / YouTube / link).
  heroMediaBlock: {
    marginBottom: 10,
    marginTop: 10,
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
    backgroundColor: theme.colors.phaseBg,
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
    backgroundColor: theme.colors.dangerBg,
    borderColor: theme.colors.danger,
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
    color: theme.colors.warningText,
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
  // PHASE 4 STEP 23
  fieldHint: {
    color: theme.colors.muted,
    fontSize: 11,
    marginTop: theme.spacing.xs,
    textAlign: "right",
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
    backgroundColor: theme.colors.background,
    borderColor: theme.colors.lightBorder,
    borderRadius: 999,
    borderWidth: 0.5,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  reasonButtonSelected: {
    backgroundColor: theme.colors.dangerBg,
    borderColor: theme.colors.danger,
  },
  reasonButtonText: {
    color: theme.colors.muted,
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
    backgroundColor: theme.colors.background,
    borderColor: theme.colors.lightBorder,
    borderWidth: 0.5,
    borderRadius: 8,
    justifyContent: "center",
    padding: 10,
  },
  // PHASE 4 STEP 16
  reportIconButtonActive: {
    backgroundColor: theme.colors.danger,
    borderColor: theme.colors.danger,
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
    color: theme.colors.chipActiveText,
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
    color: theme.colors.chipActiveText,
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
  // PHASE 4 STEP 23
  evidenceHeaderRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: theme.spacing.sm,
    justifyContent: "space-between",
    marginBottom: theme.spacing.sm,
  },
  evidenceBadge: {
    alignSelf: "flex-start",
    borderRadius: theme.radius.sm,
    fontSize: theme.typography.small.fontSize,
    fontWeight: "500",
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
  },
  evidenceSourceRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 6,
    marginBottom: theme.spacing.sm,
  },
  evidenceDomain: {
    color: theme.colors.primary,
    flex: 1,
    fontSize: theme.typography.small.fontSize,
    fontWeight: "500",
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
  openSourceButton: {
    alignItems: "center",
    alignSelf: "flex-start",
    borderColor: theme.colors.lightBorder,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
  },
  openSourceButtonText: {
    color: theme.colors.link,
    fontSize: theme.typography.small.fontSize,
    fontWeight: "500",
  },
  // PHASE 5 STEP 6
  evidenceImagePreviewPanel: {
    gap: theme.spacing.sm,
  },
  evidenceImagePreview: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.sm,
    height: 160,
    width: "100%",
  },
  removeEvidenceImageButton: {
    alignSelf: "flex-start",
    borderColor: theme.colors.danger,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
  },
  removeEvidenceImageText: {
    color: theme.colors.danger,
    fontSize: theme.typography.small.fontSize,
    fontWeight: "500",
  },
  evidenceImage: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.sm,
    height: 160,
    marginBottom: theme.spacing.sm,
    width: "100%",
  },
  // PHASE 5 STEP 2
  // APPLE GUIDELINE 1.2 — user blocking (NEW)
  // Save/unsave claims: same compact-row shape as blockUserButton.
  saveClaimButton: {
    alignItems: "center",
    alignSelf: "flex-start",
    flexDirection: "row",
    gap: 6,
    marginTop: 8,
    minHeight: 32,
  },
  saveClaimButtonText: {
    color: theme.colors.link,
    fontSize: theme.typography.small.fontSize,
  },
  blockUserButton: {
    alignItems: "center",
    alignSelf: "flex-start",
    flexDirection: "row",
    gap: 6,
    marginTop: 8,
    minHeight: 32,
  },
  blockUserButtonText: {
    color: theme.colors.danger,
    fontSize: theme.typography.small.fontSize,
    fontWeight: "500",
  },
  // Author self-delete (NEW): same compact-row shape as blockUserButton.
  deleteClaimButton: {
    alignItems: "center",
    alignSelf: "flex-start",
    flexDirection: "row",
    gap: 6,
    marginTop: 8,
    minHeight: 32,
  },
  deleteClaimButtonText: {
    color: theme.colors.danger,
    fontSize: theme.typography.small.fontSize,
    fontWeight: "500",
  },
  reportEvidenceButton: {
    alignItems: "center",
    alignSelf: "flex-start",
    flexDirection: "row",
    gap: 5,
    marginTop: theme.spacing.sm,
    paddingVertical: 4,
  },
  reportEvidenceButtonText: {
    color: theme.colors.danger,
    fontSize: theme.typography.small.fontSize,
    fontWeight: "500",
  },
  // PHASE 5 STEP 3
  hiddenDetailCard: {
    alignItems: "center",
    backgroundColor: theme.colors.background,
    borderColor: theme.colors.lightBorder,
    borderRadius: theme.radius.md,
    borderWidth: 0.5,
    gap: 8,
    margin: 14,
    padding: 20,
  },
  hiddenDetailTitle: {
    color: theme.colors.text,
    fontSize: 18,
    fontWeight: "500",
  },
  hiddenDetailText: {
    color: theme.colors.subtext,
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
  hiddenEvidenceBox: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    paddingVertical: 8,
  },
  hiddenEvidenceText: {
    color: theme.colors.subtext,
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
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
}
