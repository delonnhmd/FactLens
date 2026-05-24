// PHASE 1 STEP 4
import { TouchableOpacity, View, Text, StyleSheet } from "react-native";
import type { Claim } from "../types/claim";
import { StatusBadge } from "./StatusBadge";
import { theme } from "../constants/theme";

interface ClaimCardProps {
  claim: Claim;
  onPress?: () => void;
}

export function ClaimCard({ claim, onPress }: ClaimCardProps) {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.95}>
      <View style={styles.headerRow}>
        <View style={styles.titleWrapper}>
          <Text style={styles.title}>{claim.title}</Text>
        </View>
        <StatusBadge status={claim.status} />
      </View>

      <Text style={styles.description}>{claim.description}</Text>

      <Text style={styles.source}>📍 {claim.sourceUrl}</Text>

      <View style={styles.divider} />

      <View style={styles.voteRow}>
        <View style={styles.voteItem}>
          <Text style={styles.voteValue}>{claim.votesTrue}</Text>
          <Text style={styles.voteLabel}>True</Text>
        </View>
        <View style={styles.dividerVertical} />
        <View style={styles.voteItem}>
          <Text style={styles.voteValue}>{claim.votesFake}</Text>
          <Text style={styles.voteLabel}>Fake</Text>
        </View>
        <View style={styles.dividerVertical} />
        <View style={styles.voteItem}>
          <Text style={styles.voteValue}>{claim.votesUnsure}</Text>
          <Text style={styles.voteLabel}>Not Sure</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.background,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.md,
    ...theme.shadows.light,
    borderWidth: 1,
    borderColor: theme.colors.lightBorder,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: theme.spacing.md,
  },
  titleWrapper: {
    flex: 1,
    marginRight: theme.spacing.md,
  },
  title: {
    fontSize: theme.typography.title.fontSize,
    fontWeight: "700",
    color: theme.colors.text,
    lineHeight: 28,
  },
  description: {
    fontSize: theme.typography.body.fontSize,
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
    lineHeight: 24,
  },
  source: {
    fontSize: theme.typography.small.fontSize,
    color: theme.colors.subtext,
    marginBottom: theme.spacing.md,
  },
  divider: {
    height: 1,
    backgroundColor: theme.colors.lightBorder,
    marginVertical: theme.spacing.md,
  },
  voteRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
  },
  voteItem: {
    alignItems: "center",
    flex: 1,
  },
  voteValue: {
    fontSize: 18,
    fontWeight: "700",
    color: theme.colors.primary,
  },
  voteLabel: {
    fontSize: theme.typography.small.fontSize,
    color: theme.colors.subtext,
    marginTop: theme.spacing.xs,
  },
  dividerVertical: {
    width: 1,
    height: 24,
    backgroundColor: theme.colors.lightBorder,
  },
});
