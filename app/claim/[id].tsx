// PHASE 1 STEP 4
import { View, Text, ScrollView, StyleSheet, SafeAreaView, TouchableOpacity } from "react-native";
import type { DimensionValue } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { EmptyState } from "../../components/EmptyState";
import { StatusBadge } from "../../components/StatusBadge";
import { VoteButtons } from "../../components/VoteButtons";
import { useClaims } from "../../context/ClaimsContext";
import { calculateAutomaticVerdict, canUserVote, getTimeRemaining, isVotingOpen } from "../../services/claimVoting";
import { theme } from "../../constants/theme";

export default function ClaimDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  // PHASE 2 STEP 3
  const { getClaimById, voteOnClaim } = useClaims();

  const claimId = Array.isArray(id) ? id[0] : id;
  const claim = claimId ? getClaimById(claimId) : undefined;

  if (!claim) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
            <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Claim Details</Text>
          <View style={styles.headerSpacer} />
        </View>
        <EmptyState message="Claim not found." />
      </SafeAreaView>
    );
  }

  const totalVotes = claim.votesTrue + claim.votesFake + claim.votesUnsure;
  const votingOpen = isVotingOpen(claim);
  const userCanVote = canUserVote(claim);
  const automaticVerdict = votingOpen ? undefined : calculateAutomaticVerdict(claim);
  const voteStats = [
    { label: "True", value: claim.votesTrue, color: theme.colors.success },
    { label: "Fake", value: claim.votesFake, color: theme.colors.danger },
    { label: "Not Sure", value: claim.votesUnsure, color: theme.colors.warning },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Claim Details</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <View style={styles.titleRow}>
            <Text style={styles.title}>{claim.title}</Text>
            <StatusBadge status={claim.status} />
          </View>
          <Text style={styles.authorText}>by @{claim.author.username}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Description</Text>
          <Text style={styles.description}>{claim.description}</Text>
          {claim.category ? <Text style={styles.category}>{claim.category}</Text> : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Source</Text>
          <Text style={styles.sourceUrl} selectable>
            {claim.sourceUrl}
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>24-hour voting window</Text>
          <View style={styles.windowPanel}>
            <View>
              <Text style={styles.windowCaption}>{votingOpen ? "Time remaining" : "Voting closed"}</Text>
              <Text style={[styles.windowValue, !votingOpen && styles.closedValue]}>
                {votingOpen ? getTimeRemaining(claim.expiresAt) : "Voting closed"}
              </Text>
            </View>
            <StatusBadge status={votingOpen ? "OPEN" : "VOTING_CLOSED"} />
          </View>
          <Text style={styles.date}>Posted {new Date(claim.createdAt).toLocaleString()}</Text>
          <Text style={styles.date}>Closes {new Date(claim.expiresAt).toLocaleString()}</Text>
        </View>

        {votingOpen ? (
          <View style={styles.card}>
            <Text style={styles.label}>Cast Your Vote</Text>
            <VoteButtons
              disabled={!userCanVote}
              userVote={claim.userVote}
              onVote={(vote) => voteOnClaim(claim.id, vote)}
            />
            <Text style={styles.voteHint}>
              {claim.userVote ? "Your vote is recorded." : "Choose one option before the window closes."}
            </Text>
          </View>
        ) : null}

        {!votingOpen && automaticVerdict ? (
          <View style={styles.card}>
            <Text style={styles.label}>System Verdict</Text>
            <StatusBadge status={automaticVerdict.status} />
            <Text style={styles.verdictTitle}>{automaticVerdict.resultLabel}</Text>
            <Text style={styles.verdictReason}>{automaticVerdict.reason}</Text>
          </View>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.label}>{votingOpen ? "Vote Totals" : "Final Vote Breakdown"}</Text>
          <View style={styles.voteRowDetailed}>
            {voteStats.map((stat) => {
              const width: DimensionValue =
                totalVotes > 0 ? `${Math.max((stat.value / totalVotes) * 100, 8)}%` : "8%";

              return (
                <View key={stat.label} style={styles.voteItemDetailed}>
                  <Text style={styles.voteLabelDetailed}>{stat.label}</Text>
                  <Text style={styles.voteValueDetailed}>{stat.value}</Text>
                  <View style={styles.voteBarTrack}>
                    <View style={[styles.voteBar, { backgroundColor: stat.color, width }]} />
                  </View>
                </View>
              );
            })}
          </View>
        </View>

        {votingOpen ? (
          <View style={styles.card}>
            <Text style={styles.label}>System Verdict</Text>
            <Text style={styles.placeholder}>Result appears when voting closes.</Text>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.card,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    backgroundColor: theme.colors.background,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  headerTitle: {
    fontSize: theme.typography.title.fontSize,
    fontWeight: "700",
    color: theme.colors.text,
  },
  headerSpacer: {
    width: 24,
  },
  content: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.xl,
  },
  card: {
    backgroundColor: theme.colors.background,
    borderRadius: theme.radius.md,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.md,
    ...theme.shadows.light,
    borderWidth: 1,
    borderColor: theme.colors.lightBorder,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: theme.spacing.sm,
  },
  title: {
    flex: 1,
    fontSize: theme.typography.title.fontSize,
    fontWeight: "700",
    color: theme.colors.text,
    lineHeight: theme.typography.title.lineHeight,
    marginRight: theme.spacing.md,
  },
  authorText: {
    fontSize: theme.typography.small.fontSize,
    color: theme.colors.subtext,
  },
  label: {
    fontSize: theme.typography.body.fontSize,
    fontWeight: "700",
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
  },
  description: {
    fontSize: theme.typography.body.fontSize,
    color: theme.colors.text,
    lineHeight: theme.typography.body.lineHeight,
  },
  category: {
    alignSelf: "flex-start",
    backgroundColor: theme.colors.card,
    borderColor: theme.colors.lightBorder,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    color: theme.colors.primary,
    fontSize: theme.typography.small.fontSize,
    fontWeight: "700",
    marginTop: theme.spacing.md,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
  },
  sourceUrl: {
    fontSize: theme.typography.body.fontSize,
    color: theme.colors.primary,
  },
  date: {
    fontSize: theme.typography.body.fontSize,
    color: theme.colors.subtext,
    marginTop: theme.spacing.sm,
  },
  windowPanel: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing.md,
    padding: theme.spacing.md,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.lightBorder,
  },
  windowCaption: {
    fontSize: theme.typography.small.fontSize,
    color: theme.colors.subtext,
    marginBottom: theme.spacing.xs,
  },
  windowValue: {
    fontSize: 22,
    fontWeight: "700",
    color: theme.colors.primary,
  },
  closedValue: {
    color: theme.colors.subtext,
  },
  voteHint: {
    marginTop: theme.spacing.md,
    fontSize: theme.typography.small.fontSize,
    color: theme.colors.subtext,
  },
  voteRowDetailed: {
    gap: theme.spacing.md,
  },
  voteItemDetailed: {
    gap: theme.spacing.xs,
  },
  voteLabelDetailed: {
    fontSize: theme.typography.small.fontSize,
    color: theme.colors.subtext,
  },
  voteValueDetailed: {
    fontSize: 20,
    fontWeight: "700",
    color: theme.colors.text,
  },
  voteBarTrack: {
    height: 6,
    overflow: "hidden",
    borderRadius: 3,
    backgroundColor: theme.colors.lightBorder,
  },
  voteBar: {
    height: 6,
    borderRadius: 3,
  },
  verdictTitle: {
    color: theme.colors.text,
    fontSize: 22,
    fontWeight: "700",
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.xs,
  },
  verdictReason: {
    fontSize: theme.typography.small.fontSize,
    color: theme.colors.subtext,
    lineHeight: theme.typography.small.lineHeight,
  },
  placeholder: {
    fontSize: theme.typography.body.fontSize,
    color: theme.colors.muted,
    fontStyle: "italic",
  },
});
