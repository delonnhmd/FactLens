// PHASE 1 STEP 4
// PHASE 3 STEP 27
// PHASE 4 STEP 15
// PHASE 5 STEP 5 PRE-LAUNCH
// PHASE 6 STEP 4 — topic cluster cards in search (additive blocks only).
// APPLE GUIDELINE 1.2 — blocked-author filter on visibleClaims (NEW).
// Frontend changes: JS-only, no native modules changed, no app.json changed.
// Deploy with: eas update --channel preview
// Do NOT run eas build — Apple review is in progress.
// Backend changes deploy to Render independently.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
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
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { Header } from "../../components/Header";
import { ClaimCard } from "../../components/ClaimCard";
import { EmptyState } from "../../components/EmptyState";
import { ClaimListSkeleton } from "../../components/Skeleton";
import { claimCategories } from "../../constants/claimCategories";
import { CLAIMS_LOAD_ERROR_MESSAGE } from "../../services/claimService";
import { fetchUnreadNotificationCount } from "../../services/notificationService";
import { useAuth } from "../../context/AuthContext";
import { useClaims } from "../../context/ClaimsContext";
import { useDebounce } from "../../hooks/useDebounce";
// PHASE 6 STEP 4 (NEW)
import { searchTopics, type TopicSearchTopic } from "../../services/topicService";
import { useAppTheme } from "../../hooks/useTheme";
import { useScrollAwareTabBar } from "../../context/TabBarVisibilityContext";
import type { AppTheme } from "../../context/DisplaySettingsContext";
import type { Claim } from "../../types/claim";
// iPad full-screen: cap + center the single content column on wide screens.
import { centeredContentStyle } from "../../constants/layout";

// PHASE 3 STEP 9
const categoryChips = ["All", ...claimCategories];
// PHASE 3 STEP 11
const HOME_PAGE_SIZE = 20;

// PHASE 6 STEP 4 (NEW): display helpers for topic cluster verdict chips.
function formatTopicVerdict(verdict: string): string {
  if (verdict === "TRUE") return "Community Says True";
  if (verdict === "FAKE") return "Community Says Fake";
  if (verdict === "DISPUTED") return "Disputed";
  return "Insufficient data";
}

function getTopicVerdictChipStyle(
  verdict: string,
  styles: ReturnType<typeof createStyles>,
) {
  if (verdict === "TRUE") return styles.topicVerdictTrue;
  if (verdict === "FAKE") return styles.topicVerdictFake;
  if (verdict === "DISPUTED") return styles.topicVerdictDisputed;
  return styles.topicVerdictInsufficient;
}

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
  const appTheme = useAppTheme();
  const styles = useMemo(() => createStyles(appTheme), [appTheme]);
  const { contentBottomPadding, handleScroll } = useScrollAwareTabBar();
  const { currentUser } = useAuth();
  const contentContainerStyle = useMemo(
    () => [styles.content, { paddingBottom: contentBottomPadding }],
    [contentBottomPadding, styles.content],
  );
  const { claimPosted } = useLocalSearchParams<{ claimPosted?: string }>();
  const {
    claims,
    loading,
    hasMoreClaims,
    loadingMore,
    liveUpdatesEnabled,
    error,
    aiPrecheckNotice,
    clearAiPrecheckNotice,
    voteOnClaim,
    reportClaim,
    searchClaimsPage,
    refreshClaims,
    loadMoreClaims,
    // APPLE GUIDELINE 1.2 — user blocking (NEW)
    blockedUserIds,
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
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
  const debouncedQuery = useDebounce(query, 400);
  // PHASE 6 STEP 4 (NEW): topic cluster layer for search. Empty array = the
  // screen renders exactly as before (individual claims only).
  const [topicResults, setTopicResults] = useState<TopicSearchTopic[]>([]);
  // PHASE 2 STEP 10
  const [refreshing, setRefreshing] = useState(false);
  // PHASE 4 STEP 15
  const filteredFetchInFlightRef = useRef(false);

  const filteredFeedActive = debouncedQuery.trim().length > 0 || Boolean(activeCategory);

  const refreshUnreadNotifications = useCallback(async () => {
    if (!currentUser?.id) {
      setUnreadNotificationCount(0);
      return;
    }

    const nextCount = await fetchUnreadNotificationCount(currentUser.id);
    setUnreadNotificationCount(nextCount);
  }, [currentUser?.id]);

  const visibleClaims = useMemo(() => {
    const baseClaims = filteredFeedActive ? feedClaims : claims;
    return (
      baseClaims
        .map((claim) => claims.find((currentClaim) => currentClaim.id === claim.id) ?? claim)
        // APPLE GUIDELINE 1.2 — user blocking (NEW): context claims are
        // already filtered, but the category/search feed keeps a local copy
        // (feedClaims) whose `?? claim` fallback would keep a just-blocked
        // author visible. This one line makes blocking instant there too.
        .filter((claim) => !blockedUserIds.includes(claim.authorId))
    );
  }, [blockedUserIds, claims, feedClaims, filteredFeedActive]);

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

        setFeedError(CLAIMS_LOAD_ERROR_MESSAGE);
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

  useEffect(() => {
    void refreshUnreadNotifications();
  }, [refreshUnreadNotifications]);

  // PHASE 6 STEP 4 (NEW): fetch matching topic clusters when a search query is
  // active. Fails soft to [] so existing search behavior is untouched.
  useEffect(() => {
    const trimmedQuery = debouncedQuery.trim();

    if (trimmedQuery.length < 2) {
      setTopicResults([]);
      return;
    }

    let cancelled = false;

    void (async () => {
      const topics = await searchTopics(trimmedQuery);

      if (!cancelled) {
        setTopicResults(topics);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [debouncedQuery]);

  useFocusEffect(
    useCallback(() => {
      void refreshUnreadNotifications();
    }, [refreshUnreadNotifications]),
  );

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
      setFeedError(CLAIMS_LOAD_ERROR_MESSAGE);
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

  const listHeader = (
    <View>
      {/* PHASE 5 election positioning UI */}
      <View style={styles.midtermsBanner}>
        <Text style={styles.midtermsBannerTitle}>2026 Midterms Watch</Text>
        <Text style={styles.midtermsBannerSubtitle}>The red. The blue. The truth.</Text>
      </View>
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Search claims, sources, topics..."
        placeholderTextColor={appTheme.colors.muted}
        style={styles.searchInput}
        autoCapitalize="none"
        autoCorrect={false}
      />
      {/* PHASE 3 STEP 12 */}
      {liveUpdatesEnabled ? <Text style={styles.liveText}>Live updates on</Text> : null}
      {/* PHASE 4 STEP 2 */}
      {aiPrecheckNotice ? (
        <TouchableOpacity
          style={styles.aiNoticeBanner}
          activeOpacity={0.85}
          onPress={clearAiPrecheckNotice}
          accessibilityRole="button"
          accessibilityLabel="AI notice"
          accessibilityHint="Tap to dismiss the AI information banner"
        >
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
              accessibilityRole="tab"
              accessibilityLabel={`Filter claims by ${category}`}
              accessibilityHint="Selects this claim category"
              accessibilityState={{ selected }}
            >
              <Text style={[styles.categoryChipText, selected && styles.categoryChipTextSelected]}>{category}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
      {/* PHASE 6 STEP 4 (NEW): topic cluster cards ABOVE individual claims.
          Empty topicResults = nothing rendered = screen behaves as before. */}
      {debouncedQuery.trim().length >= 2 && topicResults.length > 0 ? (
        <View style={styles.topicResultsBlock}>
          <Text style={styles.topicResultsHeading}>Topics</Text>
          {topicResults.map((topic) => (
            <TouchableOpacity
              key={topic.topic_cluster_id}
              style={styles.topicCard}
              activeOpacity={0.85}
              onPress={() => router.push(`/topic/${topic.topic_cluster_id}`)}
              accessibilityRole="button"
              accessibilityLabel={`Topic ${topic.topic_label}`}
              accessibilityHint="Opens all claims in this topic"
            >
              <Text style={styles.topicCardLabel}>{topic.topic_label}</Text>
              <View style={styles.topicCardMetaRow}>
                <Text style={[styles.topicVerdictChip, getTopicVerdictChipStyle(topic.cluster_verdict, styles)]}>
                  {formatTopicVerdict(topic.cluster_verdict)}
                </Text>
                <Text style={styles.topicCardMetaText}>
                  {topic.total_vote_count} votes {"·"} {topic.claim_count}{" "}
                  {topic.claim_count === 1 ? "claim" : "claims"}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      ) : null}
      {claimPosted === "1" ? (
        <View style={styles.successBanner}>
          <Text style={styles.successText}>Claim posted.</Text>
        </View>
      ) : null}
      {displayError ? (
        <View style={styles.errorPanel}>
          <Text style={styles.errorTitle}>Unable to load claims right now.</Text>
          {/* PHASE 4 STEP 24 */}
          <Text style={styles.errorText}>Please pull to refresh or try again shortly.</Text>
          <TouchableOpacity
            style={styles.retryButton}
            activeOpacity={0.8}
            onPress={handleRefresh}
            accessibilityRole="button"
            accessibilityLabel="Retry loading claims"
            accessibilityHint="Reloads the claim list"
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : null}
      {listLoading ? (
        <ClaimListSkeleton count={3} />
      ) : null}
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <Header
        title="Verifact"
        subtitle="Verify news with community evidence"
        rightIcon="notifications-outline"
        rightBadgeCount={unreadNotificationCount}
        onRightIconPress={() => router.push("/notifications")}
        rightAccessibilityLabel="Notifications"
        rightAccessibilityHint="Opens your notifications"
      />
      <FlatList
        data={visibleClaims}
        keyExtractor={(claim) => claim.id}
        renderItem={renderClaim}
        contentContainerStyle={contentContainerStyle}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.45}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={
          !listLoading && !displayError ? (
            <EmptyState
              icon="document-text-outline"
              title={filteredFeedActive ? "No matching claims" : "No claims yet"}
              message={
                filteredFeedActive
                  ? "Try a different search or category."
                  : "Be the first to submit a claim for verification."
              }
              actionLabel={filteredFeedActive ? undefined : "Create claim"}
              onActionPress={filteredFeedActive ? undefined : () => router.push("/create")}
            />
          ) : null
        }
        ListFooterComponent={
          listLoadingMore ? (
            <View style={styles.footerLoader}>
              <ClaimListSkeleton count={1} />
            </View>
          ) : null
        }
      />
    </SafeAreaView>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.card,
  },
  content: {
    paddingHorizontal: 10,
    paddingTop: 10,
    ...centeredContentStyle,
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
    borderWidth: theme.borderWidth,
    color: theme.colors.text,
    fontSize: theme.typography.body.fontSize,
    marginBottom: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
  },
  // PHASE 5 election positioning UI
  midtermsBanner: {
    backgroundColor: theme.colors.banner,
    borderRadius: theme.radius.sm,
    justifyContent: "center",
    marginBottom: theme.spacing.md,
    minHeight: 62,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  midtermsBannerTitle: {
    color: theme.colors.chipActiveText,
    fontSize: Math.round(19 * (theme.typography.body.fontSize / 16)),
    fontWeight: "500",
    lineHeight: Math.round(24 * (theme.typography.body.fontSize / 16)),
  },
  midtermsBannerSubtitle: {
    color: theme.colors.bannerSubtitle,
    fontSize: Math.round(15 * (theme.typography.body.fontSize / 16)),
    fontWeight: "400",
    lineHeight: Math.round(20 * (theme.typography.body.fontSize / 16)),
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
    borderColor: theme.colors.warningBorder,
    borderRadius: 999,
    borderWidth: 1,
    marginBottom: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  aiNoticeText: {
    color: theme.colors.warningText,
    fontSize: 11,
    fontWeight: "500",
  },
  categoryRow: {
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.md,
    paddingRight: theme.spacing.lg,
  },
  categoryChip: {
    backgroundColor: theme.colors.chipInactiveBg,
    borderColor: theme.colors.border,
    borderRadius: 999,
    borderWidth: theme.borderWidth,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  categoryChipSelected: {
    backgroundColor: theme.colors.chipActiveBg,
    borderColor: theme.colors.chipActiveBg,
  },
  categoryChipText: {
    color: theme.colors.chipInactiveText,
    fontSize: theme.typography.small.fontSize,
    fontWeight: "500",
  },
  categoryChipTextSelected: {
    color: theme.colors.chipActiveText,
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
    color: theme.colors.chipActiveText,
    fontSize: theme.typography.small.fontSize,
    fontWeight: "500",
  },
  footerLoader: {
    alignItems: "center",
    paddingVertical: theme.spacing.lg,
  },
  // PHASE 6 STEP 4 (NEW): topic cluster result cards.
  topicResultsBlock: {
    marginBottom: theme.spacing.md,
  },
  topicResultsHeading: {
    color: theme.colors.subtext,
    fontSize: theme.typography.small.fontSize,
    fontWeight: "500",
    marginBottom: theme.spacing.sm,
    textTransform: "uppercase",
  },
  topicCard: {
    backgroundColor: theme.colors.banner,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
    padding: theme.spacing.md,
  },
  topicCardLabel: {
    color: theme.colors.chipActiveText,
    fontSize: theme.typography.body.fontSize,
    fontWeight: "500",
  },
  topicCardMetaRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: theme.spacing.sm,
  },
  topicCardMetaText: {
    color: theme.colors.bannerSubtitle,
    fontSize: theme.typography.small.fontSize,
  },
  topicVerdictChip: {
    borderRadius: 999,
    fontSize: 11,
    fontWeight: "500",
    overflow: "hidden",
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
  },
  topicVerdictTrue: {
    backgroundColor: theme.colors.successBg,
    color: theme.colors.success,
  },
  topicVerdictFake: {
    backgroundColor: theme.colors.dangerBg,
    color: theme.colors.danger,
  },
  topicVerdictDisputed: {
    backgroundColor: theme.colors.warningBg,
    color: theme.colors.warningText,
  },
  topicVerdictInsufficient: {
    backgroundColor: theme.colors.chipInactiveBg,
    color: theme.colors.chipInactiveText,
  },
  });
}
