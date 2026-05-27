// PHASE 1 STEP 4
import { useEffect, useMemo, useState } from "react";
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
  // PHASE 3 STEP 9
  const { claims, fetchTrendingClaims, voteOnClaim, reportClaim } = useClaims();
  const [activeFilter, setActiveFilter] = useState<TrendingFilter>("ALL");
  const [trendingSourceClaims, setTrendingSourceClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // PHASE 3 STEP 9
  useEffect(() => {
    let mounted = true;

    async function loadTrendingClaims() {
      setLoading(true);
      setError("");

      try {
        const nextClaims = await fetchTrendingClaims();

        if (mounted) {
          setTrendingSourceClaims(nextClaims);
        }
      } catch (loadError) {
        if (mounted) {
          setTrendingSourceClaims([]);
          setError(loadError instanceof Error ? loadError.message : "We could not load trending claims.");
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    void loadTrendingClaims();

    return () => {
      mounted = false;
    };
  }, [fetchTrendingClaims]);

  // PHASE 3 STEP 9
  const syncedTrendingClaims = useMemo(
    () =>
      trendingSourceClaims.map((claim) => claims.find((currentClaim) => currentClaim.id === claim.id) ?? claim),
    [claims, trendingSourceClaims],
  );

  const trendingClaims = useMemo(
    () =>
      syncedTrendingClaims
        .filter((claim) => claimMatchesFilter(claim, activeFilter))
        .map((claim) => ({
          claim,
          trendingScore: calculateTrendingScore(claim),
        }))
        .sort((first, second) => second.trendingScore - first.trendingScore),
    [activeFilter, syncedTrendingClaims],
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

        {loading ? (
          <View style={styles.statePanel}>
            <Text style={styles.stateText}>Loading trending claims...</Text>
          </View>
        ) : error ? (
          <View style={styles.errorPanel}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : trendingClaims.length > 0 ? (
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
  statePanel: {
    backgroundColor: theme.colors.background,
    borderColor: theme.colors.lightBorder,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    padding: theme.spacing.md,
  },
  stateText: {
    color: theme.colors.subtext,
    fontSize: theme.typography.body.fontSize,
    fontWeight: "700",
  },
  errorPanel: {
    backgroundColor: "#FEE2E2",
    borderColor: "#FECACA",
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    padding: theme.spacing.md,
  },
  errorText: {
    color: theme.colors.danger,
    fontSize: theme.typography.body.fontSize,
    fontWeight: "700",
  },
});
