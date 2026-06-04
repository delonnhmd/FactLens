// PHASE 1 STEP 4
// PHASE 3 STEP 27
// PHASE 3 STEP 28
// PHASE 4 STEP 27
import { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { Header } from "../../components/Header";
import { theme } from "../../constants/theme";
import { useAuth } from "../../context/AuthContext";
import { getAuthProfile } from "../../services/authProfile";

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

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Reputation score</Text>
              <Text style={styles.reputationBadge}>{profile?.reputation_score ?? 0}</Text>
            </View>

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
