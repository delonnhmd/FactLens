// PHASE 5 STEP 1E
// PHASE 5 STEP 4
import { useEffect, useState } from "react";
import { Alert, Image, Linking, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Header } from "../../components/Header";
import { theme } from "../../constants/theme";
import { useAuth } from "../../context/AuthContext";
import { fetchPublicProfileBySlug, type PublicProfileCard } from "../../services/publicProfileService";
import { reportProfile } from "../../services/reportService";
import { formatPoints, getTopBadges } from "../../utils/reputation";
import { cleanUserError } from "../../utils/debugError";
import {
  fetchPublicProfileActivity,
  type PublicProfileActivityType,
  type PublicProfileEvidenceActivity,
  type PublicProfilePostActivity,
  type PublicProfileReplyActivity,
} from "../../services/profileActivityService";

type PublicProfileTab = PublicProfileActivityType | "about";

const profileTabs: Array<{ label: string; value: PublicProfileTab }> = [
  { label: "Posts", value: "posts" },
  { label: "Replies", value: "replies" },
  { label: "Evidence", value: "evidence" },
  { label: "About", value: "about" },
];

export default function PublicProfileScreen() {
  const router = useRouter();
  const { currentUser, isVerified } = useAuth();
  const params = useLocalSearchParams<{ slug?: string; userId?: string; username?: string }>();
  const slug = Array.isArray(params.slug) ? params.slug[0] : params.slug;
  const userId = Array.isArray(params.userId) ? params.userId[0] : params.userId;
  const username = Array.isArray(params.username) ? params.username[0] : params.username;
  const queryIdentifier = userId || slug || username || "";
  const paramsDebug = JSON.stringify({ slug, userId, username });
  const [profile, setProfile] = useState<PublicProfileCard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [fetchStatus, setFetchStatus] = useState<404 | 500 | null>(null);
  const [fetchReason, setFetchReason] = useState<"not_found" | "network" | "server_error" | null>(null);
  const [retryNonce, setRetryNonce] = useState(0);
  const [avatarLoadFailed, setAvatarLoadFailed] = useState(false);
  const [activeTab, setActiveTab] = useState<PublicProfileTab>("posts");
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityError, setActivityError] = useState("");
  const [posts, setPosts] = useState<PublicProfilePostActivity[]>([]);
  const [replies, setReplies] = useState<PublicProfileReplyActivity[]>([]);
  const [evidence, setEvidence] = useState<PublicProfileEvidenceActivity[]>([]);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError("");
    setFetchStatus(null);
    setFetchReason(null);
    setProfile(null);

    console.log("=== CONTRIBUTOR PAGE DEBUG ===");
    console.log("Route params received:", paramsDebug);
    console.log("Current user:", currentUser?.id);
    console.log("Querying profiles with:", queryIdentifier);

    fetchPublicProfileBySlug(queryIdentifier, { userId, username })
      .then((result) => {
        if (!mounted) {
          return;
        }

        setProfile(result.profile);
        setFetchStatus(result.status ?? null);
        setFetchReason(result.reason ?? null);
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
  }, [currentUser?.id, paramsDebug, queryIdentifier, retryNonce, userId, username]);

  const displayName = profile?.displayName || profile?.username || "Contributor";
  const initial = displayName.slice(0, 1).toUpperCase() || "U";
  const isDeleted = Boolean(profile?.isDeleted);
  const isPrivate = profile?.profileVisibility === "private" || isDeleted;
  const topBadges = getTopBadges(profile?.badgeList ?? [], 8);
  const canReportProfile = Boolean(profile && currentUser && currentUser.id !== profile.id);
  const showAvatarImage = Boolean(profile?.avatarUrl && !avatarLoadFailed);

  useEffect(() => {
    setAvatarLoadFailed(false);
  }, [profile?.avatarUrl]);

  useEffect(() => {
    if (!profile || activeTab === "about" || profile.isDeleted) {
      return;
    }

    let mounted = true;
    setActivityLoading(true);
    setActivityError("");
    const identifier = profile.publicProfileSlug || profile.username || profile.id;

    fetchPublicProfileActivity(identifier, activeTab).then((result) => {
      if (!mounted) return;
      setPosts(result.posts);
      setReplies(result.replies);
      setEvidence(result.evidence);
      setActivityError(result.error ?? "");
      setActivityLoading(false);
    });

    return () => {
      mounted = false;
    };
  }, [activeTab, profile]);

  const formatVerdict = (verdict: PublicProfilePostActivity["finalVerdict"]) => {
    if (verdict === "TRUE") return "Community says True";
    if (verdict === "FAKE") return "Community says Fake";
    if (verdict === "NEEDS_MORE_EVIDENCE") return "Needs more evidence";
    return "Verdict pending";
  };

  const formatEvidenceType = (value: string) => {
    if (value === "SUPPORTS_TRUE") return "Supports true";
    if (value === "SUPPORTS_FAKE") return "Supports fake";
    if (value === "ADDS_CONTEXT") return "Adds context";
    return "Unclear";
  };

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
      Alert.alert(cleanUserError(result.error));
      return;
    }

    Alert.alert("Report submitted.");
  };

  return (
    <SafeAreaView style={styles.container}>
      <Header title="Contributor" subtitle="Public Verifact profile" />
      <ScrollView contentContainerStyle={styles.content}>
        <TouchableOpacity style={styles.backButton} activeOpacity={0.8} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={16} color={theme.colors.link} />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>

        {loading ? (
          <View style={styles.card}>
            <Text style={styles.title}>Loading contributor profile...</Text>
          </View>
        ) : null}

        {!loading && error ? (
          <View style={styles.card}>
            <Text style={styles.errorTitle}>
              {fetchStatus === 404 ? "Contributor profile unavailable" : "Could not load profile"}
            </Text>
            <Text style={styles.errorSubtext}>
              {fetchStatus === 404
                ? "This profile may have been removed or is not available."
                : fetchReason === "network"
                  ? "Could not connect. Check your internet and try again."
                  : "Please try again."}
            </Text>
            <TouchableOpacity
              style={styles.errorActionButton}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel={fetchStatus === 404 ? "Back to leaderboard" : "Try again"}
              onPress={() => {
                if (fetchStatus === 404) {
                  router.back();
                  return;
                }

                setRetryNonce((value) => value + 1);
              }}
            >
              <Text style={styles.errorActionText}>
                {fetchStatus === 404 ? "Back to leaderboard" : "Try again"}
              </Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {!loading && profile ? (
          <View style={styles.card}>
            <View style={styles.heroRow}>
              {showAvatarImage && profile.avatarUrl ? (
                <Image
                  source={{ uri: profile.avatarUrl }}
                  style={styles.avatarImage}
                  onError={() => setAvatarLoadFailed(true)}
                />
              ) : (
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{initial}</Text>
                </View>
              )}
              <View style={styles.identity}>
                <Text style={styles.title} numberOfLines={1}>
                  {displayName}
                </Text>
                {isDeleted ? (
                  <Text style={styles.username}>Account deleted</Text>
                ) : (
                  <Text style={styles.username} numberOfLines={1}>
                    @{profile.username}
                  </Text>
                )}
                {!isDeleted ? <Text style={styles.rankPill}>{profile.rankTitle}</Text> : null}
              </View>
            </View>

            <View style={styles.tabRow} accessibilityRole="tablist">
              {profileTabs.map((tab) => {
                const selected = activeTab === tab.value;
                return (
                  <TouchableOpacity
                    key={tab.value}
                    style={[styles.tabButton, selected && styles.tabButtonSelected]}
                    activeOpacity={0.8}
                    onPress={() => setActiveTab(tab.value)}
                    accessibilityRole="tab"
                    accessibilityState={{ selected }}
                  >
                    <Text style={[styles.tabText, selected && styles.tabTextSelected]}>{tab.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {activeTab === "about" ? (
              <View style={styles.tabContent}>
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
                        <Text style={styles.statLabel}>Posts</Text>
                        <Text style={styles.statValue}>{profile.claimsCount}</Text>
                      </View>
                      <View style={styles.statBox}>
                        <Text style={styles.statLabel}>Replies</Text>
                        <Text style={styles.statValue}>{profile.repliesCount}</Text>
                      </View>
                      <View style={styles.statBox}>
                        <Text style={styles.statLabel}>Evidence</Text>
                        <Text style={styles.statValue}>{profile.evidenceCount}</Text>
                      </View>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Voting activity</Text>
                      <Text style={styles.detailValue}>
                        {profile.totalVotes} total · {profile.finalizedVotes} finalized · {profile.accuracyPercentage === null ? "Accuracy unavailable" : `${profile.accuracyPercentage}% accuracy`}
                      </Text>
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
                      {topBadges.map((badge) => {
                        const isAdminBadge = badge.id === "admin" || badge.name.toLowerCase() === "admin";
                        return (
                          <Text key={badge.id} style={[styles.badge, isAdminBadge && styles.badgeAdmin]}>
                            {badge.name}
                          </Text>
                        );
                      })}
                    </View>
                  ) : (
                    <Text style={styles.detailValue}>No badges yet.</Text>
                  )}
                </View>
              </View>
            ) : null}

            {activeTab !== "about" ? (
              <View style={styles.tabContent}>
                {activityLoading ? <Text style={styles.activityMessage}>Loading {activeTab}...</Text> : null}
                {!activityLoading && activityError ? <Text style={styles.errorText}>{activityError}</Text> : null}

                {!activityLoading && !activityError && activeTab === "posts" && posts.length === 0 ? <Text style={styles.activityMessage}>No public posts yet.</Text> : null}
                {!activityLoading && !activityError && activeTab === "posts" ? posts.map((post) => (
                  <TouchableOpacity key={post.id} style={styles.activityCard} activeOpacity={0.85} onPress={() => router.push(`/claim/${post.id}`)}>
                    {post.thumbnailUrl || post.imageUrl ? <Image source={{ uri: post.thumbnailUrl || post.imageUrl || "" }} style={styles.activityImage} /> : null}
                    <Text style={styles.activityTitle}>{post.title}</Text>
                    {post.descriptionPreview ? <Text style={styles.activityBody} numberOfLines={3}>{post.descriptionPreview}</Text> : null}
                    <Text style={styles.activityMeta}>{post.category || "Claim"} · {post.status ? post.status.replace(/_/g, " ").toLowerCase() : "Status unavailable"} · {formatVerdict(post.finalVerdict)}</Text>
                    <Text style={styles.activityMeta}>{post.totalVotes} votes · {post.createdAt ? new Date(post.createdAt).toLocaleDateString() : "Date unavailable"}</Text>
                  </TouchableOpacity>
                )) : null}

                {!activityLoading && !activityError && activeTab === "replies" && replies.length === 0 ? <Text style={styles.activityMessage}>No public replies yet.</Text> : null}
                {!activityLoading && !activityError && activeTab === "replies" ? replies.map((reply) => (
                  <TouchableOpacity key={reply.id} style={styles.activityCard} activeOpacity={0.85} onPress={() => router.push(`/claim/${reply.claimId}`)}>
                    <Text style={styles.activityBody}>{reply.text}</Text>
                    <Text style={styles.activityLink}>On: {reply.claimTitle}</Text>
                    <Text style={styles.activityMeta}>{reply.createdAt ? new Date(reply.createdAt).toLocaleDateString() : "Date unavailable"}{reply.replyCount > 0 ? ` · ${reply.replyCount} replies` : ""}{reply.helpfulCount > 0 ? ` · ${reply.helpfulCount} helpful` : ""}</Text>
                  </TouchableOpacity>
                )) : null}

                {!activityLoading && !activityError && activeTab === "evidence" && evidence.length === 0 ? <Text style={styles.activityMessage}>No public approved evidence yet.</Text> : null}
                {!activityLoading && !activityError && activeTab === "evidence" ? evidence.map((item) => (
                  <View key={item.id} style={styles.activityCard}>
                    <Text style={styles.evidenceType}>{formatEvidenceType(item.evidenceType)}</Text>
                    {item.thumbnailUrl || item.imageUrl ? <Image source={{ uri: item.thumbnailUrl || item.imageUrl || "" }} style={styles.activityImage} /> : null}
                    {item.note ? <Text style={styles.activityBody}>{item.note}</Text> : null}
                    <TouchableOpacity activeOpacity={0.8} onPress={() => router.push(`/claim/${item.claimId}`)}><Text style={styles.activityLink}>For: {item.claimTitle}</Text></TouchableOpacity>
                    <Text style={styles.activityMeta}>{item.createdAt ? new Date(item.createdAt).toLocaleDateString() : "Date unavailable"}{item.helpfulCount > 0 ? ` · ${item.helpfulCount} helpful` : ""}</Text>
                    {item.sourceUrl ? <TouchableOpacity activeOpacity={0.8} onPress={() => Linking.openURL(item.sourceUrl || "")}><Text style={styles.activityLink}>{item.sourceDomain || "Open source"}</Text></TouchableOpacity> : null}
                  </View>
                )) : null}
              </View>
            ) : null}

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
    fontWeight: "500",
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
    fontWeight: "500",
  },
  identity: {
    flex: 1,
  },
  title: {
    color: theme.colors.text,
    flexShrink: 1,
    fontSize: 22,
    fontWeight: "500",
  },
  username: {
    color: theme.colors.subtext,
    flexShrink: 1,
    fontSize: 14,
    marginTop: 2,
  },
  rankPill: {
    alignSelf: "flex-start",
    backgroundColor: theme.colors.phaseBg,
    borderRadius: 999,
    color: theme.colors.ai,
    fontSize: 12,
    fontWeight: "500",
    marginTop: 8,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  tabRow: {
    backgroundColor: theme.colors.card,
    borderColor: theme.colors.lightBorder,
    borderRadius: theme.radius.sm,
    borderWidth: 0.5,
    flexDirection: "row",
    marginBottom: theme.spacing.md,
    padding: 3,
  },
  tabButton: {
    alignItems: "center",
    borderRadius: 8,
    flex: 1,
    minHeight: 42,
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  tabButtonSelected: {
    backgroundColor: theme.colors.primary,
  },
  tabText: {
    color: theme.colors.subtext,
    fontSize: 12,
    fontWeight: "500",
  },
  tabTextSelected: {
    color: "#FFFFFF",
  },
  tabContent: {
    gap: theme.spacing.sm,
  },
  activityMessage: {
    color: theme.colors.subtext,
    fontSize: 14,
    lineHeight: 20,
    paddingVertical: theme.spacing.lg,
    textAlign: "center",
  },
  activityCard: {
    backgroundColor: theme.colors.card,
    borderColor: theme.colors.lightBorder,
    borderRadius: theme.radius.sm,
    borderWidth: 0.5,
    gap: 8,
    padding: theme.spacing.md,
  },
  activityImage: {
    borderRadius: theme.radius.sm,
    height: 160,
    width: "100%",
  },
  activityTitle: {
    color: theme.colors.text,
    fontSize: 17,
    fontWeight: "500",
    lineHeight: 23,
  },
  activityBody: {
    color: theme.colors.text,
    fontSize: 14,
    lineHeight: 20,
  },
  activityMeta: {
    color: theme.colors.subtext,
    fontSize: 12,
    lineHeight: 17,
  },
  activityLink: {
    color: theme.colors.link,
    fontSize: 13,
    fontWeight: "500",
    lineHeight: 18,
  },
  evidenceType: {
    alignSelf: "flex-start",
    backgroundColor: theme.colors.primary,
    borderRadius: 999,
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "500",
    paddingHorizontal: 9,
    paddingVertical: 5,
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
    fontWeight: "500",
    marginBottom: 4,
  },
  statValue: {
    color: theme.colors.text,
    fontSize: 18,
    fontWeight: "500",
  },
  detailRow: {
    borderTopColor: theme.colors.lightBorder,
    borderTopWidth: 0.5,
    paddingVertical: theme.spacing.md,
  },
  detailLabel: {
    color: theme.colors.subtext,
    fontSize: 12,
    fontWeight: "500",
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
    fontWeight: "500",
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  // TASK 2 (admin badge) — red Admin pill (danger tint; this screen uses the
  // static theme, which has no chipActiveText token).
  badgeAdmin: {
    backgroundColor: theme.colors.dangerBg,
    color: theme.colors.danger,
    fontWeight: "700",
    overflow: "hidden",
  },
  errorText: {
    color: theme.colors.danger,
    fontSize: 14,
    fontWeight: "500",
  },
  errorTitle: {
    color: theme.colors.text,
    fontSize: 18,
    fontWeight: "500",
    marginBottom: 6,
  },
  errorSubtext: {
    color: theme.colors.subtext,
    fontSize: 13,
    lineHeight: 19,
    marginBottom: theme.spacing.md,
  },
  errorActionButton: {
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.sm,
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: 10,
  },
  errorActionText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "500",
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
    fontWeight: "500",
  },
});
