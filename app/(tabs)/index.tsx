// PHASE 1 STEP 4
import { useMemo, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, SafeAreaView, Text, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Header } from "../../components/Header";
import { ClaimCard } from "../../components/ClaimCard";
import { EmptyState } from "../../components/EmptyState";
import { useClaims } from "../../context/ClaimsContext";
import { theme } from "../../constants/theme";

export default function HomeScreen() {
  const router = useRouter();
  const { claimPosted } = useLocalSearchParams<{ claimPosted?: string }>();
  // PHASE 3 STEP 3
  const { claims, loading, error, voteOnClaim, reportClaim } = useClaims();
  // PHASE 2 STEP 8
  const [query, setQuery] = useState("");
  // PHASE 2 STEP 10
  const [refreshing, setRefreshing] = useState(false);

  const filteredClaims = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) {
      return claims;
    }

    return claims.filter((claim) => {
      const searchableText = [
        claim.title,
        claim.description,
        claim.sourceUrl,
        claim.category ?? "",
      ]
        .join(" ")
        .toLowerCase();

      return searchableText.includes(normalizedQuery);
    });
  }, [claims, query]);

  const handleClaimPress = (claimId: string) => {
    router.push(`/claim/${claimId}`);
  };

  const handleRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 450);
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
        {claimPosted === "1" ? (
          <View style={styles.successBanner}>
            <Text style={styles.successText}>Claim posted. Voting closes in 24 hours.</Text>
          </View>
        ) : null}
        {loading ? (
          <View style={styles.statePanel}>
            <Text style={styles.stateText}>Loading claims...</Text>
          </View>
        ) : error ? (
          <View style={styles.errorPanel}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : claims.length === 0 ? (
          <EmptyState message="No claims yet. Be the first to post a news claim." />
        ) : filteredClaims.length === 0 ? (
          <EmptyState message="No matching claims." />
        ) : (
          filteredClaims.map((claim) => (
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

