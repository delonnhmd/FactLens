// PHASE 2 STEP 5
import { View, Text, StyleSheet } from "react-native";
import { theme } from "../constants/theme";
import type { SourceQuality, SourceQualityLabel } from "../services/sourceQuality";

const qualityColors: Record<SourceQualityLabel, { backgroundColor: string; color: string; borderColor: string }> = {
  "Strong Source": {
    backgroundColor: "#DCFCE7",
    color: theme.colors.success,
    borderColor: "#BBF7D0",
  },
  "Medium Source": {
    backgroundColor: "#E0E7FF",
    color: theme.colors.primary,
    borderColor: "#BFDBFE",
  },
  "Weak Source": {
    backgroundColor: "#FFEDD5",
    color: "#C2410C",
    borderColor: "#FED7AA",
  },
  "Unknown Source": {
    backgroundColor: "#F3F4F6",
    color: theme.colors.subtext,
    borderColor: theme.colors.border,
  },
};

interface SourceQualityBadgeProps {
  quality: SourceQuality;
  showScore?: boolean;
}

export function SourceQualityBadge({ quality, showScore = false }: SourceQualityBadgeProps) {
  const colors = qualityColors[quality.label];

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: colors.backgroundColor,
          borderColor: colors.borderColor,
        },
      ]}
    >
      <Text style={[styles.text, { color: colors.color }]}>
        {quality.label}
        {showScore ? ` - ${quality.score}/100` : ""}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: "flex-start",
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
  },
  text: {
    fontSize: theme.typography.small.fontSize,
    fontWeight: "700",
  },
});
