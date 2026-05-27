// PHASE 1 STEP 4
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { theme } from "../constants/theme";
import type { VoteOption } from "../types/claim";

// PHASE 2 STEP 1
const voteOptions: Array<{ label: string; value: VoteOption; style: "primary" | "danger" | "warning" }> = [
  { label: "True", value: "TRUE", style: "primary" },
  { label: "Fake", value: "FAKE", style: "danger" },
  { label: "Not Sure", value: "NOT_SURE", style: "warning" },
];

interface VoteButtonsProps {
  disabled?: boolean;
  // PHASE 3 STEP 4
  userVote?: VoteOption | null;
  onVote: (vote: VoteOption) => void | Promise<void>;
}

export function VoteButtons({ disabled = false, userVote, onVote }: VoteButtonsProps) {
  return (
    <View style={styles.row}>
      {voteOptions.map((option, index) => {
        const selected = userVote === option.value;

        return (
          <TouchableOpacity
            key={option.value}
            style={[
              styles.button,
              styles[option.style],
              index > 0 && styles.buttonSpacing,
              disabled && !selected && styles.disabled,
              selected && styles.selected,
            ]}
            activeOpacity={0.8}
            disabled={disabled}
            onPress={() => onVote(option.value)}
          >
            <Text style={[styles.label, disabled && !selected && styles.disabledLabel]}>{option.label}</Text>
          </TouchableOpacity>
        );
      })}
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
});
