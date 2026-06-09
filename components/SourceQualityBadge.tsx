// PHASE 2 STEP 5
// Verifact UI redesign
// PHASE 4 STEP 18
// Source trust label update
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../constants/theme";
import type { SourceQuality, SourceQualityLabel } from "../services/sourceQuality";

function getQualityColors(label: SourceQualityLabel) {
  if (label === "Highly Trusted") {
    return {
      backgroundColor: theme.colors.successBg,
      color: theme.colors.success,
      borderColor: theme.colors.successBg,
    };
  }

  if (label === "Trusted") {
    return {
      backgroundColor: theme.colors.sourceBg,
      color: theme.colors.sourceText,
      borderColor: theme.colors.sourceBg,
    };
  }

  if (label === "Moderate" || label === "Use Caution") {
    return {
      backgroundColor: theme.colors.warningBg,
      color: theme.colors.warning,
      borderColor: theme.colors.warningBg,
    };
  }

  if (label === "Low Trust" || label === "Invalid URL") {
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
