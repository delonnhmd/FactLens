// PHASE 1 STEP 4
import { View, Text, ScrollView, StyleSheet, SafeAreaView, TouchableOpacity } from "react-native";
import type { DimensionValue } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { mockClaims } from "../../constants/mockData";
import { StatusBadge } from "../../components/StatusBadge";
import { VoteButtons } from "../../components/VoteButtons";
import { theme } from "../../constants/theme";

export default function ClaimDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();

  const claim = mockClaims.find((item) => item.id === id);

  if (!claim) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
            <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Claim Details</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Claim not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  const totalVotes = claim.votesTrue + claim.votesFake + claim.votesUnsure;
  const voteStats = [
    { label: "True", value: claim.votesTrue, color: theme.colors.success },
    { label: "Fake", value: claim.votesFake, color: theme.colors.danger },
    { label: "Not Sure", value: claim.votesUnsure, color: theme.colors.warning },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Claim Details</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <View style={styles.titleRow}>
            <Text style={styles.title}>{claim.title}</Text>
            <StatusBadge status={claim.status} />
          </View>
          <Text style={styles.authorText}>by @{claim.author.username}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Description</Text>
          <Text style={styles.description}>{claim.description}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Source</Text>
          <Text style={styles.sourceUrl}>{claim.sourceUrl}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Posted</Text>
          <Text style={styles.date}>{new Date(claim.createdAt).toLocaleDateString()}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Vote Results</Text>
          <View style={styles.voteRowDetailed}>
            {voteStats.map((stat) => {
              const width: DimensionValue =
                totalVotes > 0 ? `${Math.max((stat.value / totalVotes) * 100, 8)}%` : "8%";

              return (
                <View key={stat.label} style={styles.voteItemDetailed}>
                  <Text style={styles.voteLabelDetailed}>{stat.label}</Text>
                  <Text style={styles.voteValueDetailed}>{stat.value}</Text>
                  <View style={styles.voteBarTrack}>
                    <View style={[styles.voteBar, { backgroundColor: stat.color, width }]} />
                  </View>
                </View>
              );
            })}
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Evidence</Text>
          <Text style={styles.placeholder}>Evidence section coming soon</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Comments</Text>
          <Text style={styles.placeholder}>Comments section coming soon</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Cast Your Vote</Text>
          <VoteButtons />
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
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    backgroundColor: theme.colors.background,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  headerTitle: {
    fontSize: theme.typography.title.fontSize,
    fontWeight: "700",
    color: theme.colors.text,
  },
  headerSpacer: {
    width: 24,
  },
  content: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.xl,
  },
  card: {
    backgroundColor: theme.colors.background,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.md,
    ...theme.shadows.light,
    borderWidth: 1,
    borderColor: theme.colors.lightBorder,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: theme.spacing.sm,
  },
  title: {
    flex: 1,
    fontSize: theme.typography.title.fontSize,
    fontWeight: "700",
    color: theme.colors.text,
    lineHeight: theme.typography.title.lineHeight,
    marginRight: theme.spacing.md,
  },
  authorText: {
    fontSize: theme.typography.small.fontSize,
    color: theme.colors.subtext,
  },
  label: {
    fontSize: theme.typography.body.fontSize,
    fontWeight: "700",
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
  },
  description: {
    fontSize: theme.typography.body.fontSize,
    color: theme.colors.text,
    lineHeight: theme.typography.body.lineHeight,
  },
  sourceUrl: {
    fontSize: theme.typography.body.fontSize,
    color: theme.colors.primary,
  },
  date: {
    fontSize: theme.typography.body.fontSize,
    color: theme.colors.subtext,
  },
  voteRowDetailed: {
    gap: theme.spacing.md,
  },
  voteItemDetailed: {
    gap: theme.spacing.xs,
  },
  voteLabelDetailed: {
    fontSize: theme.typography.small.fontSize,
    color: theme.colors.subtext,
  },
  voteValueDetailed: {
    fontSize: 20,
    fontWeight: "700",
    color: theme.colors.text,
  },
  voteBarTrack: {
    height: 6,
    overflow: "hidden",
    borderRadius: 3,
    backgroundColor: theme.colors.lightBorder,
  },
  voteBar: {
    height: 6,
    borderRadius: 3,
  },
  placeholder: {
    fontSize: theme.typography.body.fontSize,
    color: theme.colors.muted,
    fontStyle: "italic",
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: theme.spacing.lg,
  },
  errorText: {
    fontSize: theme.typography.body.fontSize,
    color: theme.colors.text,
  },
});
