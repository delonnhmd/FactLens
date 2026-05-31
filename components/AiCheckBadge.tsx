// FactLens UI redesign
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../constants/theme";
import type { AiCheck } from "../types/claim";

const aiCheckLabels: Record<AiCheck["status"], string> = {
  PENDING: "Pending",
  LOW_RISK: "Low risk",
  MEDIUM_RISK: "Medium risk",
  LIKELY_TRUE: "Complete",
  LIKELY_FAKE: "Complete",
  NEEDS_MORE_EVIDENCE: "Needs more evidence",
};

const stateColors: Record<AiCheck["status"], { backgroundColor: string; color: string }> = {
  PENDING: {
    backgroundColor: theme.colors.warningBg,
    color: theme.colors.warning,
  },
  LOW_RISK: {
    backgroundColor: theme.colors.aiBg,
    color: theme.colors.ai,
  },
  MEDIUM_RISK: {
    backgroundColor: theme.colors.warningBg,
    color: theme.colors.warning,
  },
  LIKELY_TRUE: {
    backgroundColor: theme.colors.aiBg,
    color: theme.colors.ai,
  },
  LIKELY_FAKE: {
    backgroundColor: theme.colors.aiBg,
    color: theme.colors.ai,
  },
  NEEDS_MORE_EVIDENCE: {
    backgroundColor: theme.colors.dangerBg,
    color: theme.colors.danger,
  },
};

interface AiCheckBadgeProps {
  status: AiCheck["status"];
}

export function AiCheckBadge({ status }: AiCheckBadgeProps) {
  const colors = stateColors[status];

  return (
    <View style={[styles.badge, { backgroundColor: colors.backgroundColor }]}>
      <Ionicons name="sparkles-outline" size={12} color={colors.color} />
      <Text style={[styles.text, { color: colors.color }]}>AI check: {aiCheckLabels[status]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignItems: "center",
    alignSelf: "flex-start",
    borderRadius: 999,
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
