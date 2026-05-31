// FactLens UI redesign
// PHASE 4 STEP 3
// PHASE 4 STEP 4
// PHASE 4 STEP 6
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../constants/theme";
import type { AiCheck } from "../types/claim";

const aiCheckLabels: Record<AiCheck["status"], string> = {
  PENDING: "Pending",
  LOW_RISK: "Low Risk",
  MEDIUM_RISK: "Medium Risk",
  HIGH_RISK: "High Risk",
  LIKELY_TRUE: "Complete",
  LIKELY_FAKE: "Complete",
  NEEDS_MORE_EVIDENCE: "Needs More Evidence",
  ERROR: "Error",
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
  HIGH_RISK: {
    backgroundColor: theme.colors.dangerBg,
    color: theme.colors.danger,
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
  ERROR: {
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
      <Text style={[styles.text, { color: colors.color }]}>AI Check: {aiCheckLabels[status]}</Text>
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
