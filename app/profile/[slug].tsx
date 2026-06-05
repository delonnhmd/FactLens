// PHASE 5 STEP 1E
// PHASE 5 STEP 4
import { useEffect, useState } from "react";
import { Alert, Image, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Header } from "../../components/Header";
import { theme } from "../../constants/theme";
import { useAuth } from "../../context/AuthContext";
import { fetchPublicProfileBySlug, type PublicProfileCard } from "../../services/publicProfileService";
import { reportProfile } from "../../services/reportService";
import { formatPoints, getTopBadges } from "../../utils/reputation";

export default function PublicProfileScreen() {
  const router = useRouter();
  const { currentUser, isVerified } = useAuth();
  const params = useLocalSearchParams<{ slug?: string }>();
  const slug = Array.isArray(params.slug) ? params.slug[0] : params.slug;
  const [profile, setProfile] = useState<PublicProfileCard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError("");

    fetchPublicProfileBySlug(slug ?? "")
      .then((result) => {
        if (!mounted) {
          return;
        }

        setProfile(result.profile);
        setError(result.error ?? "");
      })
      .finally(() => {
        if (mounted) {
          setLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [slug]);

  const displayName = profile?.displayName || profile?.username || "Contributor";
  const initial = displayName.slice(0, 1).toUpperCase() || "U";
  const isDeleted = Boolean(profile?.isDeleted);
  const isPrivate = profile?.profileVisibility === "private" || isDeleted;
  const topBadges = getTopBadges(profile?.badgeList ?? [], 8);
  const canReportProfile = Boolean(profile && currentUser && currentUser.id !== profile.id);

  // PHASE 5 STEP 2
  const handleReportProfile = async () => {
    if (!profile || !currentUser) {
      return;
    }

    if (!isVerified) {
      Alert.alert("Verify your email to report profiles.");
      return;
    }

    const result = await reportProfile(profile.id, currentUser.id, "Harassment or abuse");

    if (result.error) {
      Alert.alert(result.error);
      return;
    }

    Alert.alert("Report submitted.");
  };

  return (
    <SafeAreaView style={styles.container}>
      <Header title="Contributor" subtitle="Public FactLens profile" />
      <ScrollView contentContainerStyle={styles.content}>
        <TouchableOpacity style={styles.backButton} activeOpacity={0.8} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={16} color={theme.colors.link} />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>

        {loading ? (
          <View style={styles.card}>
            <Text style={styles.title}>Loading profile...</Text>
          </View>
        ) : null}

        {!loading && error ? (
          <View style={styles.card}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {!loading && profile ? (
          <View style={styles.card}>
            <View style={styles.heroRow}>
              {profile.avatarUrl ? (
                <Image source={{ uri: profile.avatarUrl }} style={styles.avatarImage} />
              ) : (
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{initial}</Text>
                </View>
              )}
              <View style={styles.identity}>
                <Text style={styles.title}>{displayName}</Text>
                {isDeleted ? (
                  <Text style={styles.username}>Account deleted</Text>
                ) : (
                  <Text style={styles.username}>@{profile.username}</Text>
                )}
                {!isDeleted ? <Text style={styles.rankPill}>{profile.rankTitle}</Text> : null}
              </View>
            </View>

            {profile.bio ? <Text style={styles.bio}>{profile.bio}</Text> : null}

            {isDeleted ? (
              <Text style={styles.privateNote}>This account was deleted. Public profile details are no longer shown.</Text>
            ) : isPrivate ? (
              <Text style={styles.privateNote}>This contributor keeps detailed profile stats private.</Text>
            ) : (
              <>
                <View style={styles.statsGrid}>
                  <View style={styles.statBox}>
                    <Text style={styles.statLabel}>Reputation</Text>
                    <Text style={styles.statValue}>{formatPoints(profile.reputationPoints)}</Text>
                  </View>
                  <View style={styles.statBox}>
                    <Text style={styles.statLabel}>This month</Text>
                    <Text style={styles.statValue}>{formatPoints(profile.monthlyReputationPoints)}</Text>
                  </View>
                  <View style={styles.statBox}>
                    <Text style={styles.statLabel}>Evidence</Text>
                    <Text style={styles.statValue}>{profile.evidenceCount}</Text>
                  </View>
                  <View style={styles.statBox}>
                    <Text style={styles.statLabel}>Correct votes</Text>
                    <Text style={styles.statValue}>{profile.correctVotes}</Text>
                  </View>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Highest rank achieved</Text>
                  <Text style={styles.detailValue}>{profile.highestRankAchieved}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Joined</Text>
                  <Text style={styles.detailValue}>
                    {profile.createdAt ? new Date(profile.createdAt).toLocaleDateString() : "Unknown"}
                  </Text>
                </View>
              </>
            )}

            <View style={styles.badgeSection}>
              <Text style={styles.detailLabel}>Badges</Text>
              {topBadges.length > 0 ? (
                <View style={styles.badgeWrap}>
                  {topBadges.map((badge) => (
                    <Text key={badge.id} style={styles.badge}>
                      {badge.name}
                    </Text>
                  ))}
                </View>
              ) : (
                <Text style={styles.detailValue}>No badges yet.</Text>
              )}
            </View>

            {canReportProfile ? (
              <TouchableOpacity style={styles.reportButton} activeOpacity={0.8} onPress={handleReportProfile}>
                <Ionicons name="flag-outline" size={14} color={theme.colors.danger} />
                <Text style={styles.reportButtonText}>Report Profile</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}
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
    fontWeight: "600",
  },
  card: {
    backgroundColor: theme.colors.background,
    borderColor: theme.colors.lightBorder,
    borderRadius: theme.radius.md,
    borderWidth: 0.5,
    padding: 14,
  },
  heroRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  avatar: {
    alignItems: "center",
    backgroundColor: theme.colors.phaseBg,
    borderRadius: 28,
    height: 56,
    justifyContent: "center",
    width: 56,
  },
  avatarImage: {
    borderRadius: 28,
    height: 56,
    width: 56,
  },
  avatarText: {
    color: theme.colors.primary,
    fontSize: 24,
    fontWeight: "700",
  },
  identity: {
    flex: 1,
  },
  title: {
    color: theme.colors.text,
    fontSize: 22,
    fontWeight: "700",
  },
  username: {
    color: theme.colors.subtext,
    fontSize: 14,
    marginTop: 2,
  },
  rankPill: {
    alignSelf: "flex-start",
    backgroundColor: theme.colors.phaseBg,
    borderRadius: 999,
    color: theme.colors.ai,
    fontSize: 12,
    fontWeight: "700",
    marginTop: 8,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  bio: {
    color: theme.colors.text,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: theme.spacing.md,
  },
  privateNote: {
    color: theme.colors.subtext,
    fontSize: 13,
    lineHeight: 19,
    marginBottom: theme.spacing.md,
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
    marginBottom: 4,
  },
  statValue: {
    color: theme.colors.text,
    fontSize: 18,
    fontWeight: "700",
  },
  detailRow: {
    borderTopColor: theme.colors.lightBorder,
    borderTopWidth: 0.5,
    paddingVertical: theme.spacing.md,
  },
  detailLabel: {
    color: theme.colors.subtext,
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 5,
  },
  detailValue: {
    color: theme.colors.text,
    fontSize: 14,
  },
  badgeSection: {
    borderTopColor: theme.colors.lightBorder,
    borderTopWidth: 0.5,
    paddingTop: theme.spacing.md,
  },
  badgeWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.sm,
  },
  badge: {
    backgroundColor: theme.colors.sourceBg,
    borderRadius: 999,
    color: theme.colors.sourceText,
    fontSize: 11,
    fontWeight: "700",
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  errorText: {
    color: theme.colors.danger,
    fontSize: 14,
    fontWeight: "600",
  },
  reportButton: {
    alignItems: "center",
    alignSelf: "flex-start",
    flexDirection: "row",
    gap: 6,
    marginTop: theme.spacing.md,
    paddingVertical: 6,
  },
  reportButtonText: {
    color: theme.colors.danger,
    fontSize: 13,
    fontWeight: "700",
  },
});
