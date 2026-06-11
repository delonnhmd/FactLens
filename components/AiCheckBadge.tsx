// Verifact UI redesign
// PHASE 4 STEP 3
// PHASE 4 STEP 4
// PHASE 4 STEP 6
// PHASE 4 STEP 7
import { View, Text, StyleSheet } from "react-native";
import { useMemo } from "react";
import { Ionicons } from "@expo/vector-icons";
import type { AppTheme } from "../context/DisplaySettingsContext";
import { useAppTheme } from "../hooks/useTheme";
import type { AiCheck } from "../types/claim";

const aiCheckLabels: Record<AiCheck["status"], string> = {
  PENDING: "Pending",
  LOW_RISK: "Low Risk",
  MEDIUM_RISK: "Medium Risk",
  HIGH_RISK: "High Risk",
  LIKELY_TRUE: "Complete",
  LIKELY_FAKE: "Complete",
  NEEDS_MORE_EVIDENCE: "Needs More Evidence",
  NOT_FACT_CHECKABLE: "Not Fact-Checkable",
  ERROR: "Error",
};

interface AiCheckBadgeProps {
  status: AiCheck["status"];
}

export function AiCheckBadge({ status }: AiCheckBadgeProps) {
  const appTheme = useAppTheme();
  const styles = useMemo(() => createStyles(), []);
  const stateColors = getStateColors(appTheme);
  const colors = stateColors[status];

  return (
    <View style={[styles.badge, { backgroundColor: colors.backgroundColor }]}>
      <Ionicons name="sparkles-outline" size={12} color={colors.color} />
      <Text style={[styles.text, { color: colors.color }]}>AI Check: {aiCheckLabels[status]}</Text>
    </View>
  );
}

function getStateColors(theme: AppTheme): Record<AiCheck["status"], { backgroundColor: string; color: string }> {
  return {
    PENDING: {
      backgroundColor: theme.colors.warningBg,
      color: theme.colors.warningText,
    },
    LOW_RISK: {
      backgroundColor: theme.colors.aiBg,
      color: theme.colors.ai,
    },
    MEDIUM_RISK: {
      backgroundColor: theme.colors.warningBg,
      color: theme.colors.warningText,
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
    NOT_FACT_CHECKABLE: {
      backgroundColor: theme.colors.warningBg,
      color: theme.colors.warningText,
    },
    ERROR: {
      backgroundColor: theme.colors.dangerBg,
      color: theme.colors.danger,
    },
  };
}

function createStyles() {
  return StyleSheet.create({
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
}
