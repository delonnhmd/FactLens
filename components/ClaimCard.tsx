import { memo, useCallback, useEffect, useMemo, useRef } from "react";
import {
  Alert,
  Animated,
  Easing,
  Image,
  Linking,
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

function getAiDotColor(claim: Claim): string {
  if (claim.isFlagged) {
    return "#E24B4A";
  }

  if (claim.aiCheck.status === "PENDING" || claim.claimType === "OPINION") {
    return "#EF9F27";
  }

  return "#534AB7";
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

function ClaimCardComponent({ claim, onPress, onVote, onReport }: ClaimCardProps) {
  const appTheme = useAppTheme();
  const styles = useMemo(() => createStyles(appTheme), [appTheme]);
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
  // PHASE 5 STEP 6
  const thumbnailUrl = claim.media.thumbnailUrl || claim.media.imageUrl || null;
  // PHASE 5 election positioning UI
  const isLive = isLiveClaim(claim.createdAt);

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

  const handleReport = useCallback(async () => {
    try {
      await onReport(claim.id, "Spam", "");
      Alert.alert("Report submitted.");
    } catch (error) {
      Alert.alert("Could not submit report right now.");
    }
  }, [claim.id, onReport]);

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

  const handleOptions = useCallback(() => {
    Alert.alert("Post options", undefined, [
      {
        text: "Report",
        style: "destructive",
        onPress: () => {
          void handleReport();
        },
      },
      {
        text: "Share",
        onPress: () => Alert.alert("Share", claim.shareUrl),
      },
      {
        text: "Cancel",
        style: "cancel",
      },
    ]);
  }, [claim.shareUrl, handleReport]);

  // PHASE 5 STEP 3
  if (claim.hidden) {
    return (
      <View style={styles.card}>
        <View style={styles.hiddenContentBox}>
          <Ionicons name="shield-checkmark-outline" size={18} color={appTheme.colors.subtext} />
          <Text style={styles.hiddenContentTitle}>Content removed</Text>
          <Text style={styles.hiddenContentText}>
            This content was removed for violating community guidelines.
          </Text>
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
          <View style={styles.authorRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{avatarInitial}</Text>
            </View>
            <Text style={styles.authorMeta} numberOfLines={1}>
              {authorHandle} {"\u00B7"} {claim.author.rankTitle} {"\u00B7"} {getRelativeTime(claim.createdAt)}
            </Text>
          </View>

          <Text style={styles.title}>
            {claim.title}
          </Text>

          <Text style={styles.description}>
            {claim.description}
          </Text>

          {thumbnailUrl ? (
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => {
                Linking.openURL(claim.media.imageUrl || thumbnailUrl).catch(() => {
                  Alert.alert("Could not open image.");
                });
              }}
              accessibilityRole="button"
              accessibilityLabel="Open claim image"
              accessibilityHint="Opens the claim image in a browser"
            >
              <Image source={{ uri: thumbnailUrl }} style={styles.claimThumbnail} resizeMode="cover" />
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
        <View style={[styles.aiDot, { backgroundColor: getAiDotColor(claim) }]} />
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
          <Text style={styles.actionText}>...</Text>
        </TouchableOpacity>
      </View>
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
  authorMeta: {
    color: theme.colors.subtext,
    flex: 1,
    fontSize: theme.typography.small.fontSize,
    fontWeight: "400",
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
  // PHASE 5 STEP 6
  claimThumbnail: {
    backgroundColor: theme.colors.card,
    borderRadius: 8,
    height: 180,
    width: "100%",
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
    backgroundColor: "#FCEBEB",
    borderRadius: 999,
    flexDirection: "row",
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  liveBadgeText: {
    color: "#E24B4A",
    fontSize: 11,
    fontWeight: "500",
  },
  liveDot: {
    backgroundColor: "#E24B4A",
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
    color: theme.colors.warning,
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
    color: theme.colors.warning,
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
  });
}
