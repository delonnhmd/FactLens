// PHASE 1 STEP 4
// PHASE 3 STEP 27
// PHASE 3 STEP 28
// PHASE 4 STEP 27
import { useEffect, useRef, useState } from "react";
import { Alert, View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { Header } from "../../components/Header";
import { theme } from "../../constants/theme";
import { useAuth } from "../../context/AuthContext";
import { getAuthProfile } from "../../services/authProfile";
import { formatPoints, getDisplayRankInfo, getRankProgress, getTopBadges } from "../../utils/reputation";

export default function ProfileScreen() {
  // PHASE 3 STEP 2
  const router = useRouter();
  const {
    currentUser,
    profile,
    profileError,
    isAuthenticated,
    isVerified,
    loading,
    signOut,
    ensureProfile,
  } = useAuth();
  const fallbackProfile = getAuthProfile(currentUser);
  const [actionMessage, setActionMessage] = useState("");
  const [actionError, setActionError] = useState("");
  const profileAutoFixAttempted = useRef(false);

  const displayName = profile?.display_name || profile?.username || fallbackProfile.displayName;
  const username = profile?.username ?? fallbackProfile.username;
  const createdAt = profile?.created_at ?? currentUser?.created_at;
  const initial = displayName.slice(0, 1).toUpperCase() || "U";
  // PHASE 3 STEP 18C
  const visibleProfileError = profile ? "" : profileError;
  const visibleActionError = profile ? "" : actionError;
  // PHASE 5 STEP 1
  const rankInfo = getDisplayRankInfo(profile ? {
    trustScore: profile.trust_score,
    rankTitle: profile.rank_title,
    highestRankAchieved: profile.highest_rank_achieved,
  } : null);
  const rankProgress = getRankProgress(profile ? {
    trustScore: profile.trust_score,
  } : null);
  const badges = getTopBadges(profile?.badge_list ?? [], 8);
  const totalVotes = (profile?.correct_votes ?? 0) + (profile?.incorrect_votes ?? 0);
  const highestRank = profile?.highest_rank_achieved || rankInfo.title;

  const handleSignOut = async () => {
    await signOut();
    router.replace("/");
  };

  const handleCreateMissingProfile = async () => {
    if (!currentUser) {
      return;
    }

    setActionError("");
    setActionMessage("");
    const result = await ensureProfile();

    if (result.error) {
      setActionError(result.error);
      return;
    }

    setActionMessage(result.message ?? "Profile ready.");
  };

  // PHASE 3 STEP 28
  useEffect(() => {
    if (loading || !isAuthenticated || profile || profileAutoFixAttempted.current) {
      return;
    }

    profileAutoFixAttempted.current = true;
    void handleCreateMissingProfile();
  }, [isAuthenticated, loading, profile]);

  return (
    <SafeAreaView style={styles.container}>
      <Header title="Profile" subtitle="Your account overview" />
      <ScrollView contentContainerStyle={styles.content}>
        {loading ? (
          <View style={styles.card}>
            <Text style={styles.title}>Loading account...</Text>
            <Text style={styles.subtitle}>Please wait while FactLens checks your session.</Text>
          </View>
        ) : null}

        {!loading && !isAuthenticated ? (
          <View style={styles.card}>
            <Text style={styles.title}>No account signed in</Text>
            <Text style={styles.subtitle}>Log in or create an account to post verified news claims.</Text>
            <TouchableOpacity style={styles.button} activeOpacity={0.8} onPress={() => router.push("/auth")}>
              <Text style={styles.buttonText}>Log in or create account</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {!loading && isAuthenticated ? (
          <View style={styles.card}>
            <View style={styles.profileHeader}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{initial}</Text>
              </View>
              <View style={styles.identity}>
                <View style={styles.nameRow}>
                  <Text style={styles.displayName}>{displayName}</Text>
                  {isVerified ? <Text style={styles.verifiedBadge}>Email verified</Text> : null}
                </View>
                <Text style={styles.username}>@{username}</Text>
              </View>
            </View>

            {visibleProfileError ? <Text style={styles.errorText}>{visibleProfileError}</Text> : null}
            {visibleActionError ? <Text style={styles.errorText}>{visibleActionError}</Text> : null}
            {actionMessage ? <Text style={styles.messageText}>{actionMessage}</Text> : null}

            {!profile ? (
              <View style={styles.missingProfilePanel}>
                <Text style={styles.missingProfileTitle}>Profile missing</Text>
                <Text style={styles.subtitle}>
                  FactLens could not find your public profile row. Create it from your auth metadata.
                </Text>
                <TouchableOpacity style={styles.button} activeOpacity={0.8} onPress={handleCreateMissingProfile}>
                  <Text style={styles.buttonText}>Fix profile</Text>
                </TouchableOpacity>
              </View>
            ) : null}

            {profile ? (
              <View style={styles.rankPanel}>
                <View style={styles.rankHeaderRow}>
                  <View style={styles.rankIcon}>
                    <Text style={styles.rankIconText}>FL</Text>
                  </View>
                  <View style={styles.rankTextBlock}>
                    <Text style={styles.rankTitle}>{rankInfo.title}</Text>
                    <Text style={styles.rankSubtitle}>Your contributor rank</Text>
                  </View>
                </View>
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: `${Math.round(rankProgress.progress * 100)}%` }]} />
                </View>
                <Text style={styles.progressText}>
                  {rankProgress.nextTitle
                    ? `${Math.round(rankProgress.progress * 100)}% toward ${rankProgress.nextTitle}`
                    : "Top rank reached"}
                </Text>
                <Text style={styles.progressText}>Highest rank achieved: {highestRank}</Text>
              </View>
            ) : null}

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Email</Text>
              <Text style={styles.detailValue}>{fallbackProfile.email || "No email on account"}</Text>
            </View>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Username</Text>
              <Text style={styles.detailValue}>@{username}</Text>
            </View>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Email verification</Text>
              <Text style={[styles.detailValue, isVerified ? styles.successText : styles.warningText]}>
                {isVerified ? "Verified" : "Not verified"}
              </Text>
            </View>

            {profile ? (
              <>
                <View style={styles.statsGrid}>
                  <View style={styles.statBox}>
                    <Text style={styles.statLabel}>Reputation</Text>
                    <Text style={styles.statValue}>{formatPoints(profile.reputation_points)}</Text>
                    <Text style={styles.statHint}>This month: {formatPoints(profile.monthly_reputation_points)}</Text>
                  </View>
                  <View style={styles.statBox}>
                    <Text style={styles.statLabel}>Correct Votes</Text>
                    <Text style={styles.statValue}>
                      {profile.correct_votes}/{totalVotes || profile.votes_cast || 0}
                    </Text>
                  </View>
                  <View style={styles.statBox}>
                    <Text style={styles.statLabel}>Evidence Added</Text>
                    <Text style={styles.statValue}>{profile.evidence_count}</Text>
                  </View>
                  <View style={styles.statBox}>
                    <Text style={styles.statLabel}>Helpful Evidence</Text>
                    <Text style={styles.statValue}>{profile.helpful_evidence_count}</Text>
                  </View>
                </View>

                <View style={styles.badgeSection}>
                  <Text style={styles.detailLabel}>Badges earned</Text>
                  {badges.length > 0 ? (
                    <View style={styles.badgeWrap}>
                      {badges.map((badge) => (
                        <TouchableOpacity
                          key={badge.id}
                          style={styles.contributorBadge}
                          activeOpacity={0.8}
                          onPress={() => Alert.alert(badge.name, "Badge earned through FactLens contributions.")}
                        >
                          <Text style={styles.contributorBadgeText}>{badge.name}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  ) : (
                    <Text style={styles.detailValue}>No badges yet.</Text>
                  )}
                </View>
              </>
            ) : null}

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Account created</Text>
              <Text style={styles.detailValue}>{createdAt ? new Date(createdAt).toLocaleDateString() : "Unknown"}</Text>
            </View>

            <TouchableOpacity style={styles.signOutButton} activeOpacity={0.8} onPress={handleSignOut}>
              <Text style={styles.signOutButtonText}>Sign out</Text>
            </TouchableOpacity>
          </View>
        ) : null}
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
    padding: 10,
  },
  card: {
    backgroundColor: theme.colors.background,
    borderRadius: theme.radius.md,
    padding: 14,
    borderWidth: 0.5,
    borderColor: theme.colors.lightBorder,
  },
  title: {
    color: theme.colors.text,
    fontSize: theme.typography.title.fontSize,
    fontWeight: "500",
    marginBottom: theme.spacing.sm,
  },
  subtitle: {
    color: theme.colors.subtext,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: theme.spacing.md,
  },
  profileHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: theme.spacing.md,
    marginBottom: theme.spacing.lg,
  },
  avatar: {
    alignItems: "center",
    backgroundColor: theme.colors.phaseBg,
    borderRadius: 28,
    height: 56,
    justifyContent: "center",
    width: 56,
  },
  avatarText: {
    color: theme.colors.primary,
    fontSize: 24,
    fontWeight: "500",
  },
  identity: {
    flex: 1,
  },
  nameRow: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.xs,
  },
  displayName: {
    color: theme.colors.text,
    fontSize: theme.typography.title.fontSize,
    fontWeight: "500",
  },
  username: {
    color: theme.colors.subtext,
    fontSize: theme.typography.body.fontSize,
  },
  verifiedBadge: {
    backgroundColor: theme.colors.successBg,
    borderRadius: 999,
    color: theme.colors.success,
    fontSize: 11,
    fontWeight: "500",
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  missingProfilePanel: {
    backgroundColor: theme.colors.card,
    borderColor: theme.colors.lightBorder,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    marginBottom: theme.spacing.md,
    padding: theme.spacing.md,
  },
  missingProfileTitle: {
    color: theme.colors.text,
    fontSize: theme.typography.body.fontSize,
    fontWeight: "500",
    marginBottom: theme.spacing.sm,
  },
  detailRow: {
    borderTopColor: theme.colors.lightBorder,
    borderTopWidth: 0.5,
    paddingVertical: theme.spacing.md,
  },
  detailLabel: {
    color: theme.colors.subtext,
    fontSize: theme.typography.small.fontSize,
    fontWeight: "500",
    marginBottom: theme.spacing.xs,
  },
  detailValue: {
    color: theme.colors.text,
    fontSize: 14,
  },
  reputationBadge: {
    alignSelf: "flex-start",
    backgroundColor: theme.colors.navy,
    borderRadius: 999,
    color: theme.colors.background,
    fontSize: 18,
    fontWeight: "500",
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  // PHASE 5 STEP 1
  rankPanel: {
    backgroundColor: theme.colors.phaseBg,
    borderColor: "#DCD8FF",
    borderRadius: theme.radius.md,
    borderWidth: 1,
    marginBottom: theme.spacing.md,
    padding: theme.spacing.md,
  },
  rankHeaderRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  rankIcon: {
    alignItems: "center",
    backgroundColor: theme.colors.ai,
    borderRadius: 18,
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  rankIconText: {
    color: theme.colors.background,
    fontSize: 11,
    fontWeight: "700",
  },
  rankTextBlock: {
    flex: 1,
  },
  rankTitle: {
    color: theme.colors.text,
    fontSize: 20,
    fontWeight: "700",
  },
  rankSubtitle: {
    color: theme.colors.subtext,
    fontSize: 12,
    marginTop: 2,
  },
  progressTrack: {
    backgroundColor: "rgba(83, 74, 183, 0.18)",
    borderRadius: 999,
    height: 8,
    overflow: "hidden",
  },
  progressFill: {
    backgroundColor: theme.colors.ai,
    borderRadius: 999,
    height: "100%",
  },
  progressText: {
    color: theme.colors.subtext,
    fontSize: 12,
    marginTop: theme.spacing.sm,
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  statBox: {
    backgroundColor: theme.colors.card,
    borderColor: theme.colors.lightBorder,
    borderRadius: theme.radius.sm,
    borderWidth: 0.5,
    flexBasis: "48%",
    flexGrow: 1,
    padding: theme.spacing.md,
  },
  statLabel: {
    color: theme.colors.subtext,
    fontSize: 11,
    fontWeight: "600",
    marginBottom: theme.spacing.xs,
  },
  statValue: {
    color: theme.colors.text,
    fontSize: 18,
    fontWeight: "700",
  },
  statHint: {
    color: theme.colors.subtext,
    fontSize: 11,
    marginTop: 2,
  },
  badgeSection: {
    borderTopColor: theme.colors.lightBorder,
    borderTopWidth: 0.5,
    paddingVertical: theme.spacing.md,
  },
  badgeWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.sm,
  },
  contributorBadge: {
    backgroundColor: theme.colors.sourceBg,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  contributorBadgeText: {
    color: theme.colors.sourceText,
    fontSize: 11,
    fontWeight: "600",
  },
  successText: {
    color: theme.colors.success,
    fontWeight: "500",
  },
  warningText: {
    color: theme.colors.warning,
    fontWeight: "500",
  },
  errorText: {
    color: theme.colors.danger,
    fontSize: theme.typography.small.fontSize,
    fontWeight: "500",
    marginBottom: theme.spacing.md,
  },
  messageText: {
    color: theme.colors.success,
    fontSize: theme.typography.small.fontSize,
    fontWeight: "500",
    marginBottom: theme.spacing.md,
  },
  button: {
    alignItems: "center",
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.sm,
    paddingVertical: theme.spacing.md,
  },
  buttonText: {
    color: theme.colors.background,
    fontSize: theme.typography.body.fontSize,
    fontWeight: "500",
  },
  signOutButton: {
    alignItems: "center",
    borderColor: theme.colors.danger,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    marginTop: theme.spacing.md,
    paddingVertical: theme.spacing.md,
  },
  signOutButtonText: {
    color: theme.colors.danger,
    fontSize: theme.typography.body.fontSize,
    fontWeight: "500",
  },
});
