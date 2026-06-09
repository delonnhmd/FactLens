// PHASE 5 STEP 1
// PHASE 5 STEP 5 PRE-LAUNCH
import { useCallback, useEffect, useState } from "react";
import { RefreshControl, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Header } from "../../components/Header";
import { EmptyState } from "../../components/EmptyState";
import { LeaderboardSkeleton } from "../../components/Skeleton";
import { theme } from "../../constants/theme";
import { useAuth } from "../../context/AuthContext";
import {
  fetchLeaderboard,
  type LeaderboardScope,
  type LeaderboardUser,
} from "../../services/leaderboardService";
import { formatPoints, getTopBadges } from "../../utils/reputation";

const tabs: Array<{ label: string; value: LeaderboardScope }> = [
  { label: "This Month", value: "monthly" },
  { label: "All Time", value: "all_time" },
];

export default function LeaderboardScreen() {
  // PHASE 5 STEP 1E
  const router = useRouter();
  const { currentUser } = useAuth();
  const [scope, setScope] = useState<LeaderboardScope>("monthly");
  const [users, setUsers] = useState<LeaderboardUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [nextMonthlyResetAt, setNextMonthlyResetAt] = useState<string | null>(null);

  const resetCountdown = (() => {
    if (!nextMonthlyResetAt) {
      return "";
    }

    const remainingMs = new Date(nextMonthlyResetAt).getTime() - Date.now();

    if (!Number.isFinite(remainingMs) || remainingMs <= 0) {
      return "Monthly board resets soon.";
    }

    const days = Math.floor(remainingMs / (24 * 60 * 60 * 1000));
    const hours = Math.floor((remainingMs % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
    return `Monthly board resets in ${days}d ${hours}h.`;
  })();

  const loadLeaderboard = useCallback(
    async (showRefresh = false) => {
      if (showRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError("");

      try {
        const result = await fetchLeaderboard(scope, 50);

        if (result.error) {
          setError("Could not connect. Check your connection and try again.");
        }

        setUsers(result.users);
        setNextMonthlyResetAt(result.nextMonthlyResetAt ?? null);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [scope],
  );

  useEffect(() => {
    void loadLeaderboard();
  }, [loadLeaderboard]);

  return (
    <SafeAreaView style={styles.container}>
      <Header title="Leaderboard" subtitle="Top Verifact contributors" />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadLeaderboard(true)} />}
      >
        <View style={styles.tabRow}>
          {tabs.map((tab) => {
            const selected = scope === tab.value;

            return (
              <TouchableOpacity
                key={tab.value}
                style={[styles.tabButton, selected && styles.tabButtonSelected]}
                activeOpacity={0.85}
                onPress={() => setScope(tab.value)}
              >
                <Text style={[styles.tabText, selected && styles.tabTextSelected]}>{tab.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {scope === "monthly" && resetCountdown ? (
          <Text style={styles.resetText}>{resetCountdown}</Text>
        ) : null}

        <View style={styles.card}>
          {loading ? <LeaderboardSkeleton count={6} /> : null}
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
          {!loading && users.length === 0 ? (
            <EmptyState
              icon="trophy-outline"
              title="No leaderboard activity yet"
              message="Earn reputation points by voting and adding evidence."
            />
          ) : null}

          {users.map((user, index) => {
            const topBadges = getTopBadges(user.badges, 1);

            return (
              <TouchableOpacity
                key={user.id}
                style={[
                  styles.row,
                  index === 0 && styles.rowGold,
                  index === 1 && styles.rowSilver,
                  index === 2 && styles.rowBronze,
                  currentUser?.id === user.id && styles.currentUserRow,
                ]}
                activeOpacity={0.85}
                onPress={() => router.push(`/profile/${user.username}`)}
              >
                <View style={styles.position}>
                  <Text
                    style={[
                      styles.positionText,
                      index === 0 && styles.positionGold,
                      index === 1 && styles.positionSilver,
                      index === 2 && styles.positionBronze,
                    ]}
                  >
                    {index + 1}
                  </Text>
                </View>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{user.username.slice(0, 1).toUpperCase()}</Text>
                </View>
                <View style={styles.userInfo}>
                  <Text style={styles.username} numberOfLines={1}>
                    @{user.username}
                  </Text>
                  <View style={styles.metaRow}>
                    <Text style={styles.rankTitle} numberOfLines={1}>
                      {user.rankTitle}
                    </Text>
                    {topBadges.map((badge) => (
                      <Text key={badge.id} style={styles.badge} numberOfLines={1}>
                        {badge.name}
                      </Text>
                    ))}
                  </View>
                </View>
                <View style={styles.pointsBox}>
                  <Ionicons name="sparkles-outline" size={14} color={theme.colors.ai} />
                  <Text style={styles.points}>{formatPoints(user.points)}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
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
    paddingBottom: theme.spacing.xl,
  },
  tabRow: {
    backgroundColor: theme.colors.background,
    borderColor: theme.colors.lightBorder,
    borderRadius: theme.radius.md,
    borderWidth: 0.5,
    flexDirection: "row",
    gap: theme.spacing.sm,
    marginBottom: 10,
    padding: 6,
  },
  tabButton: {
    alignItems: "center",
    borderRadius: theme.radius.sm,
    flex: 1,
    paddingVertical: theme.spacing.sm,
  },
  tabButtonSelected: {
    backgroundColor: theme.colors.navy,
  },
  tabText: {
    color: theme.colors.subtext,
    fontSize: 13,
    fontWeight: "500",
  },
  tabTextSelected: {
    color: theme.colors.background,
  },
  card: {
    backgroundColor: theme.colors.background,
    borderColor: theme.colors.lightBorder,
    borderRadius: theme.radius.md,
    borderWidth: 0.5,
    overflow: "hidden",
  },
  resetText: {
    color: theme.colors.subtext,
    fontSize: 12,
    fontWeight: "500",
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  row: {
    alignItems: "center",
    borderBottomColor: theme.colors.lightBorder,
    borderBottomWidth: 0.5,
    flexDirection: "row",
    gap: theme.spacing.md,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  currentUserRow: {
    borderLeftColor: theme.colors.navy,
    borderLeftWidth: 3,
  },
  rowGold: {
    backgroundColor: "#FFF8E8",
  },
  rowSilver: {
    backgroundColor: "#F7F8FA",
  },
  rowBronze: {
    backgroundColor: "#FFF2E8",
  },
  position: {
    alignItems: "center",
    backgroundColor: theme.colors.phaseBg,
    borderRadius: 16,
    height: 32,
    justifyContent: "center",
    width: 32,
  },
  positionText: {
    color: theme.colors.ai,
    fontSize: 13,
    fontWeight: "500",
  },
  positionGold: {
    color: "#9A6400",
  },
  positionSilver: {
    color: "#5E6673",
  },
  positionBronze: {
    color: "#9A4F17",
  },
  avatar: {
    alignItems: "center",
    backgroundColor: theme.colors.tagBg,
    borderRadius: 15,
    height: 30,
    justifyContent: "center",
    width: 30,
  },
  avatarText: {
    color: theme.colors.tagText,
    fontSize: 12,
    fontWeight: "500",
  },
  userInfo: {
    flex: 1,
  },
  username: {
    color: theme.colors.text,
    fontSize: 15,
    fontWeight: "500",
  },
  metaRow: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 4,
  },
  rankTitle: {
    color: theme.colors.subtext,
    fontSize: 12,
    fontWeight: "400",
  },
  badge: {
    backgroundColor: theme.colors.sourceBg,
    borderRadius: 999,
    color: theme.colors.sourceText,
    fontSize: 10,
    fontWeight: "500",
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  pointsBox: {
    alignItems: "flex-end",
    gap: 3,
  },
  points: {
    color: theme.colors.text,
    fontSize: 13,
    fontWeight: "500",
  },
  placeholder: {
    color: theme.colors.subtext,
    fontSize: 14,
    padding: theme.spacing.md,
  },
  errorText: {
    color: theme.colors.danger,
    fontSize: 13,
    fontWeight: "500",
    padding: theme.spacing.md,
  },
});
