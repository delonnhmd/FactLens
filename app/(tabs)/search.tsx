// PHASE 2 STEP 8
import { useEffect, useMemo, useState } from "react";
import { SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { ClaimCard } from "../../components/ClaimCard";
import { EmptyState } from "../../components/EmptyState";
import { Header } from "../../components/Header";
import { claimCategories } from "../../constants/claimCategories";
import { useClaims } from "../../context/ClaimsContext";
import { useDebounce } from "../../hooks/useDebounce";
import type { Claim } from "../../types/claim";
import type { ClaimFeedFilter } from "../../services/claimService";
import { theme } from "../../constants/theme";

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

export default function SearchScreen() {
  const router = useRouter();
  const { claims, searchClaims, voteOnClaim, reportClaim } = useClaims();
  const [query, setQuery] = useState("");
  // PHASE 3 STEP 9
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<ClaimFeedFilter>("ALL");
  const [results, setResults] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const debouncedQuery = useDebounce(query, 400);

  // PHASE 3 STEP 9
  useEffect(() => {
    let mounted = true;

    async function runSearch() {
      setLoading(true);
      setError("");

      try {
        const nextResults = await searchClaims(debouncedQuery, {
          category: activeCategory,
          filter: activeFilter,
          limit: 75,
        });

        if (mounted) {
          setResults(nextResults);
        }
      } catch (searchError) {
        if (mounted) {
          setResults([]);
          setError(searchError instanceof Error ? searchError.message : "We could not search claims right now.");
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    void runSearch();

    return () => {
      mounted = false;
    };
  }, [activeCategory, activeFilter, debouncedQuery, searchClaims]);

  // PHASE 3 STEP 9
  const syncedResults = useMemo(
    () => results.map((claim) => claims.find((currentClaim) => currentClaim.id === claim.id) ?? claim),
    [claims, results],
  );

  return (
    <SafeAreaView style={styles.container}>
      <Header title="Search" subtitle="Find claims, sources, and topics" />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
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

        {loading ? (
          <View style={styles.statePanel}>
            <Text style={styles.stateText}>Searching claims...</Text>
          </View>
        ) : error ? (
          <View style={styles.errorPanel}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : syncedResults.length > 0 ? (
          syncedResults.map((claim) => (
            <ClaimCard
              key={claim.id}
              claim={claim}
              onPress={() => router.push(`/claim/${claim.id}`)}
              onVote={voteOnClaim}
              onReport={reportClaim}
            />
          ))
        ) : (
          <EmptyState message="No matching claims yet." />
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
