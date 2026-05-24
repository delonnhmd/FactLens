// PHASE 1 STEP 3
import { TouchableOpacity, View, Text, StyleSheet } from "react-native";
import type { Claim } from "../types/claim";
import { StatusBadge } from "./StatusBadge";

interface ClaimCardProps {
  claim: Claim;
  onPress?: () => void;
}

export function ClaimCard({ claim, onPress }: ClaimCardProps) {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.9}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>{claim.title}</Text>
        <StatusBadge status={claim.status} />
      </View>
      <Text style={styles.description}>{claim.description}</Text>
      <Text style={styles.meta}>Source: {claim.sourceUrl}</Text>
      <View style={styles.voteRow}>
        <View style={styles.voteItem}>
          <Text style={styles.voteLabel}>True</Text>
          <Text style={styles.voteValue}>{claim.votesTrue}</Text>
        </View>
        <View style={styles.voteItem}>
          <Text style={styles.voteLabel}>Fake</Text>
          <Text style={styles.voteValue}>{claim.votesFake}</Text>
        </View>
        <View style={styles.voteItem}>
          <Text style={styles.voteLabel}>Not Sure</Text>
          <Text style={styles.voteValue}>{claim.votesUnsure}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 20,
    shadowColor: "#000000",
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
    marginBottom: 16,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  title: {
    flex: 1,
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
    marginRight: 12,
  },
  description: {
    fontSize: 14,
    color: "#374151",
    marginBottom: 12,
    lineHeight: 20,
  },
  meta: {
    fontSize: 12,
    color: "#6B7280",
    marginBottom: 16,
  },
  voteRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  voteItem: {
    alignItems: "center",
    flex: 1,
  },
  voteLabel: {
    fontSize: 12,
    color: "#6B7280",
    marginBottom: 4,
  },
  voteValue: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
  },
});
