// PHASE 1 STEP 2
import { View, Text, StyleSheet, SafeAreaView } from "react-native";
import { Header } from "../../components/Header";
import { mockClaims } from "../../constants/mockData";

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
    backgroundColor: "#F9FAFB",
  },
  content: {
    padding: 20,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 24,
    shadowColor: "#000000",
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
  },
  username: {
    fontSize: 24,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 6,
  },
  note: {
    fontSize: 14,
    color: "#6B7280",
    marginBottom: 20,
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
    fontSize: 22,
    fontWeight: "700",
    color: "#111827",
  },
  statLabel: {
    marginTop: 4,
    fontSize: 12,
    color: "#6B7280",
  },
});
