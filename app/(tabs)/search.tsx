// PHASE 2 STEP 8
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  ScrollView,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { ClaimCard } from "../../components/ClaimCard";
import { EmptyState } from "../../components/EmptyState";
import { Header } from "../../components/Header";
import { claimCategories } from "../../constants/claimCategories";
import { theme } from "../../constants/theme";
import { useClaims } from "../../context/ClaimsContext";
import { useDebounce } from "../../hooks/useDebounce";
import type { Claim } from "../../types/claim";
import type { ClaimFeedFilter } from "../../services/claimService";

// PHASE 3 STEP 9
const categoryChips = ["All", ...claimCategories];

// PHASE 3 STEP 9
const filterChips: Array<{ label: string; value: ClaimFeedFilter }> = [
  { label: "All", value: "ALL" },
  { label: "Open Voting", value: "OPEN_VOTING" },
  { label: "Community Says True", value: "COMMUNITY_TRUE" },
  { label: "Community Says Fake", value: "COMMUNITY_FAKE" },
  { label: "Needs More Evidence", value: "NEEDS_MORE_EVIDENCE" },
  { label: "Flagged", value: "FLAGGED" },
  { label: "Has Image", value: "HAS_IMAGE" },
  { label: "Has Video", value: "HAS_VIDEO" },
];

// PHASE 3 STEP 11
const SEARCH_PAGE_SIZE = 20;

function mergeClaimsById(currentClaims: Claim[], incomingClaims: Claim[]): Claim[] {
  const claimsById = new Map(currentClaims.map((claim) => [claim.id, claim]));

  incomingClaims.forEach((claim) => {
    claimsById.set(claim.id, claim);
  });

  return Array.from(claimsById.values()).sort(
    (first, second) => new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime(),
  );
}

export default function SearchScreen() {
  const router = useRouter();
  const { claims, searchClaimsPage, voteOnClaim, reportClaim } = useClaims();
  const [query, setQuery] = useState("");
  // PHASE 3 STEP 9
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<ClaimFeedFilter>("ALL");
  const [results, setResults] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const [error, setError] = useState("");
  const debouncedQuery = useDebounce(query, 400);

  // PHASE 3 STEP 11
  const loadSearchPage = useCallback(
    async (nextOffset = 0, replace = true) => {
      if (replace) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }

      setError("");

      try {
        const nextResults = await searchClaimsPage(
          debouncedQuery,
          {
            category: activeCategory,
            filter: activeFilter,
          },
          SEARCH_PAGE_SIZE,
          nextOffset,
        );

        setResults((currentResults) => (replace ? nextResults : mergeClaimsById(currentResults, nextResults)));
        setOffset(nextOffset + nextResults.length);
        setHasMore(nextResults.length === SEARCH_PAGE_SIZE);
      } catch {
        if (replace) {
          setResults([]);
          setOffset(0);
        }

        setError("Could not load claims. Pull to retry.");
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [activeCategory, activeFilter, debouncedQuery, searchClaimsPage],
  );

  // PHASE 3 STEP 11
  useEffect(() => {
    setResults([]);
    setOffset(0);
    setHasMore(true);

    void loadSearchPage(0, true);
  }, [loadSearchPage]);

  // PHASE 3 STEP 9
  const syncedResults = useMemo(
    () => results.map((claim) => claims.find((currentClaim) => currentClaim.id === claim.id) ?? claim),
    [claims, results],
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);

    try {
      await loadSearchPage(0, true);
    } finally {
      setRefreshing(false);
    }
  }, [loadSearchPage]);

  const handleEndReached = useCallback(() => {
    if (!loading && !loadingMore && hasMore) {
      void loadSearchPage(offset, false);
    }
  }, [hasMore, loadSearchPage, loading, loadingMore, offset]);

  const renderClaim = useCallback(
    ({ item }: { item: Claim }) => (
      <ClaimCard
        claim={item}
        onPress={() => router.push(`/claim/${item.id}`)}
        onVote={voteOnClaim}
        onReport={reportClaim}
      />
    ),
    [reportClaim, router, voteOnClaim],
  );

  const listHeader = (
    <View>
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Search claims, sources, topics..."
        placeholderTextColor={theme.colors.muted}
        style={styles.searchInput}
        autoCapitalize="none"
        autoCorrect={false}
      />
      <Text style={styles.filterLabel}>Categories</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
        {categoryChips.map((category) => {
          const selected = category === "All" ? !activeCategory : activeCategory === category;

          return (
            <TouchableOpacity
              key={category}
              style={[styles.chip, selected && styles.chipSelected]}
              activeOpacity={0.8}
              onPress={() => setActiveCategory(category === "All" ? null : category)}
            >
              <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{category}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <Text style={styles.filterLabel}>Filters</Text>
      <View style={styles.filterGrid}>
        {filterChips.map((filter) => {
          const selected = activeFilter === filter.value;

          return (
            <TouchableOpacity
              key={filter.value}
              style={[styles.chip, selected && styles.chipSelected]}
              activeOpacity={0.8}
              onPress={() => setActiveFilter(filter.value)}
            >
              <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{filter.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {error ? (
        <View style={styles.errorPanel}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {loading ? (
        <View style={styles.statePanel}>
          <ActivityIndicator size="small" color={theme.colors.primary} />
          <Text style={styles.stateText}>Searching claims...</Text>
        </View>
      ) : null}
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <Header title="Search" subtitle="Find claims, sources, and topics" />
      <FlatList
        data={syncedResults}
        keyExtractor={(claim) => claim.id}
        renderItem={renderClaim}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.45}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={!loading && !error ? <EmptyState message="No matching claims yet." /> : null}
        ListFooterComponent={
          loadingMore ? (
            <View style={styles.footerLoader}>
              <ActivityIndicator size="small" color={theme.colors.primary} />
            </View>
          ) : null
        }
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
  searchInput: {
    backgroundColor: theme.colors.background,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    color: theme.colors.text,
    fontSize: theme.typography.body.fontSize,
    marginBottom: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
  },
  filterLabel: {
    color: theme.colors.text,
    fontSize: theme.typography.small.fontSize,
    fontWeight: "700",
    marginBottom: theme.spacing.sm,
  },
  chipRow: {
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.md,
    paddingRight: theme.spacing.lg,
  },
  filterGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  chip: {
    backgroundColor: theme.colors.background,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  chipSelected: {
    backgroundColor: "#E0E7FF",
    borderColor: theme.colors.primary,
  },
  chipText: {
    color: theme.colors.subtext,
    fontSize: theme.typography.small.fontSize,
    fontWeight: "700",
  },
  chipTextSelected: {
    color: theme.colors.primary,
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
  footerLoader: {
    alignItems: "center",
    paddingVertical: theme.spacing.lg,
  },
});
