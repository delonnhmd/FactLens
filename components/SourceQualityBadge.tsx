// PHASE 2 STEP 5
// FactLens UI redesign
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../constants/theme";
import type { SourceQuality, SourceQualityLabel } from "../services/sourceQuality";

function getQualityColors(label: SourceQualityLabel) {
  if (label === "Tier 1 - Authoritative" || label === "Tier 2 - Established") {
    return {
      backgroundColor: theme.colors.sourceBg,
      color: theme.colors.sourceText,
      borderColor: theme.colors.sourceBg,
    };
  }

  if (label === "Tier 3 - Mixed") {
    return {
      backgroundColor: theme.colors.warningBg,
      color: theme.colors.warning,
      borderColor: theme.colors.warningBg,
    };
  }

  if (label === "Tier 4 - Low credibility") {
    return {
      backgroundColor: theme.colors.dangerBg,
      color: theme.colors.danger,
      borderColor: theme.colors.dangerBg,
    };
  }

  return {
    backgroundColor: theme.colors.secondarySurface,
    color: theme.colors.subtext,
    borderColor: theme.colors.secondarySurface,
  };
}

interface SourceQualityBadgeProps {
  quality: SourceQuality;
  showScore?: boolean;
}

export function SourceQualityBadge({ quality, showScore = false }: SourceQualityBadgeProps) {
  const colors = getQualityColors(quality.label);

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
