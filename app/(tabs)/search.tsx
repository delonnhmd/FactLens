// PHASE 2 STEP 8
import { useMemo, useState } from "react";
import { SafeAreaView, ScrollView, StyleSheet, TextInput } from "react-native";
import { useRouter } from "expo-router";
import { ClaimCard } from "../../components/ClaimCard";
import { EmptyState } from "../../components/EmptyState";
import { Header } from "../../components/Header";
import { useClaims } from "../../context/ClaimsContext";
import { theme } from "../../constants/theme";

export default function SearchScreen() {
  const router = useRouter();
  const { claims, voteOnClaim, reportClaim } = useClaims();
  const [query, setQuery] = useState("");

  const matchingClaims = useMemo(() => {
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
        {matchingClaims.length > 0 ? (
          matchingClaims.map((claim) => (
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
});

