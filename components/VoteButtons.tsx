// PHASE 1 STEP 4
// PHASE 3 STEP 20E
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { theme } from "../constants/theme";
import type { VoteOption } from "../types/claim";

// PHASE 2 STEP 1
const voteOptions: Array<{ label: string; value: VoteOption; style: "primary" | "danger" | "warning" }> = [
  { label: "True", value: "TRUE", style: "primary" },
  { label: "Fake", value: "FAKE", style: "danger" },
  { label: "Not Sure", value: "NOT_SURE", style: "warning" },
];

export function getVoteOptionLabel(vote: VoteOption | null | undefined): string {
  if (vote === "TRUE") {
    return "True";
  }

  if (vote === "FAKE") {
    return "Fake";
  }

  if (vote === "NOT_SURE") {
    return "Not Sure";
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
  const activeVote = selectedVote ?? userVote ?? null;
  const isLocked = disabled || Boolean(activeVote);
  const visibleMessage = activeVote ? "You already voted on this post." : message;

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

const styles = StyleSheet.create({
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
    color: theme.colors.background,
    fontWeight: "700",
    fontSize: theme.typography.body.fontSize,
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
    backgroundColor: theme.colors.lightBorder,
    borderColor: theme.colors.border,
  },
  disabledLabel: {
    color: theme.colors.muted,
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
    fontWeight: "700",
  },
});
