// PHASE 4 STEP 11
// PHASE 4 STEP 11 REVISED
// PHASE 6 STEP 4 — optional topic cluster card (additive prop only).
// Frontend changes: JS-only, no native modules changed, no app.json changed.
// Deploy with: eas update --channel preview
// Do NOT run eas build — Apple review is in progress.
// Backend changes deploy to Render independently.
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useMemo } from "react";
import type { AppTheme } from "../context/DisplaySettingsContext";
import { useAppTheme } from "../hooks/useTheme";
import type { ClaimDraftAnalysis, ClaimDraftQualityLevel } from "../utils/claimQuality";
import type { TopicClusterInfo } from "../services/topicService";

type ClaimQualityBoxProps = {
  analysis: ClaimDraftAnalysis;
  hideBlockedSafetyFeedback?: boolean;
  onUseSuggestedTitle?: (title: string) => void;
  // PHASE 6 STEP 4 (NEW, optional): informational topic card shown above the
  // existing warnings. Never blocks submit; parent clears it on dismiss.
  topicCluster?: TopicClusterInfo | null;
  onDismissTopicCluster?: () => void;
};

const qualityCopy: Record<ClaimDraftQualityLevel, string> = {
  good: "Looks good to post.",
  soft_warning: "AI may classify this as opinion, question, or unclear.",
  blocked: "This content cannot be posted.",
};

export function ClaimQualityBox({
  analysis,
  hideBlockedSafetyFeedback = false,
  onUseSuggestedTitle,
  topicCluster,
  onDismissTopicCluster,
}: ClaimQualityBoxProps) {
  const appTheme = useAppTheme();
  const styles = useMemo(() => createStyles(appTheme), [appTheme]);
  const canUseSuggestedTitle = Boolean(analysis.rewrittenTitle && onUseSuggestedTitle);

  return (
    <>
      {/* PHASE 6 STEP 4 (NEW): topic cluster card — informational only,
          rendered above all existing warnings, dismissible, never blocks. */}
      {topicCluster ? (
        <View style={styles.topicCard}>
          <Text style={styles.topicHeading}>
            {"\u{1F4AC}"} {topicCluster.claim_count} {topicCluster.claim_count === 1 ? "person has" : "people have"} posted
            about {"'"}
            {topicCluster.topic_label}
            {"'"}
          </Text>
          <Text style={styles.topicBody}>
            Community so far: {topicCluster.total_vote_count} votes {"—"} {topicCluster.cluster_verdict}
          </Text>
          <Text style={styles.topicBody}>
            Your claim will be claim #{topicCluster.claim_count + 1} in this topic.
          </Text>
          {onDismissTopicCluster ? (
            <TouchableOpacity
              style={styles.topicDismissButton}
              activeOpacity={0.8}
              onPress={onDismissTopicCluster}
              accessibilityRole="button"
              accessibilityLabel="Dismiss topic info"
              accessibilityHint="Hides the topic cluster information"
            >
              <Text style={styles.topicDismissText}>Dismiss</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}
      {!(hideBlockedSafetyFeedback && analysis.qualityLevel === "blocked") ? (
        <View style={[styles.container, styles[analysis.qualityLevel]]}>
          <Text style={[styles.heading, styles[`${analysis.qualityLevel}Text`]]}>{qualityCopy[analysis.qualityLevel]}</Text>
          <Text style={styles.meta}>Detected type: {analysis.detectedType}</Text>

          {analysis.warnings.map((warning) => (
            <Text key={warning} style={styles.bodyText}>
              {warning}
            </Text>
          ))}

          {analysis.suggestions.map((suggestion) => (
            <Text key={suggestion} style={styles.bodyText}>
              {suggestion}
            </Text>
          ))}

          {analysis.rewrittenTitle ? (
            <View style={styles.rewritePanel}>
              <Text style={styles.rewriteLabel}>Suggested title</Text>
              <Text style={styles.rewriteText}>{analysis.rewrittenTitle}</Text>
              {canUseSuggestedTitle ? (
                <TouchableOpacity
                  style={styles.rewriteButton}
                  activeOpacity={0.8}
                  onPress={() => onUseSuggestedTitle?.(analysis.rewrittenTitle ?? "")}
                >
                  <Text style={styles.rewriteButtonText}>Use suggested title</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          ) : null}
        </View>
      ) : null}
    </>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
  container: {
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.lg,
    padding: theme.spacing.md,
  },
  good: {
    backgroundColor: theme.colors.successBg,
    borderColor: theme.colors.success,
  },
  soft_warning: {
    backgroundColor: theme.colors.warningBg,
    borderColor: theme.colors.warningBorder,
  },
  blocked: {
    backgroundColor: theme.colors.dangerBg,
    borderColor: theme.colors.danger,
  },
  goodText: {
    color: theme.colors.success,
  },
  soft_warningText: {
    color: theme.colors.warningText,
  },
  blockedText: {
    color: theme.colors.danger,
  },
  heading: {
    fontSize: theme.typography.body.fontSize,
    fontWeight: "500",
  },
  meta: {
    color: theme.colors.text,
    fontSize: theme.typography.small.fontSize,
    fontWeight: "500",
  },
  bodyText: {
    color: theme.colors.text,
    fontSize: theme.typography.small.fontSize,
    lineHeight: theme.typography.small.lineHeight,
  },
  rewritePanel: {
    backgroundColor: theme.colors.background,
    borderColor: theme.colors.lightBorder,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    gap: theme.spacing.sm,
    padding: theme.spacing.md,
  },
  rewriteLabel: {
    color: theme.colors.subtext,
    fontSize: theme.typography.small.fontSize,
    fontWeight: "500",
  },
  rewriteText: {
    color: theme.colors.text,
    fontSize: theme.typography.body.fontSize,
    lineHeight: theme.typography.body.lineHeight,
  },
  rewriteButton: {
    alignSelf: "flex-start",
    borderColor: theme.colors.primary,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  rewriteButtonText: {
    color: theme.colors.primary,
    fontSize: theme.typography.small.fontSize,
    fontWeight: "500",
  },
  // PHASE 6 STEP 4 (NEW): topic cluster card — navy background, subtle border.
  // theme.colors.banner is the app's navy banner color (see the midterms
  // banner on the home screen).
  topicCard: {
    backgroundColor: theme.colors.banner,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.lg,
    padding: theme.spacing.md,
  },
  topicHeading: {
    color: theme.colors.chipActiveText,
    fontSize: theme.typography.body.fontSize,
    fontWeight: "500",
  },
  topicBody: {
    color: theme.colors.bannerSubtitle,
    fontSize: theme.typography.small.fontSize,
    lineHeight: theme.typography.small.lineHeight,
  },
  topicDismissButton: {
    alignSelf: "flex-start",
    borderColor: theme.colors.bannerSubtitle,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  topicDismissText: {
    color: theme.colors.chipActiveText,
    fontSize: theme.typography.small.fontSize,
    fontWeight: "500",
  },
  });
}
