// PHASE 1 STEP 4
// PHASE 3 STEP 27
// PHASE 3 STEP 28
// PHASE 4 STEP 27
// PHASE 5 STEP 4
// PHASE 5 STEP 6
import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Image, Linking, View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity, TextInput } from "react-native";
import { useRouter } from "expo-router";
import { Header } from "../../components/Header";
import { PUBLIC_SITE_URL, SUPPORT_EMAIL } from "../../constants/launchConfig";
import { useAuth } from "../../context/AuthContext";
import { useScrollAwareTabBar } from "../../context/TabBarVisibilityContext";
import type { AppTheme } from "../../context/DisplaySettingsContext";
import { useAppTheme } from "../../hooks/useTheme";
import { getAuthProfile } from "../../services/authProfile";
import { deleteCurrentAccount } from "../../services/accountService";
import { fetchReputationEvents, type ReputationEvent } from "../../services/reputationEventService";
import {
  checkUsernameAvailability,
  getUsernameAvailabilityDisplay,
  updateProfile,
  USERNAME_TAKEN_MESSAGE,
  type UsernameAvailabilityTone,
} from "../../services/profileService";
import { fetchUserVotingActivity, type UserVotingActivity } from "../../services/voteService";
import { formatPoints, getDisplayRankInfo, getRankProgress, getTopBadges } from "../../utils/reputation";
import { cleanUserError } from "../../utils/debugError";
import { getUsernameValidationError } from "../../utils/username";
import {
  formatImageSize,
  pickImageFromCamera,
  pickImageFromLibrary,
  uploadProfileAvatar,
  type PickedOptimizedImage,
} from "../../services/imageUploadService";
// TASK 2 + TASK 3 — admin moderation queues (Reported + Hidden claims). Rows
// reuse the EXISTING hide/unhide/delete endpoints; these only add read lists.
import {
  deleteClaimAsAdmin,
  fetchHiddenClaims,
  fetchReportedClaims,
  hideClaimFromFeeds,
  unhideClaim,
  type HiddenClaim,
  type ReportedClaim,
} from "../../services/moderationService";

// Reason attached to a hide triggered from the reported-claims queue.
const REPORTED_HIDE_REASON = "Reported content violation";

// TEMPORARY: the admin "Delete" action in the Reported/Hidden claim queues is
// non-functional (tapping it flickers and does nothing), so it is hidden until
// the underlying delete is fixed. The handler (handleDeleteClaim /
// deleteClaimAsAdmin) is left intact — flip this to true to re-enable it.
// Hide/Unhide are unaffected.
const ADMIN_DELETE_ENABLED = false;

type UsernameAvailabilityStatus = "idle" | "checking" | "available" | "unavailable" | "invalid";

export default function ProfileScreen() {
  // PHASE 3 STEP 2
  const router = useRouter();
  const appTheme = useAppTheme();
  const styles = useMemo(() => createStyles(appTheme), [appTheme]);
  const { contentBottomPadding, handleScroll } = useScrollAwareTabBar();
  const contentContainerStyle = useMemo(
    () => [styles.content, { paddingBottom: contentBottomPadding }],
    [contentBottomPadding, styles.content],
  );
  const {
    currentUser,
    profile,
    profileError,
    isAuthenticated,
    isVerified,
    loading,
    signOut,
    ensureProfile,
    refreshProfile,
  } = useAuth();
  const fallbackProfile = getAuthProfile(currentUser);
  const [actionMessage, setActionMessage] = useState("");
  const [actionError, setActionError] = useState("");
  const [reputationEvents, setReputationEvents] = useState<ReputationEvent[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityError, setActivityError] = useState("");
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [usernameDraft, setUsernameDraft] = useState("");
  const [usernameSaving, setUsernameSaving] = useState(false);
  const [usernameAvailabilityStatus, setUsernameAvailabilityStatus] = useState<UsernameAvailabilityStatus>("idle");
  const [usernameAvailabilityMessage, setUsernameAvailabilityMessage] = useState("");
  // PHASE 5 PRE-LAUNCH: availability message color (gray / amber / red / green).
  const [usernameAvailabilityTone, setUsernameAvailabilityTone] = useState<UsernameAvailabilityTone | null>(null);
  // PHASE 5 PRE-LAUNCH: voting activity stats (replaces the reputation activity error).
  const [votingActivity, setVotingActivity] = useState<UserVotingActivity | null>(null);
  // PHASE 5 STEP 6
  const [selectedAvatar, setSelectedAvatar] = useState<PickedOptimizedImage | null>(null);
  const [avatarSaving, setAvatarSaving] = useState(false);
  const [avatarError, setAvatarError] = useState("");
  const [avatarLoadFailed, setAvatarLoadFailed] = useState(false);
  const profileAutoFixAttempted = useRef(false);
  // TASK 2 + TASK 3 — admin moderation queues.
  const isAdmin = Boolean(profile?.is_admin);
  const [reportedClaims, setReportedClaims] = useState<ReportedClaim[]>([]);
  const [hiddenClaims, setHiddenClaims] = useState<HiddenClaim[]>([]);
  const [queueLoading, setQueueLoading] = useState(false);
  const [queueMessage, setQueueMessage] = useState("");
  const [queueBusyId, setQueueBusyId] = useState<string | null>(null);
  const [expandedClaimIds, setExpandedClaimIds] = useState<Record<string, boolean>>({});

  const displayName = profile?.display_name || profile?.username || fallbackProfile.displayName;
  const username = profile?.username ?? fallbackProfile.username;
  const createdAt = profile?.created_at ?? currentUser?.created_at;
  const initial = displayName.slice(0, 1).toUpperCase() || "U";
  // PHASE 3 STEP 18C
  const visibleProfileError = profile ? "" : profileError;
  const visibleActionError = profile ? "" : actionError;
  const profileBlockedByUsername =
    !profile &&
    (visibleProfileError === USERNAME_TAKEN_MESSAGE ||
      visibleActionError === USERNAME_TAKEN_MESSAGE ||
      visibleProfileError === "Username is not available" ||
      visibleActionError === "Username is not available");
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
  const avatarPreviewUri = selectedAvatar?.uri || profile?.avatar_url || null;
  const showAvatarImage = Boolean(avatarPreviewUri && !avatarLoadFailed);
  // PHASE 5 PRE-LAUNCH: typed username matches the current one (nothing to save).
  const isSameAsCurrentUsername =
    usernameDraft.trim().length > 0 &&
    usernameDraft.toLowerCase().trim() === (username ?? "").toLowerCase().trim();
  const usernameSaveDisabled =
    usernameSaving ||
    !usernameDraft.trim() ||
    isSameAsCurrentUsername ||
    usernameAvailabilityStatus === "checking" ||
    usernameAvailabilityStatus === "unavailable" ||
    usernameAvailabilityStatus === "invalid";

  useEffect(() => {
    setAvatarLoadFailed(false);
  }, [avatarPreviewUri]);

  useEffect(() => {
    if (!profile || !currentUser || !usernameDraft.trim()) {
      setUsernameAvailabilityStatus("idle");
      setUsernameAvailabilityMessage("");
      setUsernameAvailabilityTone(null);
      return;
    }

    // PHASE 5 PRE-LAUNCH: typed username equals the current one — show a subtle hint, skip the check.
    if (isSameAsCurrentUsername) {
      setUsernameAvailabilityStatus("idle");
      setUsernameAvailabilityMessage("This is already your username");
      setUsernameAvailabilityTone("system");
      return;
    }

    const validationError = getUsernameValidationError(usernameDraft);

    if (validationError) {
      setUsernameAvailabilityStatus("invalid");
      setUsernameAvailabilityMessage(validationError);
      setUsernameAvailabilityTone("error");
      return;
    }

    let active = true;
    setUsernameAvailabilityStatus("checking");
    setUsernameAvailabilityMessage("Checking username...");
    setUsernameAvailabilityTone(null);

    const timer = setTimeout(() => {
      checkUsernameAvailability(usernameDraft, currentUser.id)
        .then((result) => {
          if (!active) {
            return;
          }

          // PHASE 5 PRE-LAUNCH: distinct message + tone per availability category.
          const display = getUsernameAvailabilityDisplay(result);
          setUsernameAvailabilityStatus(result.available ? "available" : "unavailable");
          setUsernameAvailabilityMessage(display.text);
          setUsernameAvailabilityTone(display.tone);
        })
        .catch(() => {
          if (!active) {
            return;
          }

          setUsernameAvailabilityStatus("unavailable");
          setUsernameAvailabilityMessage("We could not verify this username right now. Please try again.");
          setUsernameAvailabilityTone("error");
        });
    }, 450);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [currentUser, profile, usernameDraft]);

  const handleSignOut = async () => {
    await signOut();
    router.replace("/auth");
  };

  // PHASE 5 STEP 2
  const handleDeleteAccount = () => {
    Alert.alert(
      "Delete account?",
      "Your public profile will be anonymized as Deleted User. Claims, votes, and evidence stay in Verifact so verification history does not break. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setDeleteLoading(true);
            const result = await deleteCurrentAccount();
            setDeleteLoading(false);

            if (!result.ok) {
              Alert.alert(result.error ? cleanUserError(result.error) : "Could not delete account right now.");
              return;
            }

            router.replace("/auth");
          },
        },
      ],
    );
  };

  // PHASE 5 STEP 4
  const handleOpenPrivacyPolicy = () => {
    Linking.openURL(`${PUBLIC_SITE_URL}/privacy`).catch(() => {
      Alert.alert("Could not open Privacy Policy right now.");
    });
  };

  // PHASE 5 STEP 4
  const handleContactSupport = () => {
    Linking.openURL(`mailto:${SUPPORT_EMAIL}`).catch(() => {
      Alert.alert("Contact support", `Email ${SUPPORT_EMAIL}`);
    });
  };

  const handleCreateMissingProfile = async () => {
    if (!currentUser) {
      return;
    }

    setActionError("");
    setActionMessage("");
    const result = await ensureProfile();

    if (result.error) {
      setActionError(cleanUserError(result.error));
      return;
    }

    setActionMessage(result.message ?? "Profile ready.");
  };

  // PHASE 5 STEP 2
  const handleSaveUsername = async () => {
    if (!currentUser || !usernameDraft.trim()) {
      return;
    }

    setActionError("");
    setActionMessage("");

    const usernameValidationError = getUsernameValidationError(usernameDraft);

    if (usernameValidationError) {
      setActionError(usernameValidationError);
      return;
    }

    const availability = await checkUsernameAvailability(usernameDraft, currentUser.id);

    if (!availability.available) {
      setActionError(
        availability.error === USERNAME_TAKEN_MESSAGE ? "Username is not available" : availability.error ?? "Username is not available",
      );
      return;
    }

    setUsernameSaving(true);
    const result = await updateProfile(currentUser.id, { username: usernameDraft });
    setUsernameSaving(false);

    if (result.error) {
      setActionError(cleanUserError(result.error));
      return;
    }

    setUsernameDraft("");
    setActionMessage("Username updated.");
    await refreshProfile();
  };

  // PHASE 5 STEP 6
  const handlePickAvatarFromSource = async (source: "camera" | "library") => {
    setAvatarError("");

    try {
      const image = source === "camera" ? await pickImageFromCamera() : await pickImageFromLibrary();

      if (image) {
        console.log("[avatar save] image selected:", {
          source,
          uri: image.uri,
          fileName: image.fileName ?? null,
          mimeType: image.mimeType ?? null,
          fileSize: image.fileSize ?? null,
          width: image.width ?? null,
          height: image.height ?? null,
        });
        setSelectedAvatar(image);
      }
    } catch (error) {
      setAvatarError(error instanceof Error ? error.message : "Could not select this image right now.");
    }
  };

  // PHASE 5 STEP 6
  const handlePickAvatar = () => {
    Alert.alert("Update avatar", "Choose a source for your profile avatar.", [
      {
        text: "Camera",
        onPress: () => {
          void handlePickAvatarFromSource("camera");
        },
      },
      {
        text: "Photo Library",
        onPress: () => {
          void handlePickAvatarFromSource("library");
        },
      },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  // PHASE 5 STEP 6
  const handleSaveAvatar = async () => {
    if (!currentUser || !selectedAvatar) {
      return;
    }

    setAvatarSaving(true);
    setAvatarError("");
    setActionMessage("");

    try {
      console.log("[avatar save] start:", {
        userId: currentUser.id,
        previousAvatarPath: profile?.avatar_path ?? null,
        selectedBytes: selectedAvatar.fileSize ?? null,
      });

      const uploadedAvatar = await uploadProfileAvatar(currentUser.id, selectedAvatar, profile?.avatar_path ?? null);
      console.log("[avatar save] upload success:", {
        storagePath: uploadedAvatar.imagePath,
        publicUrl: uploadedAvatar.imageUrl,
      });

      const result = await updateProfile(currentUser.id, {
        avatar_url: uploadedAvatar.imageUrl,
        avatar_path: uploadedAvatar.imagePath,
      });
      console.log("[avatar save] database update result:", {
        ok: Boolean(result.profile && !result.error),
        error: result.error ?? null,
        avatarUrl: result.profile?.avatar_url ?? null,
        avatarPath: result.profile?.avatar_path ?? null,
      });

      if (result.error) {
        setAvatarError("Your photo uploaded but your profile could not be updated.");
        return;
      }

      setSelectedAvatar(null);
      setActionMessage("Avatar updated.");
      console.log("[avatar save] refresh profile: start");
      const refreshResult = await refreshProfile({ silent: true });

      if (refreshResult.error) {
        console.log("[avatar save] refresh profile failed silently:", refreshResult.error);
        return;
      }

      console.log("[avatar save] UI refresh complete:", {
        avatarUrl: refreshResult.profile?.avatar_url ?? null,
        avatarPath: refreshResult.profile?.avatar_path ?? null,
      });
    } catch (error) {
      setAvatarError(error instanceof Error ? error.message : "Could not upload image. Please try again.");
    } finally {
      setAvatarSaving(false);
    }
  };

  // TASK 2 + TASK 3 — load both admin queues. Reported is the actionable
  // queue; Hidden is the reversible archive. Admin-only.
  const loadAdminQueues = async () => {
    setQueueLoading(true);
    setQueueMessage("");

    const [reported, hidden] = await Promise.all([fetchReportedClaims(), fetchHiddenClaims()]);

    setReportedClaims(reported.claims);
    setHiddenClaims(hidden.claims);
    setQueueMessage(reported.error || hidden.error || "");
    setQueueLoading(false);
  };

  useEffect(() => {
    if (!isAdmin) {
      setReportedClaims([]);
      setHiddenClaims([]);
      return;
    }

    void loadAdminQueues();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  const toggleClaimExpanded = (claimId: string) => {
    setExpandedClaimIds((current) => ({ ...current, [claimId]: !current[claimId] }));
  };

  // Hide a reported claim (calls the EXISTING /admin/claims/<id>/hide endpoint),
  // then refetch the reported queue.
  const handleHideReported = async (claim: ReportedClaim) => {
    setQueueBusyId(claim.claim_id);
    setQueueMessage("");
    const reason = claim.reasons[0] ? `${REPORTED_HIDE_REASON}: ${claim.reasons[0]}` : REPORTED_HIDE_REASON;
    const result = await hideClaimFromFeeds(claim.claim_id, reason);
    setQueueBusyId(null);

    if (!result.ok) {
      setQueueMessage(result.error ?? "Could not hide this claim.");
      return;
    }

    // Optimistically drop the row, then refetch to resync both queues.
    setReportedClaims((current) => current.filter((item) => item.claim_id !== claim.claim_id));
    await loadAdminQueues();
  };

  // Unhide a hidden claim (EXISTING /admin/claims/<id>/unhide), optimistic remove.
  const handleUnhide = async (claim: HiddenClaim) => {
    setQueueBusyId(claim.claim_id);
    setQueueMessage("");
    const result = await unhideClaim(claim.claim_id);
    setQueueBusyId(null);

    if (!result.ok) {
      setQueueMessage(result.error ?? "Could not unhide this claim.");
      return;
    }

    setHiddenClaims((current) => current.filter((item) => item.claim_id !== claim.claim_id));
    await loadAdminQueues();
  };

  // Delete a claim (EXISTING admin delete endpoint) with confirmation.
  const handleDeleteClaim = (claimId: string, title: string | null) => {
    Alert.alert(
      "Delete claim?",
      `This permanently removes ${title ? `"${title.slice(0, 60)}"` : "this claim"} and related rows. This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setQueueBusyId(claimId);
            setQueueMessage("");
            const result = await deleteClaimAsAdmin(claimId, "Removed by moderation.");
            setQueueBusyId(null);

            if (!result.ok) {
              setQueueMessage(result.error ?? "Could not delete this claim.");
              return;
            }

            setReportedClaims((current) => current.filter((item) => item.claim_id !== claimId));
            setHiddenClaims((current) => current.filter((item) => item.claim_id !== claimId));
            await loadAdminQueues();
          },
        },
      ],
    );
  };

  // PHASE 3 STEP 28
  useEffect(() => {
    if (loading || !isAuthenticated || profile || profileAutoFixAttempted.current) {
      return;
    }

    profileAutoFixAttempted.current = true;
    void handleCreateMissingProfile();
  }, [isAuthenticated, loading, profile]);

  // PHASE 5 STEP 1D
  useEffect(() => {
    if (!profile || !isAuthenticated) {
      setReputationEvents([]);
      return;
    }

    let isMounted = true;
    setActivityLoading(true);
    setActivityError("");

    fetchReputationEvents(50)
      .then((result) => {
        if (!isMounted) {
          return;
        }

        setReputationEvents(result.events);
        setActivityError(result.error ?? "");
      })
      .finally(() => {
        if (isMounted) {
          setActivityLoading(false);
        }
      });

    // PHASE 5 PRE-LAUNCH: load the user's True / Fake / Not sure voting counts (never errors).
    fetchUserVotingActivity(currentUser?.id ?? "").then((activity) => {
      if (isMounted) {
        setVotingActivity(activity);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [isAuthenticated, profile?.id, currentUser?.id]);

  function getActivityTitle(event: ReputationEvent): string {
    switch (event.event_type) {
      case "CORRECT_VOTE":
        return "Correct Vote";
      case "INCORRECT_VOTE":
        return "Incorrect Vote";
      case "VOTE_CAST":
        return "Vote Cast";
      case "EVIDENCE_ADDED":
        return "Evidence Added";
      case "HELPFUL_EVIDENCE":
        return "Helpful Evidence";
      case "BADGE_UNLOCKED":
        return `Badge Unlocked${event.badge_unlocked ? `: ${event.badge_unlocked}` : ""}`;
      case "RANK_UPGRADED":
        return `Rank upgraded${event.rank_after ? `: ${event.rank_after}` : ""}`;
      case "SUSPICIOUS_PENALTY":
        return "Suspicious Penalty";
      case "HIGH_QUALITY_SOURCE":
        return "High-quality Source";
      case "EVIDENCE_REJECTED":
        return "Evidence Rejected";
      default:
        return event.event_type
          .toLowerCase()
          .split("_")
          .map((word) => word.slice(0, 1).toUpperCase() + word.slice(1))
          .join(" ");
    }
  }

  function getActivityDelta(event: ReputationEvent): string {
    if (!event.points_delta) {
      return "0";
    }

    return event.points_delta > 0 ? `+${event.points_delta}` : String(event.points_delta);
  }

  return (
    <SafeAreaView style={styles.container}>
      <Header
        title="Profile"
        subtitle="Your account overview"
        rightIcon="settings-outline"
        onRightIconPress={() => router.push("/settings")}
        onRightIconLongPress={profile?.is_admin ? () => router.push("/admin/moderation") : undefined}
        rightAccessibilityLabel="Open Settings"
        rightAccessibilityHint="Opens appearance, accessibility, notification, and account settings"
      />
      <ScrollView
        contentContainerStyle={contentContainerStyle}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <View style={styles.card}>
            <Text style={styles.title}>Loading account...</Text>
            <Text style={styles.subtitle}>Please wait while Verifact checks your session.</Text>
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
                {showAvatarImage && avatarPreviewUri ? (
                  <Image
                    source={{ uri: avatarPreviewUri }}
                    style={styles.avatarImage}
                    onError={() => setAvatarLoadFailed(true)}
                  />
                ) : (
                  <Text style={styles.avatarText}>{initial}</Text>
                )}
              </View>
              <View style={styles.identity}>
                <View style={styles.nameRow}>
                  <Text style={styles.displayName} numberOfLines={1}>
                    {displayName}
                  </Text>
                  {isVerified ? <Text style={styles.verifiedBadge}>Email verified</Text> : null}
                </View>
                <Text style={styles.username} numberOfLines={1}>
                  @{username}
                </Text>
              </View>
            </View>

            {visibleProfileError ? <Text style={styles.errorText}>{visibleProfileError}</Text> : null}
            {visibleActionError ? <Text style={styles.errorText}>{visibleActionError}</Text> : null}
            {avatarError ? <Text style={styles.errorText}>{avatarError}</Text> : null}
            {actionMessage ? <Text style={styles.messageText}>{actionMessage}</Text> : null}

            {!profile ? (
              <View style={styles.missingProfilePanel}>
                <Text style={styles.missingProfileTitle}>
                  {profileBlockedByUsername ? "Username is already taken" : "Profile missing"}
                </Text>
                <Text style={styles.subtitle}>
                  {profileBlockedByUsername
                    ? "This account was created with a username already used by another account. Sign out and create a new account with a different username."
                    : "Verifact could not find your public profile row. Create it from your auth metadata."}
                </Text>
                {!profileBlockedByUsername ? (
                  <TouchableOpacity style={styles.button} activeOpacity={0.8} onPress={handleCreateMissingProfile}>
                    <Text style={styles.buttonText}>Fix profile</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            ) : null}

            {profile ? (
              <View style={styles.rankPanel}>
                <View style={styles.rankHeaderRow}>
                  <View style={styles.rankIcon}>
                    <Text style={styles.rankIconText}>VF</Text>
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

            {profile ? (
              <View style={styles.avatarEditPanel}>
                <Text style={styles.detailLabel}>Profile avatar</Text>
                {selectedAvatar ? (
                  <Text style={styles.detailValue}>
                    Selected image: {formatImageSize(selectedAvatar.fileSize)}
                    {selectedAvatar.warning ? `  •  ${selectedAvatar.warning}` : ""}
                  </Text>
                ) : (
                  <Text style={styles.detailValue}>Choose a profile image for your public contributor card.</Text>
                )}
                <View style={styles.avatarActionRow}>
                  <TouchableOpacity
                    style={styles.smallOutlineButton}
                    activeOpacity={0.8}
                    onPress={handlePickAvatar}
                    disabled={avatarSaving}
                  >
                    <Text style={styles.smallOutlineButtonText}>Choose avatar</Text>
                  </TouchableOpacity>
                  {selectedAvatar ? (
                    <TouchableOpacity
                      style={[styles.smallButton, avatarSaving && styles.disabledButton]}
                      activeOpacity={0.8}
                      onPress={handleSaveAvatar}
                      disabled={avatarSaving}
                    >
                      <Text style={styles.smallButtonText}>{avatarSaving ? "Uploading..." : "Save avatar"}</Text>
                    </TouchableOpacity>
                  ) : null}
                  {selectedAvatar ? (
                    <TouchableOpacity
                      style={styles.smallOutlineButton}
                      activeOpacity={0.8}
                      onPress={() => {
                        setSelectedAvatar(null);
                        setAvatarError("");
                      }}
                      disabled={avatarSaving}
                    >
                      <Text style={styles.smallOutlineButtonText}>Remove</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
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

            {profile ? (
              <View style={styles.usernameEditPanel}>
                <Text style={styles.detailLabel}>Change username</Text>
                <TextInput
                  value={usernameDraft}
                  onChangeText={setUsernameDraft}
                  placeholder="New username"
                  placeholderTextColor={appTheme.colors.muted}
                  autoCapitalize="none"
                  autoCorrect={false}
                  maxLength={20}
                  style={styles.usernameInput}
                />
                {usernameAvailabilityMessage ? (
                  <Text
                    style={[
                      styles.availabilityText,
                      usernameAvailabilityTone === "available" && styles.availableText,
                      usernameAvailabilityTone === "system" && styles.systemReservedText,
                      usernameAvailabilityTone === "protected" && styles.protectedText,
                      (usernameAvailabilityTone === "taken" || usernameAvailabilityTone === "error") &&
                        styles.unavailableText,
                    ]}
                  >
                    {usernameAvailabilityMessage}
                  </Text>
                ) : null}
                <TouchableOpacity
                  style={[styles.smallButton, usernameSaveDisabled && styles.disabledButton]}
                  activeOpacity={0.8}
                  onPress={handleSaveUsername}
                  disabled={usernameSaveDisabled}
                >
                  <Text style={styles.smallButtonText}>{usernameSaving ? "Saving..." : "Save username"}</Text>
                </TouchableOpacity>
              </View>
            ) : null}

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
                    <Text style={styles.statLabel}>Badges Earned</Text>
                    <Text style={styles.statValue}>{profile.badge_list.length}</Text>
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
                          onPress={() => Alert.alert(badge.name, "Badge earned through Verifact contributions.")}
                        >
                          <Text style={styles.contributorBadgeText}>{badge.name}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  ) : (
                    <Text style={styles.detailValue}>No badges yet.</Text>
                  )}
                </View>

                {/* PHASE 5 PRE-LAUNCH: voting activity stats */}
                <View style={styles.activitySection}>
                  <Text style={styles.detailLabel}>Voting Activity</Text>
                  {votingActivity && votingActivity.totalVotes > 0 ? (
                    <View style={styles.votingActivityGrid}>
                      <View style={styles.votingActivityBox}>
                        <Text style={[styles.votingActivityCount, styles.votingActivityTrue]}>
                          {votingActivity.trueVotes}
                        </Text>
                        <Text style={styles.votingActivityLabel}>True</Text>
                        <Text style={styles.votingActivityHint}>votes</Text>
                      </View>
                      <View style={styles.votingActivityBox}>
                        <Text style={[styles.votingActivityCount, styles.votingActivityFake]}>
                          {votingActivity.fakeVotes}
                        </Text>
                        <Text style={styles.votingActivityLabel}>Fake</Text>
                        <Text style={styles.votingActivityHint}>votes</Text>
                      </View>
                      <View style={styles.votingActivityBox}>
                        <Text style={[styles.votingActivityCount, styles.votingActivityNotSure]}>
                          {votingActivity.notSureVotes}
                        </Text>
                        <Text style={styles.votingActivityLabel}>Not Sure</Text>
                        <Text style={styles.votingActivityHint}>votes</Text>
                      </View>
                    </View>
                  ) : (
                    <Text style={styles.votingActivityEmpty}>
                      No voting activity yet.{"\n"}Cast your first vote to start building your record.
                    </Text>
                  )}
                </View>

                <View style={styles.activitySection}>
                  <View style={styles.sectionHeaderRow}>
                    <Text style={styles.detailLabel}>Reputation Activity</Text>
                    {activityLoading ? <Text style={styles.activityStatusText}>Loading...</Text> : null}
                  </View>
                  {!activityLoading && reputationEvents.length === 0 ? (
                    <Text style={styles.detailValue}>No reputation activity yet.</Text>
                  ) : null}
                  {reputationEvents.slice(0, 8).map((event, index) => (
                    <View
                      key={`${event.event_type}-${event.created_at}-${index}`}
                      style={styles.activityRow}
                    >
                      <View style={styles.activityDeltaPill}>
                        <Text
                          style={[
                            styles.activityDeltaText,
                            event.points_delta < 0 ? styles.activityDeltaNegative : styles.activityDeltaPositive,
                          ]}
                        >
                          {getActivityDelta(event)}
                        </Text>
                      </View>
                      <View style={styles.activityCopy}>
                        <Text style={styles.activityTitle}>{getActivityTitle(event)}</Text>
                        {event.event_type === "RANK_UPGRADED" && event.rank_before && event.rank_after ? (
                          <Text style={styles.activityReason}>
                            {event.rank_before} {"->"} {event.rank_after}
                          </Text>
                        ) : (
                          <Text style={styles.activityReason}>{event.reason || "Your reputation changed."}</Text>
                        )}
                      </View>
                    </View>
                  ))}
                </View>
              </>
            ) : null}

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Account created</Text>
              <Text style={styles.detailValue}>{createdAt ? new Date(createdAt).toLocaleDateString() : "Unknown"}</Text>
            </View>

            {/* My claims: entry point to the current user's own posted claims
                (reuses fetchClaimsByAuthorPage + ClaimCard, incl. 3h delete). */}
            <View style={styles.legalSection}>
              <Text style={styles.detailLabel}>Your posts</Text>
              <TouchableOpacity style={styles.legalLink} activeOpacity={0.8} onPress={() => router.push("/my-claims")}>
                <Text style={styles.legalLinkText}>My claims</Text>
              </TouchableOpacity>
            </View>

            {/* Save/unsave claims: entry point to the saved list. */}
            <View style={styles.legalSection}>
              <Text style={styles.detailLabel}>Saved</Text>
              <TouchableOpacity style={styles.legalLink} activeOpacity={0.8} onPress={() => router.push("/saved")}>
                <Text style={styles.legalLinkText}>Saved claims</Text>
              </TouchableOpacity>
            </View>

            {/* TASK 3 — Reported claims (admin only). The 24-hour moderation
                queue: act (Hide / Delete) without leaving the screen. Placed
                above Hidden claims because reports are the actionable queue. */}
            {isAdmin ? (
              <View style={styles.adminQueueSection}>
                <View style={styles.sectionHeaderRow}>
                  <Text style={styles.detailLabel}>Reported claims</Text>
                  {queueLoading ? (
                    <Text style={styles.activityStatusText}>Loading...</Text>
                  ) : (
                    <TouchableOpacity onPress={() => void loadAdminQueues()} activeOpacity={0.8}>
                      <Text style={styles.queueRefreshText}>Refresh</Text>
                    </TouchableOpacity>
                  )}
                </View>
                {queueMessage ? <Text style={styles.errorText}>{queueMessage}</Text> : null}
                {!queueLoading && reportedClaims.length === 0 ? (
                  <Text style={styles.detailValue}>No reported claims. The queue is clear.</Text>
                ) : null}
                {reportedClaims.map((claim) => {
                  const expanded = Boolean(expandedClaimIds[claim.claim_id]);
                  const busy = queueBusyId === claim.claim_id;
                  const notes = claim.reports.map((report) => report.note).filter((note): note is string => Boolean(note));

                  return (
                    <View key={claim.claim_id} style={styles.queueCard}>
                      <TouchableOpacity activeOpacity={0.8} onPress={() => toggleClaimExpanded(claim.claim_id)}>
                        <Text style={styles.queueTitle}>{claim.title || "Untitled claim"}</Text>
                        <Text style={styles.queueMeta}>
                          @{claim.author_username || "unknown"} {"·"} {claim.report_count}{" "}
                          {claim.report_count === 1 ? "report" : "reports"}
                        </Text>
                        {claim.reasons.length > 0 ? (
                          <Text style={styles.queueReason}>Reason: {claim.reasons.join(", ")}</Text>
                        ) : null}
                        {notes.map((note, index) => (
                          <Text key={index} style={styles.queueNote} numberOfLines={expanded ? undefined : 2}>
                            {"“"}
                            {note}
                            {"”"}
                          </Text>
                        ))}
                        {expanded && claim.description ? (
                          <Text style={styles.queueBody}>{claim.description}</Text>
                        ) : (
                          <Text style={styles.queueExpandHint}>{expanded ? "Tap to collapse" : "Tap to read full claim"}</Text>
                        )}
                      </TouchableOpacity>
                      <View style={styles.queueActionRow}>
                        <TouchableOpacity
                          style={[styles.queueActionButton, busy && styles.disabledButton]}
                          activeOpacity={0.8}
                          disabled={busy}
                          onPress={() => void handleHideReported(claim)}
                        >
                          <Text style={styles.queueActionText}>{claim.is_hidden ? "Hidden" : "Hide"}</Text>
                        </TouchableOpacity>
                        {/* Delete temporarily hidden — non-functional; see ADMIN_DELETE_ENABLED. */}
                        {ADMIN_DELETE_ENABLED ? (
                          <TouchableOpacity
                            style={[styles.queueActionButton, styles.queueActionDanger, busy && styles.disabledButton]}
                            activeOpacity={0.8}
                            disabled={busy}
                            onPress={() => handleDeleteClaim(claim.claim_id, claim.title)}
                          >
                            <Text style={[styles.queueActionText, styles.queueActionDangerText]}>Delete</Text>
                          </TouchableOpacity>
                        ) : null}
                      </View>
                    </View>
                  );
                })}
              </View>
            ) : null}

            {/* TASK 2 — Hidden claims (admin only). Reversible archive: Unhide
                restores to feeds, Delete removes permanently. */}
            {isAdmin ? (
              <View style={styles.adminQueueSection}>
                <Text style={styles.detailLabel}>Hidden claims</Text>
                {!queueLoading && hiddenClaims.length === 0 ? (
                  <Text style={styles.detailValue}>No hidden claims.</Text>
                ) : null}
                {hiddenClaims.map((claim) => {
                  const expanded = Boolean(expandedClaimIds[claim.claim_id]);
                  const busy = queueBusyId === claim.claim_id;

                  return (
                    <View key={claim.claim_id} style={styles.queueCard}>
                      <TouchableOpacity activeOpacity={0.8} onPress={() => toggleClaimExpanded(claim.claim_id)}>
                        <Text style={styles.queueTitle}>{claim.title || "Untitled claim"}</Text>
                        <Text style={styles.queueMeta}>@{claim.author_username || "unknown"}</Text>
                        {claim.hidden_reason ? (
                          <Text style={styles.queueReason}>Hidden: {claim.hidden_reason}</Text>
                        ) : null}
                        {expanded && claim.description ? (
                          <Text style={styles.queueBody}>{claim.description}</Text>
                        ) : (
                          <Text style={styles.queueExpandHint}>{expanded ? "Tap to collapse" : "Tap to read full claim"}</Text>
                        )}
                      </TouchableOpacity>
                      <View style={styles.queueActionRow}>
                        <TouchableOpacity
                          style={[styles.queueActionButton, busy && styles.disabledButton]}
                          activeOpacity={0.8}
                          disabled={busy}
                          onPress={() => void handleUnhide(claim)}
                        >
                          <Text style={styles.queueActionText}>Unhide</Text>
                        </TouchableOpacity>
                        {/* Delete temporarily hidden — non-functional; see ADMIN_DELETE_ENABLED. */}
                        {ADMIN_DELETE_ENABLED ? (
                          <TouchableOpacity
                            style={[styles.queueActionButton, styles.queueActionDanger, busy && styles.disabledButton]}
                            activeOpacity={0.8}
                            disabled={busy}
                            onPress={() => handleDeleteClaim(claim.claim_id, claim.title)}
                          >
                            <Text style={[styles.queueActionText, styles.queueActionDangerText]}>Delete</Text>
                          </TouchableOpacity>
                        ) : null}
                      </View>
                    </View>
                  );
                })}
              </View>
            ) : null}

            {/* PHASE 5 STEP 2 */}
            {/* PHASE 5 STEP 4 */}
            <View style={styles.legalSection}>
              <Text style={styles.detailLabel}>Settings and safety</Text>
              <Text style={styles.complianceNotice}>
                Verifact uses AI and community voting to help review claims. Results are informational and may be
                incorrect. Always check original sources.
              </Text>
              <TouchableOpacity style={styles.legalLink} activeOpacity={0.8} onPress={() => router.push("/settings")}>
                <Text style={styles.legalLinkText}>Settings</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.legalLink} activeOpacity={0.8} onPress={handleOpenPrivacyPolicy}>
                <Text style={styles.legalLinkText}>Privacy Policy</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.legalLink} activeOpacity={0.8} onPress={() => router.push("/legal/terms")}>
                <Text style={styles.legalLinkText}>Terms of Service</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.legalLink}
                activeOpacity={0.8}
                onPress={() => router.push("/legal/ai-disclaimer")}
              >
                <Text style={styles.legalLinkText}>AI Disclaimer</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.legalLink}
                activeOpacity={0.8}
                onPress={() => router.push("/legal/community-guidelines")}
              >
                <Text style={styles.legalLinkText}>Community Guidelines</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.legalLink} activeOpacity={0.8} onPress={handleContactSupport}>
                <Text style={styles.legalLinkText}>Contact Support</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.signOutButton} activeOpacity={0.8} onPress={handleSignOut}>
              <Text style={styles.signOutButtonText}>Sign out</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.deleteAccountButton, deleteLoading && styles.disabledButton]}
              activeOpacity={0.8}
              onPress={handleDeleteAccount}
              disabled={deleteLoading}
            >
              <Text style={styles.deleteAccountButtonText}>
                {deleteLoading ? "Deleting..." : "Delete account"}
              </Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </ScrollView>
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
    padding: 10,
  },
  card: {
    backgroundColor: theme.colors.background,
    borderRadius: theme.radius.md,
    padding: 14,
    borderWidth: theme.borderWidth,
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
  // PHASE 5 STEP 6
  avatarImage: {
    borderRadius: 28,
    height: 56,
    width: 56,
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
    flexShrink: 1,
    fontSize: theme.typography.title.fontSize,
    fontWeight: "500",
  },
  username: {
    color: theme.colors.subtext,
    flexShrink: 1,
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
  // PHASE 5 STEP 2
  usernameEditPanel: {
    borderTopColor: theme.colors.lightBorder,
    borderTopWidth: 0.5,
    paddingVertical: theme.spacing.md,
  },
  // PHASE 5 STEP 6
  avatarEditPanel: {
    borderTopColor: theme.colors.lightBorder,
    borderTopWidth: 0.5,
    paddingVertical: theme.spacing.md,
  },
  avatarActionRow: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.sm,
    marginTop: theme.spacing.sm,
  },
  usernameInput: {
    backgroundColor: theme.colors.card,
    borderColor: theme.colors.lightBorder,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    color: theme.colors.text,
    fontSize: 14,
    marginBottom: theme.spacing.sm,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  availabilityText: {
    fontSize: 12,
    fontWeight: "500",
    marginBottom: theme.spacing.sm,
    marginTop: -theme.spacing.xs,
  },
  availableText: {
    color: theme.colors.success,
  },
  unavailableText: {
    color: theme.colors.danger,
  },
  // PHASE 5 PRE-LAUNCH
  systemReservedText: {
    color: theme.colors.muted,
  },
  protectedText: {
    color: theme.colors.warningBorder,
  },
  smallButton: {
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  smallButtonText: {
    color: theme.colors.chipActiveText,
    fontSize: 13,
    fontWeight: "500",
  },
  // PHASE 5 STEP 6
  smallOutlineButton: {
    alignItems: "center",
    alignSelf: "flex-start",
    borderColor: theme.colors.lightBorder,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  smallOutlineButtonText: {
    color: theme.colors.primary,
    fontSize: 13,
    fontWeight: "500",
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
    borderColor: theme.colors.lightBorder,
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
    color: theme.colors.chipActiveText,
    fontSize: 11,
    fontWeight: "500",
  },
  rankTextBlock: {
    flex: 1,
  },
  rankTitle: {
    color: theme.colors.text,
    fontSize: 20,
    fontWeight: "500",
  },
  rankSubtitle: {
    color: theme.colors.subtext,
    fontSize: 12,
    marginTop: 2,
  },
  progressTrack: {
    backgroundColor: theme.colors.secondarySurface,
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
    fontWeight: "500",
    marginBottom: theme.spacing.xs,
  },
  statValue: {
    color: theme.colors.text,
    fontSize: 18,
    fontWeight: "500",
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
  // PHASE 5 STEP 1D
  activitySection: {
    borderTopColor: theme.colors.lightBorder,
    borderTopWidth: 0.5,
    paddingVertical: theme.spacing.md,
  },
  // PHASE 5 PRE-LAUNCH: voting activity grid
  votingActivityGrid: {
    flexDirection: "row",
    gap: theme.spacing.sm,
    marginTop: theme.spacing.sm,
  },
  votingActivityBox: {
    alignItems: "center",
    backgroundColor: theme.colors.card,
    borderColor: theme.colors.lightBorder,
    borderRadius: theme.radius.sm,
    borderWidth: 0.5,
    flex: 1,
    paddingVertical: theme.spacing.md,
  },
  votingActivityCount: {
    fontSize: 22,
    fontWeight: "500",
  },
  votingActivityTrue: {
    color: theme.colors.success,
  },
  votingActivityFake: {
    color: theme.colors.danger,
  },
  votingActivityNotSure: {
    color: theme.colors.warningBorder,
  },
  votingActivityLabel: {
    color: theme.colors.text,
    fontSize: 13,
    fontWeight: "500",
    marginTop: 2,
  },
  votingActivityHint: {
    color: theme.colors.subtext,
    fontSize: 11,
  },
  votingActivityEmpty: {
    color: theme.colors.subtext,
    fontSize: 13,
    lineHeight: 19,
    marginTop: theme.spacing.sm,
  },
  sectionHeaderRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  activityStatusText: {
    color: theme.colors.subtext,
    fontSize: 11,
  },
  activityRow: {
    alignItems: "flex-start",
    borderTopColor: theme.colors.lightBorder,
    borderTopWidth: 0.5,
    flexDirection: "row",
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.sm,
  },
  activityDeltaPill: {
    alignItems: "center",
    backgroundColor: theme.colors.card,
    borderColor: theme.colors.lightBorder,
    borderRadius: 999,
    borderWidth: 0.5,
    minWidth: 42,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  activityDeltaText: {
    fontSize: 12,
    fontWeight: "500",
  },
  activityDeltaPositive: {
    color: theme.colors.success,
  },
  activityDeltaNegative: {
    color: theme.colors.danger,
  },
  activityCopy: {
    flex: 1,
  },
  activityTitle: {
    color: theme.colors.text,
    fontSize: 13,
    fontWeight: "500",
  },
  activityReason: {
    color: theme.colors.subtext,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 2,
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
    fontWeight: "500",
  },
  successText: {
    color: theme.colors.success,
    fontWeight: "500",
  },
  warningText: {
    color: theme.colors.warningText,
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
    color: theme.colors.chipActiveText,
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
  // PHASE 5 STEP 2
  legalSection: {
    borderTopColor: theme.colors.lightBorder,
    borderTopWidth: 0.5,
    paddingVertical: theme.spacing.md,
  },
  // TASK 2 + TASK 3 — admin moderation queues
  adminQueueSection: {
    borderTopColor: theme.colors.lightBorder,
    borderTopWidth: 0.5,
    paddingVertical: theme.spacing.md,
  },
  queueRefreshText: {
    color: theme.colors.link,
    fontSize: 12,
    fontWeight: "500",
  },
  queueCard: {
    backgroundColor: theme.colors.card,
    borderColor: theme.colors.lightBorder,
    borderRadius: theme.radius.sm,
    borderWidth: 0.5,
    marginTop: theme.spacing.sm,
    padding: theme.spacing.md,
  },
  queueTitle: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: "500",
  },
  queueMeta: {
    color: theme.colors.subtext,
    fontSize: 12,
    marginTop: 3,
  },
  queueReason: {
    color: theme.colors.text,
    fontSize: 12,
    marginTop: 6,
  },
  queueNote: {
    color: theme.colors.subtext,
    fontSize: 12,
    fontStyle: "italic",
    lineHeight: 17,
    marginTop: 4,
  },
  queueBody: {
    color: theme.colors.text,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 8,
  },
  queueExpandHint: {
    color: theme.colors.link,
    fontSize: 11,
    marginTop: 8,
  },
  queueActionRow: {
    flexDirection: "row",
    gap: theme.spacing.sm,
    marginTop: theme.spacing.md,
  },
  queueActionButton: {
    alignItems: "center",
    backgroundColor: theme.colors.sourceBg,
    borderRadius: theme.radius.sm,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  queueActionText: {
    color: theme.colors.sourceText,
    fontSize: 13,
    fontWeight: "500",
  },
  queueActionDanger: {
    backgroundColor: theme.colors.dangerBg,
  },
  queueActionDangerText: {
    color: theme.colors.danger,
  },
  // PHASE 5 STEP 4
  complianceNotice: {
    backgroundColor: theme.colors.card,
    borderColor: theme.colors.lightBorder,
    borderRadius: theme.radius.sm,
    borderWidth: 0.5,
    color: theme.colors.subtext,
    fontSize: 13,
    lineHeight: 19,
    marginBottom: theme.spacing.sm,
    padding: 10,
  },
  legalLink: {
    paddingVertical: 8,
  },
  legalLinkText: {
    color: theme.colors.link,
    fontSize: 14,
    fontWeight: "500",
  },
  deleteAccountButton: {
    alignItems: "center",
    backgroundColor: theme.colors.dangerBg,
    borderRadius: theme.radius.sm,
    marginTop: theme.spacing.sm,
    paddingVertical: theme.spacing.md,
  },
  deleteAccountButtonText: {
    color: theme.colors.danger,
    fontSize: theme.typography.body.fontSize,
    fontWeight: "500",
  },
  disabledButton: {
    opacity: 0.6,
  },
  });
}
