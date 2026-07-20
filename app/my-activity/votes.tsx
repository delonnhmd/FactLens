import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";

import type { AppTheme } from "../../context/DisplaySettingsContext";
import { useAppTheme } from "../../hooks/useTheme";
import { fetchPrivateVoteHistory, type PrivateVoteHistoryItem } from "../../services/profileActivityService";

function voteLabel(value: PrivateVoteHistoryItem["voteType"]): string {
  if (value === "TRUE") return "True";
  if (value === "FAKE") return "Fake";
  return "Not sure";
}

function verdictLabel(value: PrivateVoteHistoryItem["finalVerdict"]): string {
  if (value === "TRUE") return "Community says True";
  if (value === "FAKE") return "Community says Fake";
  if (value === "NEEDS_MORE_EVIDENCE") return "Needs more evidence";
  return "Verdict pending";
}

function relativeDate(value: string | null): string {
  if (!value) return "date unavailable";
  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) return "date unavailable";
  const days = Math.floor(Math.max(0, Date.now() - timestamp) / 86_400_000);
  if (days < 1) return "today";
  return `${days} ${days === 1 ? "day" : "days"} ago`;
}

export default function VotingHistoryScreen() {
  const router = useRouter();
  const appTheme = useAppTheme();
  const styles = useMemo(() => createStyles(appTheme), [appTheme]);
  const [votes, setVotes] = useState<PrivateVoteHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retryNonce, setRetryNonce] = useState(0);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError("");

    fetchPrivateVoteHistory().then((result) => {
      if (!mounted) return;
      setVotes(result.votes);
      setError(result.error ?? "");
      setLoading(false);
    });

    return () => {
      mounted = false;
    };
  }, [retryNonce]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerButton} activeOpacity={0.75} onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Back">
          <Ionicons name="chevron-back" size={22} color={appTheme.colors.chipActiveText} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Voting history</Text>
        <View style={styles.headerButton} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.privacyNote}>This private history is visible only to you.</Text>
        {loading ? <Text style={styles.statusText}>Loading voting history...</Text> : null}
        {!loading && error ? (
          <View style={styles.emptyCard}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryButton} activeOpacity={0.8} onPress={() => setRetryNonce((value) => value + 1)}><Text style={styles.retryText}>Try again</Text></TouchableOpacity>
          </View>
        ) : null}
        {!loading && !error && votes.length === 0 ? <View style={styles.emptyCard}><Text style={styles.emptyTitle}>No votes yet</Text><Text style={styles.statusText}>Vote on a claim to see your private voting history here.</Text></View> : null}

        {!loading && !error ? votes.map((vote) => {
          const resultText = vote.result === "MATCHED" ? "✓ Matched final verdict" : vote.result === "DID_NOT_MATCH" ? "✕ Did not match final verdict" : "⏳ Verdict pending";
          return (
            <TouchableOpacity key={vote.claimId} style={styles.voteCard} activeOpacity={0.85} onPress={() => router.push(`/claim/${vote.claimId}`)}>
              <Text style={styles.claimTitle}>{vote.claimTitle}</Text>
              <Text style={styles.detailText}>Your vote: <Text style={styles.detailStrong}>{voteLabel(vote.voteType)}</Text></Text>
              <Text style={styles.detailText}>Final result: <Text style={styles.detailStrong}>{verdictLabel(vote.finalVerdict)}</Text></Text>
              <Text style={styles.dateText}>Voted {relativeDate(vote.votedAt)}</Text>
              <View style={styles.resultWrap}><Text style={styles.resultLabel}>Result:</Text><Text style={[styles.resultText, vote.result === "MATCHED" ? styles.resultMatched : vote.result === "DID_NOT_MATCH" ? styles.resultMissed : styles.resultPending]}>{resultText}</Text></View>
            </TouchableOpacity>
          );
        }) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    container: { backgroundColor: theme.colors.card, flex: 1 },
    header: { alignItems: "center", backgroundColor: theme.colors.navy, flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 14, paddingVertical: 12 },
    headerButton: { alignItems: "center", height: 44, justifyContent: "center", width: 44 },
    headerTitle: { color: theme.colors.chipActiveText, fontSize: 20, fontWeight: "500" },
    content: { gap: 12, padding: 12, paddingBottom: 32 },
    privacyNote: { color: theme.colors.subtext, fontSize: 13, lineHeight: 19 },
    statusText: { color: theme.colors.subtext, fontSize: 14, lineHeight: 20, textAlign: "center" },
    emptyCard: { alignItems: "center", backgroundColor: theme.colors.background, borderColor: theme.colors.lightBorder, borderRadius: 12, borderWidth: theme.borderWidth, gap: 10, padding: 24 },
    emptyTitle: { color: theme.colors.text, fontSize: 18, fontWeight: "500" },
    errorText: { color: theme.colors.danger, fontSize: 14, lineHeight: 20, textAlign: "center" },
    retryButton: { backgroundColor: theme.colors.primary, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10 },
    retryText: { color: theme.colors.chipActiveText, fontSize: 14, fontWeight: "500" },
    voteCard: { backgroundColor: theme.colors.background, borderColor: theme.colors.lightBorder, borderRadius: 12, borderWidth: theme.borderWidth, padding: 16 },
    claimTitle: { color: theme.colors.text, fontSize: 18, fontWeight: "500", lineHeight: 24, marginBottom: 12 },
    detailText: { color: theme.colors.subtext, fontSize: 14, lineHeight: 22 },
    detailStrong: { color: theme.colors.text, fontWeight: "500" },
    dateText: { color: theme.colors.subtext, fontSize: 12, marginTop: 12 },
    resultWrap: { borderTopColor: theme.colors.lightBorder, borderTopWidth: theme.borderWidth, marginTop: 14, paddingTop: 12 },
    resultLabel: { color: theme.colors.subtext, fontSize: 11 },
    resultText: { fontSize: 14, fontWeight: "500", marginTop: 5 },
    resultMatched: { color: theme.colors.success },
    resultMissed: { color: theme.colors.danger },
    resultPending: { color: theme.colors.warning },
  });
}
