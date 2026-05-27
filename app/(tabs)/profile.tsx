// PHASE 1 STEP 4
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { Header } from "../../components/Header";
import { theme } from "../../constants/theme";
import { useAuth } from "../../context/AuthContext";
import { getAuthProfile } from "../../services/authProfile";

export default function ProfileScreen() {
  // PHASE 3 STEP 1
  const router = useRouter();
  const { currentUser, isAuthenticated, isVerified, loading, signOut } = useAuth();
  const profile = getAuthProfile(currentUser);

  const handleSignOut = async () => {
    await signOut();
    router.replace("/");
  };

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
              <Text style={styles.buttonText}>Log in or Create Account</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {!loading && isAuthenticated ? (
          <View style={styles.card}>
            <View style={styles.profileHeader}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{profile.initial}</Text>
              </View>
              <View style={styles.identity}>
                <View style={styles.nameRow}>
                  <Text style={styles.displayName}>{profile.username}</Text>
                  {isVerified ? <Text style={styles.verifiedBadge}>Verified</Text> : null}
                </View>
                <Text style={styles.username}>@{profile.username}</Text>
              </View>
            </View>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Email</Text>
              <Text style={styles.detailValue}>{profile.email || "No email on account"}</Text>
            </View>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Username</Text>
              <Text style={styles.detailValue}>{profile.username}</Text>
            </View>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Email verification</Text>
              <Text style={[styles.detailValue, isVerified ? styles.successText : styles.warningText]}>
                {isVerified ? "Verified" : "Not verified"}
              </Text>
            </View>

            <TouchableOpacity style={styles.signOutButton} activeOpacity={0.8} onPress={handleSignOut}>
              <Text style={styles.signOutButtonText}>Sign Out</Text>
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
    padding: theme.spacing.lg,
  },
  card: {
    backgroundColor: theme.colors.background,
    borderRadius: theme.radius.md,
    padding: theme.spacing.lg,
    ...theme.shadows.light,
    borderWidth: 1,
    borderColor: theme.colors.lightBorder,
  },
  title: {
    color: theme.colors.text,
    fontSize: theme.typography.title.fontSize,
    fontWeight: "700",
    marginBottom: theme.spacing.sm,
  },
  subtitle: {
    color: theme.colors.subtext,
    fontSize: theme.typography.body.fontSize,
    lineHeight: theme.typography.body.lineHeight,
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
    backgroundColor: "#E0E7FF",
    borderRadius: 28,
    height: 56,
    justifyContent: "center",
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
    fontWeight: "700",
  },
  username: {
    color: theme.colors.subtext,
    fontSize: theme.typography.body.fontSize,
  },
  verifiedBadge: {
    backgroundColor: "#DCFCE7",
    borderColor: "#BBF7D0",
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    color: theme.colors.success,
    fontSize: theme.typography.small.fontSize,
    fontWeight: "700",
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
  },
  detailRow: {
    borderTopColor: theme.colors.lightBorder,
    borderTopWidth: 1,
    paddingVertical: theme.spacing.md,
  },
  detailLabel: {
    color: theme.colors.subtext,
    fontSize: theme.typography.small.fontSize,
    fontWeight: "700",
    marginBottom: theme.spacing.xs,
  },
  detailValue: {
    color: theme.colors.text,
    fontSize: theme.typography.body.fontSize,
  },
  successText: {
    color: theme.colors.success,
    fontWeight: "700",
  },
  warningText: {
    color: theme.colors.warning,
    fontWeight: "700",
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
    fontWeight: "700",
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
    fontWeight: "700",
  },
});
