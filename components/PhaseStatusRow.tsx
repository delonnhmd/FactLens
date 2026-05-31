// FactLens UI redesign
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../constants/theme";

interface PhaseStatusRowProps {
  timeLabel: string;
  phaseLabel: string;
}

export function PhaseStatusRow({ timeLabel, phaseLabel }: PhaseStatusRowProps) {
  return (
    <View style={styles.row}>
      <View style={styles.left}>
        <Ionicons name="time-outline" size={13} color={theme.colors.subtext} />
        <Text style={styles.timeText}>{timeLabel}</Text>
      </View>
      <View style={styles.phasePill}>
        <Text style={styles.phaseText}>{phaseLabel}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: "center",
    backgroundColor: theme.colors.secondarySurface,
    borderTopColor: theme.colors.lightBorder,
    borderTopWidth: 0.5,
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 38,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  left: {
    alignItems: "center",
    flexDirection: "row",
    flex: 1,
    gap: 5,
  },
  timeText: {
    color: theme.colors.subtext,
    fontSize: 11,
    fontWeight: "400",
  },
  phasePill: {
    backgroundColor: theme.colors.phaseBg,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  phaseText: {
    color: theme.colors.phaseText,
    fontSize: 11,
    fontWeight: "500",
  },
});
