import { memo, useCallback, useMemo } from "react";
import { Alert, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { Claim, ClaimStatus, ReportReason, VoteOption } from "../types/claim";
import { theme } from "../constants/theme";
import { getSourceMessage, getSourceQuality, getSourceTrustLabel } from "../services/sourceQuality";

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

function ClaimCardComponent({ claim, onPress, onVote, onReport }: ClaimCardProps) {
  const sourceQuality = useMemo(() => getSourceQuality(claim.sourceUrl), [claim.sourceUrl]);
  const sourceDomain = getSourceDomain(claim.sourceUrl);
  // PHASE 4 STEP 18
  const useLocalSourceFallback = (!claim.sourceQuality || claim.sourceQuality === "unknown") && claim.sourceScore === null;
  const sourceScore = typeof claim.sourceScore === "number" ? Math.round(claim.sourceScore) : sourceQuality.score;
  const sourceQualityLabel = useLocalSourceFallback
    ? sourceQuality.label
    : getSourceTrustLabel(sourceScore, claim.sourceQuality || sourceQuality.label);
  const sourceMessage = useMemo(
    () => getSourceMessage(sourceScore, sourceQuality.label),
    [sourceQuality.label, sourceScore],
  );
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

  const handleVote = useCallback(
    async (vote: VoteOption) => {
      try {
        const message = await onVote(claim.id, vote);
        Alert.alert(typeof message === "string" ? message : `Vote saved: ${voteLabels[vote]}`);
      } catch (error) {
        Alert.alert(error instanceof Error ? error.message : "Could not save vote right now.");
      }
    },
    [claim.id, onVote],
  );

  const handleReport = useCallback(async () => {
    try {
      await onReport(claim.id, "Spam", "");
      Alert.alert("Report submitted.");
    } catch (error) {
      Alert.alert(error instanceof Error ? error.message : "Could not submit report right now.");
    }
  }, [claim.id, onReport]);

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
        text: "Repost",
        onPress: () => Alert.alert("Repost will be added later."),
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
          <Ionicons name="shield-checkmark-outline" size={18} color={theme.colors.subtext} />
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
      <TouchableOpacity onPress={onPress} activeOpacity={0.9} disabled={!onPress}>
        <View style={styles.body}>
          <View style={styles.authorRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{avatarInitial}</Text>
            </View>
            <Text style={styles.authorMeta} numberOfLines={1}>
              @{claim.authorUsername} {"\u00B7"} {claim.author.rankTitle} {"\u00B7"} {getRelativeTime(claim.createdAt)}
            </Text>
          </View>

          <Text style={styles.title} numberOfLines={2}>
            {claim.title}
          </Text>

          <Text style={styles.description} numberOfLines={2}>
            {claim.description}
          </Text>

          <View style={styles.badgeRow}>
            {claim.category ? <Text style={styles.categoryBadge}>{claim.category}</Text> : null}
            {claim.claimType === "OPINION" ? <Text style={styles.opinionBadge}>Opinion</Text> : null}
            {verdictLabel ? (
              <Text
                style={[
                  styles.verdictBadge,
                  claim.status === "FINALIZED_TRUE" && styles.verdictTrue,
                  claim.status === "FINALIZED_FAKE" && styles.verdictFake,
                  claim.status === "INSUFFICIENT_DATA" && styles.verdictEvidence,
                  claim.status === "COMMUNITY_TRUE" && styles.verdictTrue,
                  claim.status === "COMMUNITY_FAKE" && styles.verdictFake,
                  claim.status === "NEEDS_MORE_EVIDENCE" && styles.verdictEvidence,
                ]}
              >
                {verdictLabel}
              </Text>
            ) : null}
          </View>

          <View style={styles.sourceRow}>
            <Ionicons name="link-outline" size={13} color={theme.colors.link} />
            <Text style={styles.sourceDomain} numberOfLines={1}>
              {sourceDomain}
            </Text>
            <Text style={styles.sourcePill}>
              {sourceQualityLabel} {"\u00B7"} {sourceScore}/100
            </Text>
          </View>

          <Text
            style={[
              styles.sourceMessage,
              sourceMessage.color === "green" && styles.sourceMessageGreen,
              sourceMessage.color === "blue" && styles.sourceMessageBlue,
              sourceMessage.color === "amber" && styles.sourceMessageAmber,
              sourceMessage.color === "red" && styles.sourceMessageRed,
            ]}
            numberOfLines={1}
          >
            {sourceMessage.text}
          </Text>

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
          <Ionicons name="thumbs-up-outline" size={14} color={theme.colors.subtext} />
          <Text style={styles.actionText}>True</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.actionColumn, styles.actionDivider]} activeOpacity={0.8} onPress={() => handleVote("FAKE")}>
          <Ionicons name="thumbs-down-outline" size={14} color={theme.colors.subtext} />
          <Text style={styles.actionText}>Fake</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionColumn, styles.actionDivider]}
          activeOpacity={0.8}
          onPress={() => handleVote("NOT_SURE")}
        >
          <Ionicons name="help-circle-outline" size={14} color={theme.colors.subtext} />
          <Text style={styles.actionText}>Not sure</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.actionColumn, styles.actionDivider]} activeOpacity={0.8} onPress={handleOptions}>
          <Ionicons name="ellipsis-horizontal" size={14} color={theme.colors.subtext} />
          <Text style={styles.actionText}>...</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export const ClaimCard = memo(ClaimCardComponent);

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.background,
    borderColor: theme.colors.lightBorder,
    borderRadius: theme.radius.md,
    borderWidth: 0.5,
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
    backgroundColor: "#EAF3DE",
    borderRadius: 12,
    height: 24,
    justifyContent: "center",
    width: 24,
  },
  avatarText: {
    color: "#27500A",
    fontSize: 11,
    fontWeight: "600",
  },
  authorMeta: {
    color: theme.colors.subtext,
    flex: 1,
    fontSize: 12,
    fontWeight: "400",
  },
  title: {
    color: theme.colors.text,
    fontSize: 15,
    fontWeight: "500",
    lineHeight: 20,
  },
  description: {
    color: theme.colors.subtext,
    fontSize: 13,
    fontWeight: "400",
    lineHeight: 18,
  },
  badgeRow: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  categoryBadge: {
    backgroundColor: "#EAF3DE",
    borderRadius: 999,
    color: "#27500A",
    fontSize: 11,
    fontWeight: "500",
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  opinionBadge: {
    backgroundColor: "#F1EFE8",
    borderRadius: 999,
    color: "#444441",
    fontSize: 11,
    fontWeight: "500",
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  verdictBadge: {
    borderRadius: 999,
    fontSize: 11,
    fontWeight: "500",
    paddingHorizontal: 9,
    paddingVertical: 4,
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
    fontSize: 12,
    fontWeight: "500",
  },
  sourcePill: {
    backgroundColor: "#E6F1FB",
    borderRadius: 999,
    color: "#0C447C",
    fontSize: 11,
    fontWeight: "500",
    overflow: "hidden",
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  sourceMessage: {
    fontSize: 11,
    fontWeight: "500",
  },
  sourceMessageGreen: {
    color: theme.colors.success,
  },
  sourceMessageBlue: {
    color: theme.colors.sourceText,
  },
  sourceMessageAmber: {
    color: theme.colors.warning,
  },
  sourceMessageRed: {
    color: theme.colors.danger,
  },
  evidenceText: {
    color: theme.colors.subtext,
    fontSize: 11,
    fontWeight: "500",
  },
  aiStrip: {
    alignItems: "center",
    backgroundColor: theme.colors.secondarySurface,
    borderTopColor: theme.colors.lightBorder,
    borderTopWidth: 0.5,
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
    fontSize: 12,
    fontWeight: "400",
  },
  aiConfidence: {
    color: theme.colors.text,
    fontSize: 12,
    fontVariant: ["tabular-nums"],
    fontWeight: "500",
  },
  actionRow: {
    alignItems: "center",
    borderTopColor: theme.colors.lightBorder,
    borderTopWidth: 0.5,
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
    borderLeftWidth: 0.5,
  },
  actionText: {
    color: theme.colors.subtext,
    fontSize: 12,
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
    fontSize: 14,
    fontWeight: "700",
  },
  hiddenContentText: {
    color: theme.colors.subtext,
    fontSize: 13,
    lineHeight: 18,
    textAlign: "center",
  },
});
