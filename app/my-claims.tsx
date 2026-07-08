// My claims list — the current user's own posted claims. Reuses the SAME
// fetch path as the public profile (fetchClaimsByAuthorPage, 20 per page,
// newest first) and the SAME ClaimCard, so each row already carries the
// author 3-hour "Delete claim" option (Part B). Fetched with the normal
// client, so claims RLS applies (the author sees their own, including hidden).
// onDeleted removes a row instantly after a successful self-delete.
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { ClaimCard } from "../components/ClaimCard";
import { Header } from "../components/Header";
import { theme } from "../constants/theme";
import { useAuth } from "../context/AuthContext";
import { useClaims } from "../context/ClaimsContext";
import { fetchClaimsByAuthorPage } from "../services/claimService";
import type { Claim } from "../types/claim";

const MY_CLAIMS_PAGE_SIZE = 20;

export default function MyClaimsScreen() {
  const router = useRouter();
  const { currentUser } = useAuth();
  const { voteOnClaim, reportClaim } = useClaims();

  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [hasMore, setHasMore] = useState(true);

  const loadMyClaims = useCallback(
    async (offset: number) => {
      if (!currentUser) {
        return;
      }

      if (offset === 0) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }

      setError("");

      const result = await fetchClaimsByAuthorPage(currentUser.id, MY_CLAIMS_PAGE_SIZE, offset);

      if (result.error) {
        setError("Could not load your claims right now.");
      } else {
        setClaims((previous) => (offset === 0 ? result.claims : [...previous, ...result.claims]));
        setHasMore(result.claims.length === MY_CLAIMS_PAGE_SIZE);
      }

      setLoading(false);
      setLoadingMore(false);
    },
    [currentUser],
  );

  useEffect(() => {
    if (!currentUser) {
      setClaims([]);
      setLoading(false);
      return;
    }

    void loadMyClaims(0);
  }, [currentUser, loadMyClaims]);

  const handleEndReached = useCallback(() => {
    if (!loading && !loadingMore && hasMore && currentUser) {
      void loadMyClaims(claims.length);
    }
  }, [claims.length, currentUser, hasMore, loadMyClaims, loading, loadingMore]);

  // Remove a row immediately after a successful author self-delete.
  const handleClaimDeleted = useCallback((claimId: string) => {
    setClaims((previous) => previous.filter((claim) => claim.id !== claimId));
  }, []);

  const renderClaim = useCallback(
    ({ item }: { item: Claim }) => (
      <ClaimCard
        claim={item}
        onPress={() => router.push(`/claim/${item.id}`)}
        onVote={voteOnClaim}
        onReport={reportClaim}
        onDeleted={handleClaimDeleted}
      />
    ),
    [handleClaimDeleted, reportClaim, router, voteOnClaim],
  );

  const listHeader = (
    <View>
      <TouchableOpacity style={styles.backButton} activeOpacity={0.8} onPress={() => router.back()}>
        <Ionicons name="chevron-back" size={16} color={theme.colors.link} />
        <Text style={styles.backText}>Back</Text>
      </TouchableOpacity>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      {!currentUser ? <Text style={styles.emptyText}>Log in to see your claims.</Text> : null}
      {currentUser && !loading && !error && claims.length === 0 ? (
        <Text style={styles.emptyText}>You haven't posted any claims yet.</Text>
      ) : null}
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <Header title="My claims" subtitle="Claims you posted" />
      <FlatList
        data={claims}
        keyExtractor={(item) => item.id}
        renderItem={renderClaim}
        ListHeaderComponent={listHeader}
        ListFooterComponent={
          loading || loadingMore ? (
            <ActivityIndicator style={styles.listSpinner} color={theme.colors.primary} />
          ) : null
        }
        contentContainerStyle={styles.content}
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.4}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: theme.colors.card,
    flex: 1,
  },
  content: {
    padding: 10,
  },
  backButton: {
    alignItems: "center",
    flexDirection: "row",
    gap: 4,
    marginBottom: 8,
  },
  backText: {
    color: theme.colors.link,
    fontSize: 13,
    fontWeight: "500",
  },
  emptyText: {
    color: theme.colors.subtext,
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 12,
  },
  errorText: {
    color: theme.colors.danger,
    fontSize: 13,
    marginBottom: 12,
  },
  listSpinner: {
    marginVertical: 16,
  },
});
