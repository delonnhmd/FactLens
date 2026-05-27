// PHASE 1 STEP 4
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
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

// PHASE 3 STEP 11
const TRENDING_BATCH_SIZE = 50;

function claimMatchesFilter(claim: Claim, filter: TrendingFilter): boolean {
  if (filter === "ALL") {
    return true;
  }

  if (filter === "OPEN") {
    return claim.status === "OPEN" && isVotingOpen(claim);
  }

  if (filter === "CLOSED") {
    return claim.status !== "OPEN" || !isVotingOpen(claim);
  }

  return claim.status === filter;
}

export default function TrendingScreen() {
  const router = useRouter();
  // PHASE 3 STEP 11
  const { claims, fetchTrendingClaimsPage, voteOnClaim, reportClaim } = useClaims();
  const [activeFilter, setActiveFilter] = useState<TrendingFilter>("ALL");
  const [trendingSourceClaims, setTrendingSourceClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  // PHASE 3 STEP 11
  const loadTrendingClaims = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const nextClaims = await fetchTrendingClaimsPage(TRENDING_BATCH_SIZE, 0);
      setTrendingSourceClaims(nextClaims);
    } catch {
      setTrendingSourceClaims([]);
      setError("Could not load claims. Pull to retry.");
    } finally {
      setLoading(false);
    }
  }, [fetchTrendingClaimsPage]);

  useEffect(() => {
    void loadTrendingClaims();
  }, [loadTrendingClaims]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);

    try {
      await loadTrendingClaims();
    } finally {
      setRefreshing(false);
    }
  }, [loadTrendingClaims]);

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

  const handleClaimPress = useCallback(
    (claimId: string) => {
      router.push(`/claim/${claimId}`);
    },
    [router],
  );

  const renderTrendingClaim = useCallback(
    ({ item }: { item: { claim: Claim; trendingScore: number } }) => (
      <View style={styles.trendingItem}>
        <Text style={styles.scoreLabel}>Trending Score: {item.trendingScore}</Text>
        <ClaimCard
          claim={item.claim}
          onPress={() => handleClaimPress(item.claim.id)}
          onVote={voteOnClaim}
          onReport={reportClaim}
        />
      </View>
    ),
    [handleClaimPress, reportClaim, voteOnClaim],
  );

  const listHeader = (
    <View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
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
      </ScrollView>

      {error ? (
        <View style={styles.errorPanel}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {loading ? (
        <View style={styles.statePanel}>
          <ActivityIndicator size="small" color={theme.colors.primary} />
          <Text style={styles.stateText}>Loading trending claims...</Text>
        </View>
      ) : null}
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <Header title="Trending Claims" subtitle="Claims with the most activity right now" />
      <FlatList
        data={trendingClaims}
        keyExtractor={({ claim }) => claim.id}
        renderItem={renderTrendingClaim}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={!loading && !error ? <EmptyState message="No trending claims yet." /> : null}
      />
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
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.md,
    paddingRight: theme.spacing.lg,
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
    alignItems: "center",
    backgroundColor: theme.colors.background,
    borderColor: theme.colors.lightBorder,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    flexDirection: "row",
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.md,
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
    marginBottom: theme.spacing.md,
    padding: theme.spacing.md,
  },
  errorText: {
    color: theme.colors.danger,
    fontSize: theme.typography.body.fontSize,
    fontWeight: "700",
  },
});
