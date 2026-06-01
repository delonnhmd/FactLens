// PHASE 4 STEP 11
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { theme } from "../constants/theme";
import type { ClaimDraftAnalysis, ClaimDraftQualityLevel } from "../utils/claimQuality";

type ClaimQualityBoxProps = {
  analysis: ClaimDraftAnalysis;
  onUseSuggestedTitle?: (title: string) => void;
};

const qualityCopy: Record<ClaimDraftQualityLevel, string> = {
  good: "Claim quality looks good",
  warning: "Claim quality needs a stronger source",
  bad: "Claim may not be fact-checkable",
};

export function ClaimQualityBox({ analysis, onUseSuggestedTitle }: ClaimQualityBoxProps) {
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

const styles = StyleSheet.create({
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
  warning: {
    backgroundColor: theme.colors.warningBg,
    borderColor: theme.colors.warning,
  },
  bad: {
    backgroundColor: theme.colors.dangerBg,
    borderColor: theme.colors.danger,
  },
  goodText: {
    color: theme.colors.success,
  },
  warningText: {
    color: theme.colors.warning,
  },
  badText: {
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
