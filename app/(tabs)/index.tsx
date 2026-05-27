// PHASE 1 STEP 4
import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, SafeAreaView, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Header } from "../../components/Header";
import { ClaimCard } from "../../components/ClaimCard";
import { EmptyState } from "../../components/EmptyState";
import { claimCategories } from "../../constants/claimCategories";
import { useClaims } from "../../context/ClaimsContext";
import { useDebounce } from "../../hooks/useDebounce";
import type { Claim } from "../../types/claim";
import { theme } from "../../constants/theme";

// PHASE 3 STEP 9
const categoryChips = ["All", ...claimCategories];

export default function HomeScreen() {
  const router = useRouter();
  const { claimPosted } = useLocalSearchParams<{ claimPosted?: string }>();
  // PHASE 3 STEP 3
  const {
    claims,
    loading,
    error,
    voteOnClaim,
    reportClaim,
    searchClaims,
    fetchClaimsByCategory,
    fetchLatestClaims,
  } = useClaims();
  // PHASE 2 STEP 8
  const [query, setQuery] = useState("");
  // PHASE 3 STEP 9
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [feedClaims, setFeedClaims] = useState<Claim[] | null>(null);
  const [feedLoading, setFeedLoading] = useState(false);
  const [feedError, setFeedError] = useState("");
  const debouncedQuery = useDebounce(query, 400);
  // PHASE 2 STEP 10
  const [refreshing, setRefreshing] = useState(false);

  // PHASE 3 STEP 9
  const visibleClaims = useMemo(() => {
    const baseClaims = feedClaims ?? claims;
    return baseClaims.map((claim) => claims.find((currentClaim) => currentClaim.id === claim.id) ?? claim);
  }, [claims, feedClaims]);

  // PHASE 3 STEP 9
  const loadHomeFeed = useCallback(async () => {
    const normalizedQuery = debouncedQuery.trim();

    if (!normalizedQuery && !activeCategory) {
      setFeedClaims(null);
      setFeedError("");
      setFeedLoading(false);
      return;
    }

    setFeedLoading(true);
    setFeedError("");

    try {
      const nextClaims = normalizedQuery
        ? await searchClaims(normalizedQuery, { category: activeCategory, limit: 50 })
        : activeCategory
          ? await fetchClaimsByCategory(activeCategory)
          : await fetchLatestClaims();

      setFeedClaims(nextClaims);
    } catch (loadError) {
      setFeedClaims([]);
      setFeedError(loadError instanceof Error ? loadError.message : "We could not load this feed.");
    } finally {
      setFeedLoading(false);
    }
  }, [activeCategory, debouncedQuery, fetchClaimsByCategory, fetchLatestClaims, searchClaims]);

  // PHASE 3 STEP 9
  useEffect(() => {
    void loadHomeFeed();
  }, [loadHomeFeed]);

  const handleClaimPress = (claimId: string) => {
    router.push(`/claim/${claimId}`);
  };

  const handleRefresh = async () => {
    setRefreshing(true);

    try {
      if (debouncedQuery.trim() || activeCategory) {
        await loadHomeFeed();
      } else {
        await fetchLatestClaims();
      }
    } catch (refreshError) {
      setFeedError(refreshError instanceof Error ? refreshError.message : "We could not refresh claims.");
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Header title="FactLens" subtitle="Verify news with community evidence" />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      >
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search claims, sources, topics..."
          placeholderTextColor={theme.colors.muted}
          style={styles.searchInput}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryRow}
        >
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
            <Text style={styles.successText}>Claim posted. Voting closes in 24 hours.</Text>
          </View>
        ) : null}
        {loading || feedLoading ? (
          <View style={styles.statePanel}>
            <Text style={styles.stateText}>Loading claims...</Text>
          </View>
        ) : error || feedError ? (
          <View style={styles.errorPanel}>
            <Text style={styles.errorText}>{feedError || error}</Text>
          </View>
        ) : claims.length === 0 && !feedClaims ? (
          <EmptyState message="No claims yet. Be the first to post a news claim." />
        ) : visibleClaims.length === 0 ? (
          <EmptyState message="No matching claims." />
        ) : (
          visibleClaims.map((claim) => (
            <ClaimCard
              key={claim.id}
              claim={claim}
              onPress={() => handleClaimPress(claim.id)}
              onVote={voteOnClaim}
              onReport={reportClaim}
            />
          ))
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
  successBanner: {
    backgroundColor: "#DCFCE7",
    borderColor: "#BBF7D0",
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    marginBottom: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
  },
  successText: {
    color: theme.colors.success,
    fontSize: theme.typography.body.fontSize,
    fontWeight: "700",
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
  categoryRow: {
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.md,
    paddingRight: theme.spacing.lg,
  },
  categoryChip: {
    backgroundColor: theme.colors.background,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  categoryChipSelected: {
    backgroundColor: "#E0E7FF",
    borderColor: theme.colors.primary,
  },
  categoryChipText: {
    color: theme.colors.subtext,
    fontSize: theme.typography.small.fontSize,
    fontWeight: "700",
  },
  categoryChipTextSelected: {
    color: theme.colors.primary,
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

