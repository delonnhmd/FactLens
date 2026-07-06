// Saved claims list. Reuses ClaimCard and the getSavedClaims pagination
// (20 per page, newest saved first). Fetched with the normal client, so
// claims RLS applies: moderation-hidden claims and blocked authors never
// render here for normal users. Unsaving filters the row out instantly via
// the context's savedClaimIds.
import { useCallback, useEffect, useMemo, useState } from "react";
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
import { getSavedClaims } from "../services/claimService";
import type { Claim } from "../types/claim";

const SAVED_PAGE_SIZE = 20;

export default function SavedClaimsScreen() {
  const router = useRouter();
  const { currentUser } = useAuth();
  const { voteOnClaim, reportClaim, savedClaimIds } = useClaims();

  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [hasMore, setHasMore] = useState(true);

  const loadSaved = useCallback(async (offset: number) => {
    if (offset === 0) {
      setLoading(true);
    } else {
      setLoadingMore(true);
    }

    setError("");

    const result = await getSavedClaims(offset, SAVED_PAGE_SIZE);

    if (result.error) {
      setError("Could not load saved claims right now.");
    } else {
      setClaims((previous) => (offset === 0 ? result.claims : [...previous, ...result.claims]));
      setHasMore(result.claims.length === SAVED_PAGE_SIZE);
    }

    setLoading(false);
    setLoadingMore(false);
  }, []);

  useEffect(() => {
    if (!currentUser) {
      setClaims([]);
      setLoading(false);
      return;
    }

    void loadSaved(0);
  }, [currentUser, loadSaved]);

  // Unsaving anywhere removes the row immediately (test c) without a refetch.
  const visibleClaims = useMemo(
    () => claims.filter((claim) => savedClaimIds.includes(claim.id)),
    [claims, savedClaimIds],
  );

  const handleEndReached = useCallback(() => {
    if (!loading && !loadingMore && hasMore && currentUser) {
      void loadSaved(claims.length);
    }
  }, [claims.length, currentUser, hasMore, loadSaved, loading, loadingMore]);

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
      <TouchableOpacity style={styles.backButton} activeOpacity={0.8} onPress={() => router.back()}>
        <Ionicons name="chevron-back" size={16} color={theme.colors.link} />
        <Text style={styles.backText}>Back</Text>
      </TouchableOpacity>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      {!currentUser ? <Text style={styles.emptyText}>Log in to save claims.</Text> : null}
      {currentUser && !loading && !error && visibleClaims.length === 0 ? (
        <Text style={styles.emptyText}>No saved claims yet. Tap {"⋯"} on any claim to save it.</Text>
      ) : null}
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <Header title="Saved claims" subtitle="Claims you bookmarked" />
      <FlatList
        data={visibleClaims}
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
