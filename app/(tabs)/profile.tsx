// PHASE 1 STEP 4
import { View, Text, StyleSheet, SafeAreaView, ScrollView } from "react-native";
import { Header } from "../../components/Header";
import { useAuth } from "../../context/AuthContext";
import { useClaims } from "../../context/ClaimsContext";
import { theme } from "../../constants/theme";

export default function ProfileScreen() {
  // PHASE 2 STEP 9
  const { currentUser } = useAuth();
  const { claims } = useClaims();

  const totalClaimsCreated = claims.filter((claim) => claim.authorId === currentUser.id).length;

  return (
    <SafeAreaView style={styles.container}>
      <Header title="Profile" subtitle="Your account overview" />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <View style={styles.profileHeader}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{currentUser.displayName.slice(0, 1).toUpperCase()}</Text>
            </View>
            <View style={styles.identity}>
              <View style={styles.nameRow}>
                <Text style={styles.displayName}>{currentUser.displayName}</Text>
                {currentUser.verified ? <Text style={styles.verifiedBadge}>Verified</Text> : null}
              </View>
              <Text style={styles.username}>@{currentUser.username}</Text>
              <Text style={styles.joined}>Joined {new Date(currentUser.joinedAt).toLocaleDateString()}</Text>
            </View>
          </View>

          <View style={styles.reputationPanel}>
            <Text style={styles.reputationLabel}>Reputation score</Text>
            <Text style={styles.reputationValue}>{currentUser.reputationScore}</Text>
          </View>

          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{totalClaimsCreated}</Text>
              <Text style={styles.statLabel}>Claims Created</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>0</Text>
              <Text style={styles.statLabel}>Votes Cast</Text>
              <Text style={styles.placeholderText}>Placeholder</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>0</Text>
              <Text style={styles.statLabel}>Evidence Links</Text>
              <Text style={styles.placeholderText}>Placeholder</Text>
            </View>
          </View>
        </View>
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
  username: {
    color: theme.colors.subtext,
    fontSize: theme.typography.body.fontSize,
  },
  joined: {
    color: theme.colors.muted,
    fontSize: theme.typography.small.fontSize,
    marginTop: theme.spacing.xs,
  },
  reputationPanel: {
    backgroundColor: theme.colors.card,
    borderColor: theme.colors.lightBorder,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    marginBottom: theme.spacing.md,
    padding: theme.spacing.md,
  },
  reputationLabel: {
    color: theme.colors.subtext,
    fontSize: theme.typography.small.fontSize,
    fontWeight: "700",
    marginBottom: theme.spacing.xs,
  },
  reputationValue: {
    color: theme.colors.primary,
    fontSize: 28,
    fontWeight: "700",
  },
  statsGrid: {
    gap: theme.spacing.md,
  },
  statItem: {
    backgroundColor: theme.colors.card,
    borderColor: theme.colors.lightBorder,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    padding: theme.spacing.md,
  },
  statValue: {
    color: theme.colors.primary,
    fontSize: 24,
    fontWeight: "700",
    marginBottom: theme.spacing.xs,
  },
  statLabel: {
    color: theme.colors.text,
    fontSize: theme.typography.small.fontSize,
    fontWeight: "700",
  },
  placeholderText: {
    color: theme.colors.muted,
    fontSize: theme.typography.small.fontSize,
    marginTop: theme.spacing.xs,
  },
});
