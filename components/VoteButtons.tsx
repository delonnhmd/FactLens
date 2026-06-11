// PHASE 1 STEP 4
// PHASE 3 STEP 20E
// Verifact UI redesign
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useMemo } from "react";
import type { AppTheme } from "../context/DisplaySettingsContext";
import { useAppTheme } from "../hooks/useTheme";
import type { VoteOption } from "../types/claim";

// PHASE 2 STEP 1
const voteOptions: Array<{ label: string; value: VoteOption; style: "primary" | "danger" | "warning" }> = [
  { label: "True", value: "TRUE", style: "primary" },
  { label: "Fake", value: "FAKE", style: "danger" },
  { label: "Not sure", value: "NOT_SURE", style: "warning" },
];

export function getVoteOptionLabel(vote: VoteOption | null | undefined): string {
  if (vote === "TRUE") {
    return "True";
  }

  if (vote === "FAKE") {
    return "Fake";
  }

  if (vote === "NOT_SURE") {
    return "Not sure";
  }

  return "";
}

interface VoteButtonsProps {
  disabled?: boolean;
  // PHASE 3 STEP 4
  userVote?: VoteOption | null;
  // PHASE 3 STEP 20E
  selectedVote?: VoteOption | null;
  message?: string;
  onVote: (vote: VoteOption) => void | string | Promise<void | string>;
}

export function VoteButtons({
  disabled = false,
  userVote,
  selectedVote,
  message,
  onVote,
}: VoteButtonsProps) {
  const appTheme = useAppTheme();
  const styles = useMemo(() => createStyles(appTheme), [appTheme]);
  const activeVote = selectedVote ?? userVote ?? null;
  const isLocked = disabled || Boolean(activeVote);
  // PHASE 4 STEP 24
  const visibleMessage = activeVote ? "You already voted on this claim." : message;

  return (
    <View>
      <View style={styles.row}>
        {voteOptions.map((option, index) => {
          const selected = activeVote === option.value;

          return (
            <TouchableOpacity
              key={option.value}
              style={[
                styles.button,
                styles[option.style],
                index > 0 && styles.buttonSpacing,
                isLocked && !selected && styles.disabled,
                selected && styles.selected,
              ]}
              activeOpacity={0.8}
              disabled={isLocked}
              accessibilityRole="button"
              accessibilityLabel={`Vote ${option.label}`}
              accessibilityHint="Cast your vote"
              accessibilityState={{ disabled: isLocked, selected }}
              onPress={() => onVote(option.value)}
            >
              <Text style={[styles.label, isLocked && !selected && styles.disabledLabel]}>{option.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      {visibleMessage ? (
        <Text style={[styles.message, activeVote && styles.selectedMessage]}>{visibleMessage}</Text>
      ) : null}
    </View>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  button: {
    flex: 1,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.radius.sm,
    alignItems: "center",
    borderWidth: 2,
    borderColor: "transparent",
  },
  buttonSpacing: {
    marginLeft: theme.spacing.sm,
  },
  label: {
    color: theme.colors.chipActiveText,
    fontWeight: "500",
    fontSize: 14,
  },
  primary: {
    backgroundColor: theme.colors.primary,
  },
  danger: {
    backgroundColor: theme.colors.danger,
  },
  warning: {
    backgroundColor: theme.colors.warning,
  },
  disabled: {
    backgroundColor: theme.colors.disabledBg,
    borderColor: theme.colors.disabledBg,
  },
  disabledLabel: {
    color: theme.colors.disabledText,
  },
  selected: {
    borderColor: theme.colors.text,
  },
  message: {
    color: theme.colors.subtext,
    fontSize: theme.typography.small.fontSize,
    marginTop: theme.spacing.sm,
  },
  selectedMessage: {
    color: theme.colors.primary,
    fontWeight: "500",
  },
  });
}
