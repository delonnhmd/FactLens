// PHASE 4 STEP 11
// PHASE 4 STEP 11 REVISED
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useMemo } from "react";
import type { AppTheme } from "../context/DisplaySettingsContext";
import { useAppTheme } from "../hooks/useTheme";
import type { ClaimDraftAnalysis, ClaimDraftQualityLevel } from "../utils/claimQuality";

type ClaimQualityBoxProps = {
  analysis: ClaimDraftAnalysis;
  onUseSuggestedTitle?: (title: string) => void;
};

const qualityCopy: Record<ClaimDraftQualityLevel, string> = {
  good: "Looks good to post.",
  soft_warning: "AI may classify this as opinion, question, or unclear.",
  blocked: "This content cannot be posted.",
};

export function ClaimQualityBox({ analysis, onUseSuggestedTitle }: ClaimQualityBoxProps) {
  const appTheme = useAppTheme();
  const styles = useMemo(() => createStyles(appTheme), [appTheme]);
  const canUseSuggestedTitle = Boolean(analysis.rewrittenTitle && onUseSuggestedTitle);

  return (
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
  });
}
