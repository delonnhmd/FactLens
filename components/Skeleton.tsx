// PHASE 5 STEP 5 PRE-LAUNCH
import { StyleSheet, View } from "react-native";
import { useAppTheme } from "../hooks/useTheme";
import type { AppTheme } from "../context/DisplaySettingsContext";

export function ClaimCardSkeleton() {
  const appTheme = useAppTheme();
  const styles = createStyles(appTheme);

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <View style={styles.avatar} />
        <View style={[styles.line, styles.lineMedium]} />
      </View>
      <View style={[styles.line, styles.lineFull]} />
      <View style={[styles.line, styles.lineWide]} />
      <View style={styles.pillRow}>
        <View style={styles.pill} />
        <View style={styles.pill} />
      </View>
      <View style={styles.divider} />
      <View style={[styles.line, styles.lineWide]} />
    </View>
  );
}

export function ClaimListSkeleton({ count = 3 }: { count?: number }) {
  const appTheme = useAppTheme();
  const styles = createStyles(appTheme);

  return (
    <View style={styles.stack}>
      {Array.from({ length: count }).map((_, index) => (
        <ClaimCardSkeleton key={index} />
      ))}
    </View>
  );
}

export function LeaderboardSkeleton({ count = 6 }: { count?: number }) {
  const appTheme = useAppTheme();
  const styles = createStyles(appTheme);

  return (
    <View style={styles.card}>
      {Array.from({ length: count }).map((_, index) => (
        <View key={index} style={styles.leaderRow}>
          <View style={styles.position} />
          <View style={styles.avatar} />
          <View style={[styles.line, styles.lineMedium]} />
          <View style={[styles.line, styles.lineShort]} />
        </View>
      ))}
    </View>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
  stack: {
    gap: 10,
  },
  card: {
    backgroundColor: theme.colors.background,
    borderColor: theme.colors.lightBorder,
    borderRadius: theme.radius.md,
    borderWidth: theme.borderWidth,
    gap: 10,
    marginBottom: 10,
    padding: 14,
  },
  row: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
  },
  avatar: {
    backgroundColor: theme.colors.secondarySurface,
    borderRadius: 14,
    height: 28,
    width: 28,
  },
  position: {
    backgroundColor: theme.colors.secondarySurface,
    borderRadius: 12,
    height: 24,
    width: 24,
  },
  line: {
    backgroundColor: theme.colors.secondarySurface,
    borderRadius: 999,
    height: 10,
  },
  lineFull: {
    width: "100%",
  },
  lineWide: {
    width: "78%",
  },
  lineMedium: {
    flex: 1,
  },
  lineShort: {
    width: 54,
  },
  pillRow: {
    flexDirection: "row",
    gap: 6,
  },
  pill: {
    backgroundColor: theme.colors.secondarySurface,
    borderRadius: 999,
    height: 22,
    width: 86,
  },
  divider: {
    backgroundColor: theme.colors.lightBorder,
    height: theme.borderWidth,
  },
  leaderRow: {
    alignItems: "center",
    borderBottomColor: theme.colors.lightBorder,
    borderBottomWidth: theme.borderWidth,
    flexDirection: "row",
    gap: 10,
    paddingVertical: 8,
  },
  });
}
