// PHASE 1 STEP 4
import { useMemo, useState } from "react";
import { ScrollView, StyleSheet, SafeAreaView, Text, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { EmptyState } from "../../components/EmptyState";
import { Header } from "../../components/Header";
import { ClaimCard } from "../../components/ClaimCard";
import { useClaims } from "../../context/ClaimsContext";
import { isVotingOpen } from "../../services/claimVoting";
import { calculateTrendingScore } from "../../services/trending";
import type { Claim } from "../../types/claim";
import { theme } from "../../constants/theme";

// PHASE 2 STEP 7
type TrendingFilter =
  | "ALL"
  | "OPEN"
  | "CLOSED"
  | "NEEDS_MORE_EVIDENCE"
  | "COMMUNITY_TRUE"
  | "COMMUNITY_FAKE";

const trendingFilters: Array<{ label: string; value: TrendingFilter }> = [
  { label: "All", value: "ALL" },
  { label: "Open Voting", value: "OPEN" },
  { label: "Closed", value: "CLOSED" },
  { label: "Needs More Evidence", value: "NEEDS_MORE_EVIDENCE" },
  { label: "Community Says True", value: "COMMUNITY_TRUE" },
  { label: "Community Says Fake", value: "COMMUNITY_FAKE" },
];

function claimMatchesFilter(claim: Claim, filter: TrendingFilter): boolean {
  if (filter === "ALL") {
    return true;
  }

  if (filter === "OPEN") {
    return isVotingOpen(claim);
  }

  if (filter === "CLOSED") {
    return !isVotingOpen(claim);
  }

  return claim.status === filter;
}

export default function TrendingScreen() {
  const router = useRouter();
  // PHASE 2 STEP 7
  const { claims, voteOnClaim, reportClaim } = useClaims();
  const [activeFilter, setActiveFilter] = useState<TrendingFilter>("ALL");

  const trendingClaims = useMemo(
    () =>
      claims
        .filter((claim) => claimMatchesFilter(claim, activeFilter))
        .map((claim) => ({
          claim,
          trendingScore: calculateTrendingScore(claim),
        }))
        .sort((first, second) => second.trendingScore - first.trendingScore),
    [activeFilter, claims],
  );

  const handleClaimPress = (claimId: string) => {
    router.push(`/claim/${claimId}`);
  };

  return (
    <SafeAreaView style={styles.container}>
      <Header title="Trending Claims" subtitle="Claims with the most activity right now" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.filterRow}>
          {trendingFilters.map((filter) => {
            const selected = activeFilter === filter.value;

            return (
              <TouchableOpacity
                key={filter.value}
                style={[styles.filterButton, selected && styles.filterButtonSelected]}
                activeOpacity={0.8}
                onPress={() => setActiveFilter(filter.value)}
              >
                <Text style={[styles.filterText, selected && styles.filterTextSelected]}>{filter.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {trendingClaims.length > 0 ? (
          trendingClaims.map(({ claim, trendingScore }) => (
            <View key={claim.id} style={styles.trendingItem}>
              <Text style={styles.scoreLabel}>Trending Score: {trendingScore}</Text>
              <ClaimCard
                claim={claim}
                onPress={() => handleClaimPress(claim.id)}
                onVote={voteOnClaim}
                onReport={reportClaim}
              />
            </View>
          ))
        ) : (
          <EmptyState message="No trending claims yet." />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.card,
  },
  content: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.xl,
  },
  filterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  filterButton: {
    backgroundColor: theme.colors.background,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  filterButtonSelected: {
    backgroundColor: "#E0E7FF",
    borderColor: theme.colors.primary,
  },
  filterText: {
    color: theme.colors.subtext,
    fontSize: theme.typography.small.fontSize,
    fontWeight: "700",
  },
  filterTextSelected: {
    color: theme.colors.primary,
  },
  trendingItem: {
    marginBottom: theme.spacing.md,
  },
  scoreLabel: {
    color: theme.colors.subtext,
    fontSize: theme.typography.small.fontSize,
    fontWeight: "700",
    marginBottom: theme.spacing.sm,
  },
});
