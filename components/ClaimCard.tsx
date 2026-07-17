// APPLE GUIDELINE 1.2 — "Block user" added to the post options menu (NEW)
// JS-only change. Deploy: eas update --channel preview
// Do NOT run eas build. Apple review response pending.
// Backend deploys to Render independently.
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Easing,
  Image,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { Claim, ClaimStatus, ReportReason, VoteOption } from "../types/claim";
import { getSourceQuality, getSourceTrustLabel } from "../services/sourceQuality";
import { useAppTheme, useDisplaySettings } from "../hooks/useTheme";
import type { AppTheme } from "../context/DisplaySettingsContext";
import { MentionText } from "./MentionText";
// Shared media block (image / YouTube thumb / link) — identical logic on the
// feed card and the claim detail screen.
import { ClaimMedia } from "./ClaimMedia";
import { resolveClaimMedia } from "../utils/claimMedia";
// APPLE GUIDELINE 1.2 — user blocking (NEW)
import { useAuth } from "../context/AuthContext";
import { useClaims } from "../context/ClaimsContext";
// Author self-delete (NEW): 3-hour / finalization window rule (shared with detail).
import {
  canAuthorDeleteClaim,
  formatDeleteWindowRemaining,
  getClaimDeleteWindowMsRemaining,
} from "../utils/claimDeletion";
// Report reason picker + note (shared with claim detail)
import { ReportNoteModal, showReportReasonPicker } from "./ReportClaimFlow";
// Admin moderation: hide/unhide a post straight from the "..." menu (admins only)
import { hideClaimFromFeeds, unhideClaim } from "../services/moderationService";
// Public user profile navigation
import { useRouter } from "expo-router";

// PHASE 4 STEP 18
// Source trust label update
const verdictLabels: Partial<Record<ClaimStatus, string>> = {
  FINALIZED_TRUE: "Finalized True",
  FINALIZED_FAKE: "Finalized Fake",
  INSUFFICIENT_DATA: "Insufficient data",
  COMMUNITY_TRUE: "Community Says True",
  COMMUNITY_FAKE: "Community Says Fake",
  NEEDS_MORE_EVIDENCE: "Needs more evidence",
};

const voteLabels: Record<VoteOption, string> = {
  TRUE: "True",
  FAKE: "Fake",
  NOT_SURE: "Not sure",
};

interface ClaimCardProps {
  claim: Claim;
  onPress?: () => void;
  onVote: (claimId: string, vote: VoteOption) => void | string | Promise<void | string>;
  onReport: (claimId: string, reason: ReportReason, note: string) => void | Promise<void>;
  // Author self-delete: list screens with their OWN local claim state (e.g. My
  // claims, public profile) pass this so a successful delete removes the row
  // instantly. The main feed reads from context and doesn't need it.
  onDeleted?: (claimId: string) => void;
}

// PHASE 5 PRE-LAUNCH: feed cards truncate long descriptions to ~100 words.
const FEED_DESCRIPTION_WORD_LIMIT = 100;

function truncateDescription(text: string, wordLimit = FEED_DESCRIPTION_WORD_LIMIT): string {
  if (!text) {
    return "";
  }

  const words = text.trim().split(/\s+/);

  if (words.length <= wordLimit) {
    return text;
  }

  return `${words.slice(0, wordLimit).join(" ")}...`;
}

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

  return `${Math.floor(diffHours / 24)}d ago`;
}

// PHASE 5 election positioning UI
function isLiveClaim(createdAt: string): boolean {
  const createdTime = new Date(createdAt).getTime();

  if (!Number.isFinite(createdTime)) {
    return false;
  }

  return Date.now() - createdTime < 2 * 60 * 60 * 1000;
}

// PHASE 5 election positioning UI
function LiveBadge({ styles }: { styles: ReturnType<typeof createStyles> }) {
  const pulseValue = useRef(new Animated.Value(0)).current;
  const { reduceMotionEnabled } = useDisplaySettings();

  useEffect(() => {
    if (reduceMotionEnabled) {
      return;
    }

    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseValue, {
          duration: 850,
          easing: Easing.out(Easing.quad),
          toValue: 1,
          useNativeDriver: true,
        }),
        Animated.timing(pulseValue, {
          duration: 850,
          easing: Easing.in(Easing.quad),
          toValue: 0,
          useNativeDriver: true,
        }),
      ]),
    );

    animation.start();

    return () => animation.stop();
  }, [pulseValue, reduceMotionEnabled]);

  const dotStyle = {
    opacity: pulseValue.interpolate({
      inputRange: [0, 1],
      outputRange: [0.55, 1],
    }),
    transform: [
      {
        scale: pulseValue.interpolate({
          inputRange: [0, 1],
          outputRange: [0.85, 1.25],
        }),
      },
    ],
  };

  return (
    <View style={styles.liveBadge}>
      {reduceMotionEnabled ? <View style={styles.liveDot} /> : <Animated.View style={[styles.liveDot, dotStyle]} />}
      <Text style={styles.liveBadgeText}>Live</Text>
    </View>
  );
}

function formatPercent(value: number | null | undefined): string {
  const normalized = value === null || value === undefined ? 0.5 : value > 1 ? value / 100 : value;
  return `${Math.round(normalized * 100)}%`;
}

// TASK 2 (admin badge): the author's badge_list is joined into every claim
// (CLAIM_PROFILE_SELECT -> mapAuthor.badgeList), so we can show an "Admin" badge
// on the author row from the same data the profile screens use. The badge is
// added to badge_list by SQL for the admin accounts.
function hasAdminBadge(badges: ReadonlyArray<{ id?: string; name?: string }> | null | undefined): boolean {
  return Boolean(badges?.some((badge) => badge?.id === "admin" || badge?.name?.toLowerCase() === "admin"));
}

function getSourceDomain(sourceUrl: string): string {
  const trimmedUrl = sourceUrl.trim();

  if (!trimmedUrl) {
    return "source";
  }

  try {
    const parsedUrl = new URL(trimmedUrl.includes("://") ? trimmedUrl : `https://${trimmedUrl}`);
    return parsedUrl.hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return trimmedUrl.replace(/^https?:\/\//i, "").replace(/^www\./i, "").split(/[/?#]/)[0] || "source";
  }
}

function getAiDotColor(claim: Claim, theme: AppTheme): string {
  if (claim.isFlagged) {
    return theme.colors.danger;
  }

  if (claim.aiCheck.status === "PENDING" || claim.claimType === "OPINION") {
    return theme.colors.warning;
  }

  return theme.colors.ai;
}

function getAiSummary(claim: Claim): string {
  return (
    claim.aiCheck.sourceNotes ||
    claim.aiSummary ||
    claim.aiCheck.reason ||
    "AI pre-check pending. Community voting decides the final result."
  );
}

function getSourcePillStyle(score: number, label: string, styles: ReturnType<typeof createStyles>) {
  if (label === "Not verified") {
    return styles.sourcePillNeutral;
  }

  if (score >= 90) {
    return styles.sourcePillGreen;
  }

  if (score >= 75) {
    return styles.sourcePillBlue;
  }

  if (score >= 40) {
    return styles.sourcePillAmber;
  }

  return styles.sourcePillRed;
}

function ClaimCardComponent({ claim, onPress, onVote, onReport, onDeleted }: ClaimCardProps) {
  const appTheme = useAppTheme();
  const styles = useMemo(() => createStyles(appTheme), [appTheme]);
  // APPLE GUIDELINE 1.2 — user blocking (NEW)
  const { currentUser, profile } = useAuth();
  const { blockUser, savedClaimIds, toggleSaveClaim, deleteOwnClaim, adminDeleteClaim } = useClaims();
  // Public user profile navigation; anonymized/deleted authors are not tappable.
  const router = useRouter();
  const authorIsAnonymous =
    !claim.authorId || claim.authorUsername === "deleted_user" || claim.authorDisplayName === "Deleted User";
  // PHASE 5 PRE-LAUNCH: collapse long descriptions until "Read more" is tapped.
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);
  const [avatarLoadFailed, setAvatarLoadFailed] = useState(false);
  const descriptionWordCount = claim.description ? claim.description.trim().split(/\s+/).length : 0;
  const descriptionIsLong = descriptionWordCount > FEED_DESCRIPTION_WORD_LIMIT;
  const displayDescription = descriptionExpanded ? claim.description : truncateDescription(claim.description);
  const sourceQuality = useMemo(() => getSourceQuality(claim.sourceUrl), [claim.sourceUrl]);
  const sourceDomain = getSourceDomain(claim.sourceUrl);
  // PHASE 4 STEP 18
  const useLocalSourceFallback = (!claim.sourceQuality || claim.sourceQuality === "unknown") && claim.sourceScore === null;
  const sourceScore = typeof claim.sourceScore === "number" ? Math.round(claim.sourceScore) : sourceQuality.score;
  const sourceQualityLabel =
    claim.sourceReadStatus === "failed"
      ? "Not verified"
      : useLocalSourceFallback
        ? sourceQuality.label
        : getSourceTrustLabel(sourceScore, claim.sourceQuality || sourceQuality.label);
  const verdictLabel =
    claim.status === "FINALIZED_TRUE" ||
    claim.status === "FINALIZED_FAKE" ||
    claim.status === "INSUFFICIENT_DATA" ||
    claim.status === "COMMUNITY_TRUE" ||
    claim.status === "COMMUNITY_FAKE" ||
    claim.status === "NEEDS_MORE_EVIDENCE"
      ? verdictLabels[claim.status]
      : null;
  const aiSummary = getAiSummary(claim);
  const avatarInitial = (claim.authorUsername || claim.authorDisplayName || "U").slice(0, 1).toUpperCase();
  const authorHandle = claim.authorUsername ? `@${claim.authorUsername}` : "Contributor";
  // TASK 2 (admin badge): show an Admin badge on the author row for admin accounts.
  const authorIsAdmin = !authorIsAnonymous && hasAdminBadge(claim.author?.badgeList);
  const showAvatarImage = Boolean(claim.authorAvatarUrl && !avatarLoadFailed && !authorIsAnonymous);
  // Only reserve space for the media block when the claim actually has media —
  // otherwise the body's `gap` would add an empty slot between author and title.
  const hasMedia = resolveClaimMedia(claim.media).kind !== "none";
  // PHASE 5 election positioning UI
  const isLive = isLiveClaim(claim.createdAt);

  useEffect(() => {
    setAvatarLoadFailed(false);
  }, [claim.authorAvatarUrl]);

  const handleVote = useCallback(
    async (vote: VoteOption) => {
      try {
        const message = await onVote(claim.id, vote);
        Alert.alert(typeof message === "string" ? message : `Vote saved: ${voteLabels[vote]}`);
      } catch (error) {
        Alert.alert("Could not record your vote. Please try again.");
      }
    },
    [claim.id, onVote],
  );

  // Reason chosen in step 1; non-null shows the note modal (step 2).
  const [pendingReportReason, setPendingReportReason] = useState<ReportReason | null>(null);

  const handleReport = useCallback(
    async (reason: ReportReason, note: string) => {
      try {
        await onReport(claim.id, reason, note);
        Alert.alert("Report submitted.");
      } catch (error) {
        Alert.alert("Could not submit report right now.");
      }
    },
    [claim.id, onReport],
  );

  const verdictIconName =
    claim.status === "FINALIZED_TRUE" || claim.status === "COMMUNITY_TRUE"
      ? "checkmark-circle-outline"
      : claim.status === "FINALIZED_FAKE" || claim.status === "COMMUNITY_FAKE"
      ? "close-circle-outline"
      : "help-circle-outline";

  const verdictIconColor =
    claim.status === "FINALIZED_TRUE" || claim.status === "COMMUNITY_TRUE"
      ? appTheme.colors.success
      : claim.status === "FINALIZED_FAKE" || claim.status === "COMMUNITY_FAKE"
      ? appTheme.colors.danger
      : appTheme.colors.warning;

  // APPLE GUIDELINE 1.2 — user blocking (NEW): confirmation → blockUser from
  // context → the author's claims vanish instantly via the context filter.
  const handleBlock = useCallback(() => {
    Alert.alert(
      `Block @${claim.authorUsername || "this user"}?`,
      "You won't see their claims anymore. This also notifies Verifact moderation.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Block",
          style: "destructive",
          onPress: () => {
            blockUser(claim.authorId, claim.id)
              .then(() => Alert.alert("User blocked."))
              .catch(() => Alert.alert("Could not block this user right now."));
          },
        },
      ],
    );
  }, [blockUser, claim.authorId, claim.authorUsername, claim.id]);

  // APPLE GUIDELINE 1.2 — user blocking (NEW): "Block user" hidden on the
  // user's own claims and when logged out; Report/Share/Cancel unchanged.
  const canBlockAuthor = Boolean(currentUser) && currentUser?.id !== claim.authorId;

  // Save/unsave claims: optimistic toggle via context; hidden when logged
  // out (same rule as Block user).
  const isSaved = savedClaimIds.includes(claim.id);

  const handleToggleSave = useCallback(() => {
    toggleSaveClaim(claim.id)
      .then((saved) => Alert.alert(saved ? "Saved" : "Removed"))
      .catch(() => Alert.alert("Could not update saved claims right now."));
  }, [claim.id, toggleSaveClaim]);

  // Author self-delete (NEW): only shown to the author within the 3-hour window
  // (see handleOptions). Confirm → backend delete → context removes it from the
  // feed. A 403 (window just passed) surfaces the backend's exact message.
  const handleDeleteOwnClaim = useCallback(() => {
    Alert.alert("Delete this claim?", "This can't be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          deleteOwnClaim(claim.id)
            .then(() => {
              onDeleted?.(claim.id);
              Alert.alert("Claim removed.");
            })
            .catch((error) =>
              Alert.alert(error instanceof Error ? error.message : "Could not remove the claim right now."),
            );
        },
      },
    ]);
  }, [claim.id, deleteOwnClaim, onDeleted]);

  // Admin moderation (NEW): hide/unhide a post from the "..." menu. is_admin
  // comes from the authenticated profile — the same source the admin dashboard
  // uses. Non-admins never see these options. hiddenOverride is the optimistic
  // local state so the card flips immediately; it resets on any claim refresh.
  const isAdmin = Boolean(profile?.is_admin);
  const [hiddenOverride, setHiddenOverride] = useState<boolean | null>(null);
  const claimHidden = hiddenOverride ?? Boolean(claim.hidden);

  useEffect(() => {
    setHiddenOverride(null);
  }, [claim.id, claim.hidden]);

  const handleToggleHidden = useCallback(() => {
    const currentlyHidden = claimHidden;
    setHiddenOverride(!currentlyHidden);

    const request = currentlyHidden
      ? unhideClaim(claim.id)
      : hideClaimFromFeeds(claim.id, "Hidden by moderation.");

    request
      .then((result) => {
        if (!result.ok) {
          throw new Error(result.error ?? "Admin action failed.");
        }
        Alert.alert(currentlyHidden ? "Post unhidden." : "Post hidden from feeds.");
      })
      .catch((error) => {
        // Roll back the optimistic flip and surface the BACKEND's actual error
        // (not a generic string) so failures are diagnosable.
        setHiddenOverride(currentlyHidden);
        Alert.alert(
          error instanceof Error
            ? error.message
            : currentlyHidden
              ? "Could not unhide this post right now."
              : "Could not hide this post right now.",
        );
      });
  }, [claim.id, claimHidden]);

  // Admin moderation delete (NEW): soft-delete from the "..." menu / hidden card.
  // Admins only. Confirms, then removes from feed state (context) + any local
  // list state (onDeleted), and surfaces the backend's exact error on failure.
  const handleAdminDelete = useCallback(() => {
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
                onDeleted?.(claim.id);
                Alert.alert("Claim deleted.");
              })
              .catch((error) =>
                Alert.alert(error instanceof Error ? error.message : "Could not delete this claim right now."),
              );
          },
        },
      ],
    );
  }, [adminDeleteClaim, claim.id, onDeleted]);

  // Native OS share sheet from the feed "..." menu. React Native's built-in
  // Share API — no new dependency. `claim.shareUrl` is https://factfight.com/claim/{id}.
  const handleShare = useCallback(async () => {
    try {
      const url = claim.shareUrl;
      await Share.share({
        message: `${claim.title}\n\nSee the evidence and vote on FactFight:\n${url}`,
        url,
        title: claim.title,
      });
    } catch {
      // user cancelled — no alert needed
    }
  }, [claim.shareUrl, claim.title]);

  const handleOptions = useCallback(() => {
    // Author self-delete (NEW): compute at tap time so the 3-hour window is
    // evaluated against the current clock. Hidden entirely once finalized or
    // past 3h, and never shown on other users' claims.
    const deleteMsRemaining = getClaimDeleteWindowMsRemaining(claim, Date.now());
    const canDeleteOwnClaim = canAuthorDeleteClaim(claim, currentUser?.id, Date.now());

    Alert.alert("Post options", undefined, [
      // Save/unsave claims (logged-in only)
      ...(currentUser
        ? [
            {
              text: isSaved ? "Unsave claim" : "Save claim",
              onPress: () => {
                void handleToggleSave();
              },
            },
          ]
        : []),
      // Author self-delete (NEW): own claim, not finalized, < 3h since posting.
      ...(canDeleteOwnClaim
        ? [
            {
              text: `Delete claim (${formatDeleteWindowRemaining(deleteMsRemaining)} left)`,
              style: "destructive" as const,
              onPress: handleDeleteOwnClaim,
            },
          ]
        : []),
      {
        text: "Report",
        style: "destructive",
        onPress: () => {
          // Step 1: reason picker, then step 2: optional note modal.
          showReportReasonPicker((reason) => setPendingReportReason(reason));
        },
      },
      // APPLE GUIDELINE 1.2 — user blocking (NEW)
      ...(canBlockAuthor
        ? [
            {
              text: "Block user",
              style: "destructive" as const,
              onPress: handleBlock,
            },
          ]
        : []),
      // Admin moderation (NEW): hide/unhide + delete the post. Admins only.
      ...(isAdmin
        ? [
            {
              text: claimHidden ? "Unhide post" : "Hide post",
              style: claimHidden ? ("default" as const) : ("destructive" as const),
              onPress: handleToggleHidden,
            },
            {
              text: "Delete claim",
              style: "destructive" as const,
              onPress: handleAdminDelete,
            },
          ]
        : []),
      {
        text: "Share",
        onPress: () => {
          void handleShare();
        },
      },
      {
        text: "Cancel",
        style: "cancel",
      },
    ]);
  }, [
    canBlockAuthor,
    claim,
    claim.shareUrl,
    claimHidden,
    currentUser,
    handleAdminDelete,
    handleBlock,
    handleDeleteOwnClaim,
    handleShare,
    handleToggleHidden,
    handleToggleSave,
    isAdmin,
    isSaved,
  ]);

  // PHASE 5 STEP 3
  if (claimHidden) {
    return (
      <View style={styles.card}>
        <View style={styles.hiddenContentBox}>
          <Ionicons name="shield-checkmark-outline" size={18} color={appTheme.colors.subtext} />
          <Text style={styles.hiddenContentTitle}>Content removed</Text>
          <Text style={styles.hiddenContentText}>
            This content was removed for violating community guidelines.
          </Text>
          {/* Admin moderation (NEW): a hidden claim shows this placeholder
              instead of the "..." menu, so admins get Unhide AND Delete here.
              Delete works on a hidden claim directly (no need to unhide first). */}
          {isAdmin ? (
            <View style={styles.hiddenAdminActions}>
              <TouchableOpacity
                style={styles.hiddenUnhideButton}
                activeOpacity={0.8}
                onPress={handleToggleHidden}
                accessibilityRole="button"
                accessibilityLabel="Unhide post"
              >
                <Text style={styles.hiddenUnhideButtonText}>Unhide post</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.hiddenDeleteButton}
                activeOpacity={0.8}
                onPress={handleAdminDelete}
                accessibilityRole="button"
                accessibilityLabel="Delete claim"
              >
                <Text style={styles.hiddenDeleteButtonText}>Delete</Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.9}
        disabled={!onPress}
        accessibilityRole="button"
        accessibilityState={{ disabled: !Boolean(onPress) }}
        accessibilityLabel={`Open claim: ${claim.title}`}
        accessibilityHint="View full claim details and evidence"
      >
        <View style={styles.body}>
          <TouchableOpacity
            style={styles.authorRow}
            activeOpacity={0.8}
            disabled={authorIsAnonymous}
            onPress={() => router.push(`/user/${claim.authorId}`)}
            accessibilityRole="button"
            accessibilityLabel={`View ${authorHandle}'s profile`}
            accessibilityHint="Opens this contributor's public profile and claims"
          >
            <View style={styles.avatar}>
              {showAvatarImage && claim.authorAvatarUrl ? (
                <Image
                  source={{ uri: claim.authorAvatarUrl }}
                  style={styles.avatarImage}
                  onError={() => setAvatarLoadFailed(true)}
                />
              ) : (
                <Text style={styles.avatarText}>{avatarInitial}</Text>
              )}
            </View>
            {/* TASK 2 (admin badge): distinct Admin pill for admin authors. */}
            {authorIsAdmin ? (
              <Text
                style={styles.adminBadge}
                accessibilityRole="text"
                accessibilityLabel="Admin account"
              >
                Admin
              </Text>
            ) : null}
            <Text style={styles.authorMeta} numberOfLines={1}>
              {authorHandle} {"\u00B7"} {claim.author.rankTitle} {"\u00B7"} {getRelativeTime(claim.createdAt)}
            </Text>
          </TouchableOpacity>

          {/* MEDIA BLOCK (image / YouTube thumb / link) — full-bleed, directly
              under the author row and above the title. Tapping it opens the
              claim detail, same as tapping the card. Nothing renders (and no
              gap is reserved) when the claim has no media. */}
          {hasMedia ? (
            <View style={styles.mediaBlock}>
              <ClaimMedia media={claim.media} onPress={onPress} borderRadius={0} />
            </View>
          ) : null}

          <Text style={styles.title}>
            {claim.title}
          </Text>

          <MentionText text={displayDescription} style={styles.description} />
          {descriptionIsLong && !descriptionExpanded ? (
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => setDescriptionExpanded(true)}
              accessibilityRole="button"
              accessibilityLabel="Read more"
              accessibilityHint="Expands the full claim description"
            >
              <Text style={styles.readMore}>Read more</Text>
            </TouchableOpacity>
          ) : null}

          <View style={styles.badgeRow}>
            {isLive ? <LiveBadge styles={styles} /> : null}
            {claim.category ? <Text style={styles.categoryBadge}>{claim.category}</Text> : null}
            {claim.subCategory === "Election 2026" ? (
              <Text style={styles.electionBadge}>Election 2026</Text>
            ) : null}
            {claim.claimType === "OPINION" ? <Text style={styles.opinionBadge}>Opinion</Text> : null}
            {verdictLabel ? (
              <View
                style={[
                  styles.verdictBadge,
                  claim.status === "FINALIZED_TRUE" && styles.verdictTrue,
                  claim.status === "FINALIZED_FAKE" && styles.verdictFake,
                  claim.status === "INSUFFICIENT_DATA" && styles.verdictEvidence,
                  claim.status === "COMMUNITY_TRUE" && styles.verdictTrue,
                  claim.status === "COMMUNITY_FAKE" && styles.verdictFake,
                  claim.status === "NEEDS_MORE_EVIDENCE" && styles.verdictEvidence,
                ]}
                accessible
                accessibilityRole="text"
                accessibilityLabel={`Verdict: ${verdictLabel}`}
              >
                <Ionicons name={verdictIconName} size={12} color={verdictIconColor} />
                <Text style={[styles.verdictBadgeText, { color: verdictIconColor }]}>{verdictLabel}</Text>
              </View>
            ) : null}
          </View>

          <View style={styles.sourceRow}>
            <Ionicons name="link-outline" size={13} color={appTheme.colors.link} />
            <Text style={styles.sourceDomain} numberOfLines={1}>
              {sourceDomain}
            </Text>
            <Text style={[styles.sourcePill, getSourcePillStyle(sourceScore, sourceQualityLabel, styles)]}>
              {sourceQualityLabel} {"\u00B7"} {sourceScore}/100
            </Text>
          </View>

          {claim.evidenceCount > 0 ? (
            <Text style={styles.evidenceText}>
              {claim.evidenceCount} evidence {claim.evidenceCount === 1 ? "link" : "links"}
            </Text>
          ) : null}
        </View>
      </TouchableOpacity>

      <View style={styles.aiStrip}>
        <View style={[styles.aiDot, { backgroundColor: getAiDotColor(claim, appTheme) }]} />
        <Text style={styles.aiSummary} numberOfLines={1}>
          {aiSummary}
        </Text>
        <Text style={styles.aiConfidence}>{formatPercent(claim.aiCheck.confidence ?? claim.aiConfidence)}</Text>
      </View>

      <View style={styles.actionRow}>
        <TouchableOpacity style={styles.actionColumn} activeOpacity={0.8} onPress={() => handleVote("TRUE")}>
          <Ionicons name="thumbs-up-outline" size={14} color={appTheme.colors.subtext} />
          <Text style={styles.actionText}>True</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.actionColumn, styles.actionDivider]} activeOpacity={0.8} onPress={() => handleVote("FAKE")}>
          <Ionicons name="thumbs-down-outline" size={14} color={appTheme.colors.subtext} />
          <Text style={styles.actionText}>Fake</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionColumn, styles.actionDivider]}
          activeOpacity={0.8}
          onPress={() => handleVote("NOT_SURE")}
        >
          <Ionicons name="help-circle-outline" size={14} color={appTheme.colors.subtext} />
          <Text style={styles.actionText}>Not sure</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.actionColumn, styles.actionDivider]} activeOpacity={0.8} onPress={handleOptions}>
          <Ionicons name="ellipsis-horizontal" size={14} color={appTheme.colors.subtext} />
          <Text style={styles.actionText}>More</Text>
        </TouchableOpacity>
      </View>
      {/* Step 2 of the report flow: optional note before the existing submit. */}
      <ReportNoteModal
        visible={pendingReportReason !== null}
        onCancel={() => setPendingReportReason(null)}
        onSubmit={(note) => {
          const reason = pendingReportReason;
          setPendingReportReason(null);

          if (reason) {
            void handleReport(reason, note);
          }
        }}
      />
    </View>
  );
}

export const ClaimCard = memo(ClaimCardComponent);

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
  card: {
    backgroundColor: theme.colors.background,
    borderColor: theme.colors.lightBorder,
    borderRadius: theme.radius.md,
    borderWidth: theme.borderWidth,
    marginBottom: 10,
    overflow: "hidden",
  },
  body: {
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  authorRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
  },
  avatar: {
    alignItems: "center",
    backgroundColor: theme.colors.leaderboardAvatar,
    borderRadius: 12,
    height: 28,
    justifyContent: "center",
    width: 28,
  },
  avatarText: {
    color: theme.colors.leaderboardAvatarText,
    fontSize: Math.round(11 * (theme.typography.body.fontSize / 16)),
    fontWeight: "500",
  },
  avatarImage: {
    borderRadius: 12,
    height: 28,
    width: 28,
  },
  authorMeta: {
    color: theme.colors.subtext,
    flex: 1,
    fontSize: theme.typography.small.fontSize,
    fontWeight: "400",
  },
  // TASK 2 (admin badge): distinct red pill so admin accounts are recognizable
  // on the author row of every claim card.
  adminBadge: {
    backgroundColor: theme.colors.danger,
    borderRadius: 999,
    color: theme.colors.chipActiveText,
    fontSize: Math.round(10 * (theme.typography.body.fontSize / 16)),
    fontWeight: "700",
    overflow: "hidden",
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  title: {
    color: theme.colors.text,
    fontSize: Math.round(15 * (theme.typography.body.fontSize / 16)),
    fontWeight: "500",
    lineHeight: Math.round(20 * (theme.typography.body.fontSize / 16)),
    flexShrink: 1,
  },
  description: {
    color: theme.colors.subtext,
    fontSize: Math.round(13 * (theme.typography.body.fontSize / 16)),
    fontWeight: "400",
    lineHeight: Math.round(18 * (theme.typography.body.fontSize / 16)),
    flexShrink: 1,
  },
  // PHASE 5 PRE-LAUNCH
  readMore: {
    color: theme.colors.link,
    fontSize: Math.round(13 * (theme.typography.body.fontSize / 16)),
    fontWeight: "500",
    marginTop: 4,
  },
  // MEDIA BLOCK: full-bleed to the card edges (cancels the body's horizontal
  // padding) so the 16:9 media spans the full card width with no side gaps.
  mediaBlock: {
    marginHorizontal: -14,
  },
  badgeRow: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  categoryBadge: {
    backgroundColor: theme.colors.chipInactiveBg,
    borderRadius: 999,
    color: theme.colors.chipInactiveText,
    fontSize: Math.round(11 * (theme.typography.body.fontSize / 16)),
    fontWeight: "500",
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  // PHASE 5 election positioning UI
  liveBadge: {
    alignItems: "center",
    backgroundColor: theme.colors.dangerBg,
    borderRadius: 999,
    flexDirection: "row",
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  liveBadgeText: {
    color: theme.colors.danger,
    fontSize: 11,
    fontWeight: "500",
  },
  liveDot: {
    backgroundColor: theme.colors.danger,
    borderRadius: 4,
    height: 7,
    width: 7,
  },
  electionBadge: {
    backgroundColor: theme.colors.chipActiveBg,
    borderRadius: 999,
    color: theme.colors.chipActiveText,
    fontSize: Math.round(11 * (theme.typography.body.fontSize / 16)),
    fontWeight: "500",
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  opinionBadge: {
    backgroundColor: theme.colors.secondarySurface,
    borderRadius: 999,
    color: theme.colors.subtext,
    fontSize: Math.round(11 * (theme.typography.body.fontSize / 16)),
    fontWeight: "500",
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  verdictBadge: {
    alignItems: "center",
    borderRadius: 999,
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  verdictBadgeText: {
    fontSize: Math.round(11 * (theme.typography.body.fontSize / 16)),
    fontWeight: "500",
  },
  verdictEvidence: {
    backgroundColor: theme.colors.warningBg,
    color: theme.colors.warningText,
  },
  verdictTrue: {
    backgroundColor: theme.colors.successBg,
    color: theme.colors.success,
  },
  verdictFake: {
    backgroundColor: theme.colors.dangerBg,
    color: theme.colors.danger,
  },
  sourceRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 6,
  },
  sourceDomain: {
    color: theme.colors.link,
    flexShrink: 1,
    fontSize: theme.typography.small.fontSize,
    fontWeight: "500",
  },
  sourcePill: {
    borderRadius: 999,
    fontSize: Math.round(11 * (theme.typography.body.fontSize / 16)),
    fontWeight: "500",
    overflow: "hidden",
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  sourcePillGreen: {
    backgroundColor: theme.colors.successBg,
    color: theme.colors.success,
  },
  sourcePillBlue: {
    backgroundColor: theme.colors.sourceBg,
    color: theme.colors.sourceText,
  },
  sourcePillAmber: {
    backgroundColor: theme.colors.warningBg,
    color: theme.colors.warningText,
  },
  sourcePillRed: {
    backgroundColor: theme.colors.dangerBg,
    color: theme.colors.danger,
  },
  sourcePillNeutral: {
    backgroundColor: theme.colors.secondarySurface,
    color: theme.colors.subtext,
  },
  evidenceText: {
    color: theme.colors.subtext,
    fontSize: Math.round(11 * (theme.typography.body.fontSize / 16)),
    fontWeight: "500",
  },
  aiStrip: {
    alignItems: "center",
    backgroundColor: theme.colors.secondarySurface,
    borderTopColor: theme.colors.lightBorder,
    borderTopWidth: theme.borderWidth,
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  aiDot: {
    borderRadius: 3,
    height: 6,
    width: 6,
  },
  aiSummary: {
    color: theme.colors.subtext,
    flex: 1,
    fontSize: theme.typography.small.fontSize,
    fontWeight: "400",
  },
  aiConfidence: {
    color: theme.colors.text,
    fontSize: theme.typography.small.fontSize,
    fontVariant: ["tabular-nums"],
    fontWeight: "500",
  },
  actionRow: {
    alignItems: "center",
    borderTopColor: theme.colors.lightBorder,
    borderTopWidth: theme.borderWidth,
    flexDirection: "row",
    minHeight: 44,
  },
  actionColumn: {
    alignItems: "center",
    flex: 1,
    gap: 3,
    justifyContent: "center",
    minHeight: 44,
  },
  actionDivider: {
    borderLeftColor: theme.colors.lightBorder,
    borderLeftWidth: theme.borderWidth,
  },
  actionText: {
    color: theme.colors.subtext,
    fontSize: theme.typography.small.fontSize,
    fontWeight: "400",
  },
  // PHASE 5 STEP 3
  hiddenContentBox: {
    alignItems: "center",
    gap: 6,
    padding: 16,
  },
  hiddenContentTitle: {
    color: theme.colors.text,
    fontSize: Math.round(14 * (theme.typography.body.fontSize / 16)),
    fontWeight: "500",
  },
  hiddenContentText: {
    color: theme.colors.subtext,
    fontSize: Math.round(13 * (theme.typography.body.fontSize / 16)),
    lineHeight: Math.round(18 * (theme.typography.body.fontSize / 16)),
    textAlign: "center",
  },
  hiddenUnhideButton: {
    borderColor: theme.colors.border,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  hiddenUnhideButtonText: {
    color: theme.colors.link,
    fontSize: Math.round(13 * (theme.typography.body.fontSize / 16)),
    fontWeight: "500",
  },
  // Admin actions row on the hidden "Content removed" card: Unhide + Delete.
  hiddenAdminActions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 8,
  },
  hiddenDeleteButton: {
    borderColor: theme.colors.danger,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  hiddenDeleteButtonText: {
    color: theme.colors.danger,
    fontSize: Math.round(13 * (theme.typography.body.fontSize / 16)),
    fontWeight: "500",
  },
  });
}
