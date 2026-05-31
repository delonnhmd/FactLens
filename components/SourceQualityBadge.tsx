// PHASE 2 STEP 5
// FactLens UI redesign
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../constants/theme";
import type { SourceQuality, SourceQualityLabel } from "../services/sourceQuality";

const qualityColors: Record<SourceQualityLabel, { backgroundColor: string; color: string; borderColor: string }> = {
  "Strong Source": {
    backgroundColor: theme.colors.sourceBg,
    color: theme.colors.sourceText,
    borderColor: theme.colors.sourceBg,
  },
  "Medium Source": {
    backgroundColor: theme.colors.sourceBg,
    color: theme.colors.sourceText,
    borderColor: theme.colors.sourceBg,
  },
  "Weak Source": {
    backgroundColor: theme.colors.warningBg,
    color: theme.colors.warning,
    borderColor: theme.colors.warningBg,
  },
  "Unknown Source": {
    backgroundColor: theme.colors.secondarySurface,
    color: theme.colors.subtext,
    borderColor: theme.colors.secondarySurface,
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
      <Ionicons name="checkmark-circle-outline" size={12} color={colors.color} />
      <Text style={[styles.text, { color: colors.color }]}>
        {quality.label}
        {showScore ? ` - ${quality.score}/100` : ""}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignItems: "center",
    alignSelf: "flex-start",
    borderRadius: 999,
    borderWidth: 0.5,
    flexDirection: "row",
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  text: {
    fontSize: 11,
    fontWeight: "500",
  },
});
