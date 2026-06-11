// Verifact UI redesign
import { View, Text, StyleSheet } from "react-native";
import type { DimensionValue } from "react-native";
import { useMemo } from "react";
import type { AppTheme } from "../context/DisplaySettingsContext";
import { useAppTheme } from "../hooks/useTheme";

interface VoteBreakdownBarsProps {
  votesTrue: number;
  votesFake: number;
  votesUnsure: number;
  totalVotes: number;
}

export function VoteBreakdownBars({ votesTrue, votesFake, votesUnsure, totalVotes }: VoteBreakdownBarsProps) {
  const appTheme = useAppTheme();
  const styles = useMemo(() => createStyles(appTheme), [appTheme]);
  const barConfig = [
    { key: "true", label: "True", color: appTheme.colors.success },
    { key: "fake", label: "Fake", color: appTheme.colors.danger },
    { key: "unsure", label: "Not sure", color: appTheme.colors.warning },
  ] as const;
  const values = {
    true: votesTrue,
    fake: votesFake,
    unsure: votesUnsure,
  };

  return (
    <View style={styles.container}>
      <Text style={styles.sectionLabel}>Final vote breakdown · {totalVotes} votes</Text>
      {barConfig.map((item) => {
        const value = values[item.key];
        const width: DimensionValue = totalVotes > 0 ? `${Math.max((value / totalVotes) * 100, 4)}%` : "0%";

        return (
          <View key={item.key} style={styles.row}>
            <Text style={styles.label}>{item.label}</Text>
            <View style={styles.track}>
              <View style={[styles.fill, { backgroundColor: item.color, width }]} />
            </View>
            <Text style={styles.count}>{value}</Text>
          </View>
        );
      })}
    </View>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
  container: {
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  sectionLabel: {
    color: theme.colors.subtext,
    fontSize: 12,
    fontWeight: "400",
  },
  row: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
  },
  label: {
    color: theme.colors.subtext,
    fontSize: 12,
    fontWeight: "400",
    width: 52,
  },
  track: {
    backgroundColor: theme.colors.secondarySurface,
    borderRadius: 3,
    flex: 1,
    height: 6,
    overflow: "hidden",
  },
  fill: {
    borderRadius: 3,
    height: 6,
  },
  count: {
    color: theme.colors.text,
    fontSize: 12,
    fontWeight: "500",
    minWidth: 18,
    textAlign: "right",
  },
  });
}
