// PHASE 1 STEP 4
import { View, Text, StyleSheet, SafeAreaView } from "react-native";
import { Header } from "../../components/Header";
import { mockClaims } from "../../constants/mockData";
import { theme } from "../../constants/theme";

export default function ProfileScreen() {
  const user = {
    username: "factlens_user",
    totalClaims: mockClaims.length,
    totalVotes: mockClaims.reduce((sum, claim) => sum + claim.votesTrue + claim.votesFake + claim.votesUnsure, 0),
    reputation: 84,
  };

  return (
    <SafeAreaView style={styles.container}>
      <Header title="Profile" subtitle="Your account overview" />
      <View style={styles.content}>
        <View style={styles.card}>
          <Text style={styles.username}>@{user.username}</Text>
          <Text style={styles.note}>Community verifier</Text>
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{user.totalClaims}</Text>
              <Text style={styles.statLabel}>Claims</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{user.totalVotes}</Text>
              <Text style={styles.statLabel}>Votes</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{user.reputation}</Text>
              <Text style={styles.statLabel}>Reputation</Text>
            </View>
          </View>
        </View>
      </View>
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
    borderRadius: theme.radius.xl,
    padding: theme.spacing.xl,
    ...theme.shadows.light,
    borderWidth: 1,
    borderColor: theme.colors.lightBorder,
  },
  username: {
    fontSize: theme.typography.largeTitle.fontSize,
    fontWeight: "700",
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
  },
  note: {
    fontSize: theme.typography.body.fontSize,
    color: theme.colors.subtext,
    marginBottom: theme.spacing.lg,
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  statItem: {
    alignItems: "center",
    flex: 1,
  },
  statValue: {
    fontSize: 24,
    fontWeight: "700",
    color: theme.colors.primary,
  },
  statLabel: {
    marginTop: theme.spacing.sm,
    fontSize: theme.typography.small.fontSize,
    color: theme.colors.subtext,
  },
});
