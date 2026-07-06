// Public user profile with the contributor's claims.
// Reuses: publicProfileService (rank logic shared with the own-profile
// screen via utils/reputation), ClaimCard, the ClaimsContext vote/report/
// block flows, and the fetchClaimsByAuthorPage pagination pattern
// (20 per page, newest first). Claims are fetched with the normal client so
// RLS applies: hidden claims and blocked authors are filtered automatically.
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { ClaimCard } from "../../components/ClaimCard";
import { Header } from "../../components/Header";
import { theme } from "../../constants/theme";
import { useAuth } from "../../context/AuthContext";
import { useClaims } from "../../context/ClaimsContext";
import { fetchClaimsByAuthorPage } from "../../services/claimService";
import { fetchPublicProfileBySlug, type PublicProfileCard } from "../../services/publicProfileService";
import type { Claim } from "../../types/claim";

const CLAIMS_PAGE_SIZE = 20;

export default function PublicUserScreen() {
  const router = useRouter();
  const { currentUser } = useAuth();
  const { voteOnClaim, reportClaim, blockUser } = useClaims();
  const params = useLocalSearchParams<{ id?: string }>();
  const userId = Array.isArray(params.id) ? params.id[0] : params.id;

  const [profile, setProfile] = useState<PublicProfileCard | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileError, setProfileError] = useState("");
  const [claims, setClaims] = useState<Claim[]>([]);
  const [claimsLoading, setClaimsLoading] = useState(true);
  const [claimsLoadingMore, setClaimsLoadingMore] = useState(false);
  const [claimsError, setClaimsError] = useState("");
  const [hasMoreClaims, setHasMoreClaims] = useState(true);

  const isAnonymous = Boolean(profile?.isDeleted);
  const isOwnProfile = Boolean(currentUser && userId && currentUser.id === userId);
  const displayName = isAnonymous ? "Anonymous" : profile?.displayName || profile?.username || "Contributor";
  const avatarInitial = displayName.slice(0, 1).toUpperCase() || "U";

  useEffect(() => {
    if (!userId) {
      setProfileLoading(false);
      setProfileError("Contributor not found.");
      return;
    }

    let mounted = true;
    setProfileLoading(true);
    setProfileError("");

    fetchPublicProfileBySlug(userId, { userId })
      .then((result) => {
        if (!mounted) {
          return;
        }

        setProfile(result.profile);
        setProfileError(result.profile ? "" : result.error || "Could not load this profile.");
      })
      .finally(() => {
        if (mounted) {
          setProfileLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [userId]);

  const loadClaims = useCallback(
    async (offset: number) => {
      if (!userId) {
        return;
      }

      if (offset === 0) {
        setClaimsLoading(true);
      } else {
        setClaimsLoadingMore(true);
      }

      setClaimsError("");

      const result = await fetchClaimsByAuthorPage(userId, CLAIMS_PAGE_SIZE, offset);

      if (result.error) {
        setClaimsError("Could not load claims right now.");
      } else {
        setClaims((previous) => (offset === 0 ? result.claims : [...previous, ...result.claims]));
        setHasMoreClaims(result.claims.length === CLAIMS_PAGE_SIZE);
      }

      setClaimsLoading(false);
      setClaimsLoadingMore(false);
    },
    [userId],
  );

  useEffect(() => {
    void loadClaims(0);
  }, [loadClaims]);

  const handleEndReached = useCallback(() => {
    if (!claimsLoading && !claimsLoadingMore && hasMoreClaims) {
      void loadClaims(claims.length);
    }
  }, [claims.length, claimsLoading, claimsLoadingMore, hasMoreClaims, loadClaims]);

  // Reuses the existing block flow (ClaimsContext.blockUser) with the same
  // confirmation copy as the claim card menu. Hidden when viewing yourself.
  const handleHeaderMenu = useCallback(() => {
    if (!profile || isOwnProfile || isAnonymous || !currentUser) {
      return;
    }

    Alert.alert("Profile options", undefined, [
      {
        text: `Block @${profile.username}`,
        style: "destructive",
        onPress: () => {
          Alert.alert(
            `Block @${profile.username}?`,
            "You won't see their claims anymore. This also notifies Verifact moderation.",
            [
              { text: "Cancel", style: "cancel" },
              {
                text: "Block",
                style: "destructive",
                onPress: () => {
                  blockUser(profile.id)
                    .then(() => Alert.alert("User blocked."))
                    .catch(() => Alert.alert("Could not block this user right now."));
                },
              },
            ],
          );
        },
      },
      { text: "Cancel", style: "cancel" },
    ]);
  }, [blockUser, currentUser, isAnonymous, isOwnProfile, profile]);

  const showHeaderMenu = Boolean(profile && currentUser && !isOwnProfile && !isAnonymous);

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

      {profileLoading ? (
        <View style={styles.card}>
          <Text style={styles.loadingText}>Loading profile...</Text>
        </View>
      ) : profileError ? (
        <View style={styles.card}>
          <Text style={styles.errorText}>{profileError}</Text>
        </View>
      ) : profile ? (
        <View style={styles.card}>
          <View style={styles.heroRow}>
            {!isAnonymous && profile.avatarUrl ? (
              <Image source={{ uri: profile.avatarUrl }} style={styles.avatarImage} />
            ) : (
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{avatarInitial}</Text>
              </View>
            )}
            <View style={styles.identity}>
              <Text style={styles.title} numberOfLines={1}>
                {displayName}
              </Text>
              {!isAnonymous ? (
                <Text style={styles.username} numberOfLines={1}>
                  @{profile.username}
                </Text>
              ) : null}
              {!isAnonymous ? <Text style={styles.rankPill}>{profile.rankTitle}</Text> : null}
            </View>
            {showHeaderMenu ? (
              <TouchableOpacity
                style={styles.menuButton}
                activeOpacity={0.8}
                onPress={handleHeaderMenu}
                accessibilityRole="button"
                accessibilityLabel="Profile options"
              >
                <Ionicons name="ellipsis-horizontal" size={18} color={theme.colors.subtext} />
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      ) : null}

      <Text style={styles.sectionTitle}>Claims</Text>
      {claimsError ? <Text style={styles.errorText}>{claimsError}</Text> : null}
      {!claimsLoading && !claimsError && claims.length === 0 ? (
        <Text style={styles.emptyText}>No claims yet.</Text>
      ) : null}
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <Header title="Contributor" subtitle="Public Verifact profile" />
      <FlatList
        data={claims}
        keyExtractor={(item) => item.id}
        renderItem={renderClaim}
        ListHeaderComponent={listHeader}
        ListFooterComponent={
          claimsLoading || claimsLoadingMore ? (
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
  card: {
    backgroundColor: theme.colors.background,
    borderColor: theme.colors.lightBorder,
    borderRadius: theme.radius.md,
    borderWidth: 0.5,
    marginBottom: 12,
    padding: 14,
  },
  heroRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: theme.spacing.md,
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
  menuButton: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
    minWidth: 44,
  },
  sectionTitle: {
    color: theme.colors.subtext,
    fontSize: 12,
    fontWeight: "500",
    marginBottom: 8,
    textTransform: "uppercase",
  },
  loadingText: {
    color: theme.colors.subtext,
    fontSize: 14,
  },
  emptyText: {
    color: theme.colors.subtext,
    fontSize: 13,
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
