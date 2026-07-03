// PHASE 6 STEP 4 — Topic cluster screen (NEW file).
// Frontend changes: JS-only, no native modules changed, no app.json changed.
// Deploy with: eas update --channel preview
// Do NOT run eas build — Apple review is in progress.
// Backend changes deploy to Render independently.
//
// Read-only screen: topic header (label, combined verdict, vote bar, claim
// count) above a flat list of member claims. Claim cards are the existing
// ClaimCard component reused exactly — each shows its own author, verdict,
// and vote counts; vote/report handlers are the existing ClaimsContext ones.
import { useCallback, useEffect, useMemo, useState } from "react";
import { FlatList, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { ClaimCard } from "../../components/ClaimCard";
import { EmptyState } from "../../components/EmptyState";
import { ClaimListSkeleton } from "../../components/Skeleton";
import { useClaims } from "../../context/ClaimsContext";
import type { AppTheme } from "../../context/DisplaySettingsContext";
import { useAppTheme } from "../../hooks/useTheme";
import { mapClaimRowToClaim } from "../../services/claimService";
import { fetchTopicClaims, type TopicRow } from "../../services/topicService";
import type { Claim } from "../../types/claim";

const TOPIC_PAGE_SIZE = 20;

type ClaimRowInput = Parameters<typeof mapClaimRowToClaim>[0];

function formatTopicVerdict(verdict: string | null): string {
  if (verdict === "TRUE") return "Community Says True";
  if (verdict === "FAKE") return "Community Says Fake";
  if (verdict === "DISPUTED") return "Disputed";
  return "Insufficient data";
}

export default function TopicScreen() {
  const router = useRouter();
  const appTheme = useAppTheme();
  const styles = useMemo(() => createStyles(appTheme), [appTheme]);
  const { cluster_id: clusterId } = useLocalSearchParams<{ cluster_id: string }>();
  const { voteOnClaim, reportClaim } = useClaims();
  const [topic, setTopic] = useState<TopicRow | null>(null);
  const [topicClaims, setTopicClaims] = useState<Claim[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const loadPage = useCallback(
    async (nextOffset: number, replace: boolean) => {
      if (!clusterId) {
        setLoading(false);
        setLoadError(true);
        return;
      }

      if (replace) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }

      const response = await fetchTopicClaims(String(clusterId), TOPIC_PAGE_SIZE, nextOffset);

      if (!response) {
        setLoadError(true);
        setLoading(false);
        setLoadingMore(false);
        return;
      }

      const mappedClaims = (response.claims ?? []).map((row) => mapClaimRowToClaim(row as unknown as ClaimRowInput));

      setLoadError(false);
      setTopic(response.topic);
      setTotal(response.total);
      setTopicClaims((current) => (replace ? mappedClaims : [...current, ...mappedClaims]));
      setOffset(nextOffset + mappedClaims.length);
      setHasMore(nextOffset + mappedClaims.length < response.total);
      setLoading(false);
      setLoadingMore(false);
    },
    [clusterId],
  );

  useEffect(() => {
    void loadPage(0, true);
  }, [loadPage]);

  const handleEndReached = useCallback(() => {
    if (!loading && !loadingMore && hasMore) {
      void loadPage(offset, false);
    }
  }, [hasMore, loadPage, loading, loadingMore, offset]);

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

  const totalScoredVotes = (topic?.total_true_votes ?? 0) + (topic?.total_fake_votes ?? 0);
  const trueRatio = totalScoredVotes > 0 ? (topic?.total_true_votes ?? 0) / totalScoredVotes : 0.5;

  const listHeader = topic ? (
    <View style={styles.topicHeader}>
      <Text style={styles.topicLabel}>{topic.topic_label}</Text>
      <View style={styles.verdictRow}>
        <Text style={styles.verdictChip}>{formatTopicVerdict(topic.cluster_verdict)}</Text>
        <Text style={styles.metaText}>
          {topic.total_vote_count} votes {"·"} {total} {total === 1 ? "claim" : "claims"}
        </Text>
      </View>
      {totalScoredVotes > 0 ? (
        <View style={styles.voteBarTrack}>
          <View style={[styles.voteBarTrue, { flex: trueRatio }]} />
          <View style={[styles.voteBarFake, { flex: 1 - trueRatio }]} />
        </View>
      ) : null}
      {totalScoredVotes > 0 ? (
        <View style={styles.voteBarLegend}>
          <Text style={styles.voteBarTrueText}>True {topic.total_true_votes}</Text>
          <Text style={styles.voteBarFakeText}>Fake {topic.total_fake_votes}</Text>
        </View>
      ) : null}
      <Text style={styles.headerNote}>
        Each claim below keeps its own author, votes, and verdict. The topic verdict is a combined signal only.
      </Text>
    </View>
  ) : null;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.navRow}>
        <TouchableOpacity
          style={styles.backButton}
          activeOpacity={0.8}
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          accessibilityHint="Returns to the previous screen"
        >
          <Ionicons name="arrow-back" size={22} color={appTheme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.navTitle}>Topic</Text>
      </View>
      {loading ? (
        <View style={styles.content}>
          <ClaimListSkeleton count={3} />
        </View>
      ) : loadError || !topic ? (
        <EmptyState
          icon="alert-circle-outline"
          title="Topic unavailable"
          message="This topic could not be loaded right now. Please try again shortly."
          actionLabel="Go back"
          onActionPress={() => router.back()}
        />
      ) : (
        <FlatList
          data={topicClaims}
          keyExtractor={(claim) => claim.id}
          renderItem={renderClaim}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          onEndReached={handleEndReached}
          onEndReachedThreshold={0.45}
          ListHeaderComponent={listHeader}
          ListEmptyComponent={
            <EmptyState
              icon="document-text-outline"
              title="No claims in this topic yet"
              message="Claims will appear here as the community posts about this topic."
            />
          }
          ListFooterComponent={
            loadingMore ? (
              <View style={styles.footerLoader}>
                <ClaimListSkeleton count={1} />
              </View>
            ) : null
          }
        />
      )}
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
      paddingBottom: 24,
    },
    navRow: {
      alignItems: "center",
      flexDirection: "row",
      gap: theme.spacing.sm,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
    },
    backButton: {
      padding: theme.spacing.sm,
    },
    navTitle: {
      color: theme.colors.text,
      fontSize: theme.typography.body.fontSize,
      fontWeight: "500",
    },
    topicHeader: {
      backgroundColor: theme.colors.banner,
      borderColor: theme.colors.border,
      borderRadius: theme.radius.sm,
      borderWidth: 1,
      gap: theme.spacing.sm,
      marginBottom: theme.spacing.md,
      padding: theme.spacing.md,
    },
    topicLabel: {
      color: theme.colors.chipActiveText,
      fontSize: Math.round(19 * (theme.typography.body.fontSize / 16)),
      fontWeight: "500",
    },
    verdictRow: {
      alignItems: "center",
      flexDirection: "row",
      gap: theme.spacing.sm,
    },
    verdictChip: {
      backgroundColor: theme.colors.background,
      borderRadius: 999,
      color: theme.colors.text,
      fontSize: theme.typography.small.fontSize,
      fontWeight: "500",
      overflow: "hidden",
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.xs,
    },
    metaText: {
      color: theme.colors.bannerSubtitle,
      fontSize: theme.typography.small.fontSize,
    },
    voteBarTrack: {
      borderRadius: 999,
      flexDirection: "row",
      height: 10,
      overflow: "hidden",
    },
    voteBarTrue: {
      backgroundColor: theme.colors.success,
    },
    voteBarFake: {
      backgroundColor: theme.colors.danger,
    },
    voteBarLegend: {
      flexDirection: "row",
      justifyContent: "space-between",
    },
    voteBarTrueText: {
      color: theme.colors.success,
      fontSize: theme.typography.small.fontSize,
      fontWeight: "500",
    },
    voteBarFakeText: {
      color: theme.colors.danger,
      fontSize: theme.typography.small.fontSize,
      fontWeight: "500",
    },
    headerNote: {
      color: theme.colors.bannerSubtitle,
      fontSize: theme.typography.small.fontSize,
      lineHeight: theme.typography.small.lineHeight,
    },
    footerLoader: {
      alignItems: "center",
      paddingVertical: theme.spacing.lg,
    },
  });
}
