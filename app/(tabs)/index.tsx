// PHASE 1 STEP 4
// PHASE 3 STEP 27
// PHASE 4 STEP 15
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Header } from "../../components/Header";
import { ClaimCard } from "../../components/ClaimCard";
import { EmptyState } from "../../components/EmptyState";
import { claimCategories } from "../../constants/claimCategories";
import { theme } from "../../constants/theme";
import { useClaims } from "../../context/ClaimsContext";
import { useDebounce } from "../../hooks/useDebounce";
import type { Claim } from "../../types/claim";

// PHASE 3 STEP 9
const categoryChips = ["All", ...claimCategories];
// PHASE 3 STEP 11
const HOME_PAGE_SIZE = 20;

function mergeClaimsById(currentClaims: Claim[], incomingClaims: Claim[]): Claim[] {
  const claimsById = new Map(currentClaims.map((claim) => [claim.id, claim]));

  incomingClaims.forEach((claim) => {
    claimsById.set(claim.id, claim);
  });

  return Array.from(claimsById.values()).sort(
    (first, second) => new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime(),
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const { claimPosted } = useLocalSearchParams<{ claimPosted?: string }>();
  const {
    claims,
    loading,
    hasMoreClaims,
    loadingMore,
    liveUpdatesEnabled,
    error,
    claimsErrorMessage,
    claimsErrorCode,
    claimsErrorDetails,
    claimsErrorHint,
    aiPrecheckNotice,
    clearAiPrecheckNotice,
    voteOnClaim,
    reportClaim,
    searchClaimsPage,
    refreshClaims,
    loadMoreClaims,
  } = useClaims();
  // PHASE 2 STEP 8
  const [query, setQuery] = useState("");
  // PHASE 3 STEP 9
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [feedClaims, setFeedClaims] = useState<Claim[]>([]);
  const [feedLoading, setFeedLoading] = useState(false);
  const [feedLoadingMore, setFeedLoadingMore] = useState(false);
  const [feedHasMore, setFeedHasMore] = useState(true);
  const [feedOffset, setFeedOffset] = useState(0);
  const [feedError, setFeedError] = useState("");
  const debouncedQuery = useDebounce(query, 400);
  // PHASE 2 STEP 10
  const [refreshing, setRefreshing] = useState(false);
  // PHASE 4 STEP 15
  const filteredFetchInFlightRef = useRef(false);

  const filteredFeedActive = debouncedQuery.trim().length > 0 || Boolean(activeCategory);

  const visibleClaims = useMemo(() => {
    const baseClaims = filteredFeedActive ? feedClaims : claims;
    return baseClaims.map((claim) => claims.find((currentClaim) => currentClaim.id === claim.id) ?? claim);
  }, [claims, feedClaims, filteredFeedActive]);

  // PHASE 3 STEP 11
  const loadFilteredClaims = useCallback(
    async (nextOffset = 0, replace = true) => {
      if (!filteredFeedActive) {
        setFeedClaims([]);
        setFeedOffset(0);
        setFeedHasMore(true);
        setFeedError("");
        return;
      }

      // PHASE 4 STEP 15
      if (filteredFetchInFlightRef.current) {
        console.log("[claims] filtered fetch already running, skip");
        return;
      }

      filteredFetchInFlightRef.current = true;

      if (replace) {
        setFeedLoading(true);
      } else {
        setFeedLoadingMore(true);
      }

      setFeedError("");

      try {
        const nextClaims = await searchClaimsPage(
          debouncedQuery.trim(),
          { category: activeCategory },
          HOME_PAGE_SIZE,
          nextOffset,
        );

        setFeedClaims((currentClaims) => (replace ? nextClaims : mergeClaimsById(currentClaims, nextClaims)));
        setFeedOffset(nextOffset + nextClaims.length);
        setFeedHasMore(nextClaims.length === HOME_PAGE_SIZE);
      } catch (loadError) {
        if (replace) {
          setFeedClaims([]);
          setFeedOffset(0);
        }

        setFeedError(loadError instanceof Error ? loadError.message : "Could not load claims. Pull to retry.");
      } finally {
        setFeedLoading(false);
        setFeedLoadingMore(false);
        filteredFetchInFlightRef.current = false;
      }
    },
    [activeCategory, debouncedQuery, filteredFeedActive, searchClaimsPage],
  );

  // PHASE 3 STEP 11
  useEffect(() => {
    setFeedClaims([]);
    setFeedOffset(0);
    setFeedHasMore(true);

    void loadFilteredClaims(0, true);
  }, [loadFilteredClaims]);

  const handleClaimPress = useCallback(
    (claimId: string) => {
      router.push(`/claim/${claimId}`);
    },
    [router],
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);

    try {
      if (filteredFeedActive) {
        await loadFilteredClaims(0, true);
      } else {
        await refreshClaims();
      }
    } catch (loadError) {
      setFeedError(loadError instanceof Error ? loadError.message : "Could not load claims. Pull to retry.");
    } finally {
      setRefreshing(false);
    }
  }, [filteredFeedActive, loadFilteredClaims, refreshClaims]);

  const handleEndReached = useCallback(() => {
    if (filteredFeedActive) {
      if (!feedLoading && !feedLoadingMore && feedHasMore) {
        void loadFilteredClaims(feedOffset, false);
      }

      return;
    }

    if (!loading && !loadingMore && hasMoreClaims) {
      void loadMoreClaims();
    }
  }, [
    feedHasMore,
    feedLoading,
    feedLoadingMore,
    feedOffset,
    filteredFeedActive,
    hasMoreClaims,
    loadFilteredClaims,
    loadMoreClaims,
    loading,
    loadingMore,
  ]);

  const renderClaim = useCallback(
    ({ item }: { item: Claim }) => (
      <ClaimCard
        claim={item}
        onPress={() => handleClaimPress(item.id)}
        onVote={voteOnClaim}
        onReport={reportClaim}
      />
    ),
    [handleClaimPress, reportClaim, voteOnClaim],
  );

  const listLoading = filteredFeedActive ? feedLoading : loading;
  const listLoadingMore = filteredFeedActive ? feedLoadingMore : loadingMore;
  const displayError = feedError || error || "";
  const displayErrorMessage = feedError || claimsErrorMessage || error || "";
  const displayErrorCode = claimsErrorCode || "none";
  const displayErrorDetails = claimsErrorDetails || "none";
  const displayErrorHint = claimsErrorHint || "none";

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
      {/* PHASE 3 STEP 12 */}
      {liveUpdatesEnabled ? <Text style={styles.liveText}>Live updates on</Text> : null}
      {/* PHASE 4 STEP 2 */}
      {aiPrecheckNotice ? (
        <TouchableOpacity style={styles.aiNoticeBanner} activeOpacity={0.85} onPress={clearAiPrecheckNotice}>
          <Text style={styles.aiNoticeText}>{aiPrecheckNotice}</Text>
        </TouchableOpacity>
      ) : null}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryRow}>
        {categoryChips.map((category) => {
          const selected = category === "All" ? !activeCategory : activeCategory === category;

          return (
            <TouchableOpacity
              key={category}
              style={[styles.categoryChip, selected && styles.categoryChipSelected]}
              activeOpacity={0.8}
              onPress={() => setActiveCategory(category === "All" ? null : category)}
            >
              <Text style={[styles.categoryChipText, selected && styles.categoryChipTextSelected]}>{category}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
      {claimPosted === "1" ? (
        <View style={styles.successBanner}>
          <Text style={styles.successText}>Claim posted. Test voting closes in 10 minutes.</Text>
        </View>
      ) : null}
      {displayError ? (
        <View style={styles.errorPanel}>
          <Text style={styles.errorTitle}>Could not load claims.</Text>
          <Text style={styles.errorText}>Message: {displayErrorMessage}</Text>
          <Text style={styles.errorText}>Code: {displayErrorCode}</Text>
          <Text style={styles.errorText}>Details: {displayErrorDetails}</Text>
          <Text style={styles.errorText}>Hint: {displayErrorHint}</Text>
          <TouchableOpacity style={styles.retryButton} activeOpacity={0.8} onPress={handleRefresh}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : null}
      {listLoading ? (
        <View style={styles.statePanel}>
          <ActivityIndicator size="small" color={theme.colors.primary} />
          <Text style={styles.stateText}>Loading claims...</Text>
        </View>
      ) : null}
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <Header title="FactLens" subtitle="Verify news with community evidence" />
      <FlatList
        data={visibleClaims}
        keyExtractor={(claim) => claim.id}
        renderItem={renderClaim}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.45}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={
          !listLoading && !displayError ? (
            <EmptyState
              message={
                filteredFeedActive
                  ? "No matching claims."
                  : "No claims yet. Be the first to post a news claim."
              }
            />
          ) : null
        }
        ListFooterComponent={
          listLoadingMore ? (
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
    paddingHorizontal: 10,
    paddingTop: 10,
    paddingBottom: theme.spacing.xl,
  },
  successBanner: {
    backgroundColor: theme.colors.successBg,
    borderColor: theme.colors.successBg,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    marginBottom: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
  },
  successText: {
    color: theme.colors.success,
    fontSize: theme.typography.body.fontSize,
    fontWeight: "500",
  },
  searchInput: {
    backgroundColor: theme.colors.background,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    borderWidth: 0.5,
    color: theme.colors.text,
    fontSize: theme.typography.body.fontSize,
    marginBottom: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
  },
  // PHASE 3 STEP 12
  liveText: {
    alignSelf: "flex-start",
    backgroundColor: theme.colors.successBg,
    borderRadius: 999,
    color: theme.colors.success,
    fontSize: 11,
    fontWeight: "500",
    marginBottom: theme.spacing.md,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
  },
  // PHASE 4 STEP 2
  aiNoticeBanner: {
    alignSelf: "flex-start",
    backgroundColor: theme.colors.warningBg,
    borderColor: theme.colors.warningBg,
    borderRadius: 999,
    borderWidth: 1,
    marginBottom: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  aiNoticeText: {
    color: theme.colors.warning,
    fontSize: 11,
    fontWeight: "500",
  },
  categoryRow: {
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.md,
    paddingRight: theme.spacing.lg,
  },
  categoryChip: {
    backgroundColor: theme.colors.background,
    borderColor: theme.colors.border,
    borderRadius: 999,
    borderWidth: 0.5,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  categoryChipSelected: {
    backgroundColor: theme.colors.tagBg,
    borderColor: theme.colors.tagBg,
  },
  categoryChipText: {
    color: theme.colors.subtext,
    fontSize: theme.typography.small.fontSize,
    fontWeight: "500",
  },
  categoryChipTextSelected: {
    color: theme.colors.tagText,
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
    fontWeight: "500",
  },
  errorPanel: {
    backgroundColor: theme.colors.dangerBg,
    borderColor: theme.colors.dangerBg,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    marginBottom: theme.spacing.md,
    padding: theme.spacing.md,
  },
  errorText: {
    color: theme.colors.danger,
    fontSize: theme.typography.small.fontSize,
    fontWeight: "500",
    marginTop: theme.spacing.xs,
  },
  errorTitle: {
    color: theme.colors.danger,
    fontSize: theme.typography.body.fontSize,
    fontWeight: "500",
    marginBottom: theme.spacing.xs,
  },
  retryButton: {
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: theme.colors.danger,
    borderRadius: theme.radius.sm,
    marginTop: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  retryButtonText: {
    color: theme.colors.background,
    fontSize: theme.typography.small.fontSize,
    fontWeight: "500",
  },
  footerLoader: {
    alignItems: "center",
    paddingVertical: theme.spacing.lg,
  },
});
