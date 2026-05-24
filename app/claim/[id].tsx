// PHASE 1 STEP 4
import { View, Text, ScrollView, StyleSheet, SafeAreaView, TouchableOpacity } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { mockClaims } from "../../constants/mockData";
import { StatusBadge } from "../../components/StatusBadge";
import { VoteButtons } from "../../components/VoteButtons";
import { theme } from "../../constants/theme";

export default function ClaimDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();

  const claim = mockClaims.find((c) => c.id === id);

  if (!claim) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
            <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Claim Details</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Claim not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Claim Details</Text>
        <View style={{ width: 24 }} />
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
            <View style={styles.voteItemDetailed}>
              <Text style={styles.voteLabelDetailed}>True</Text>
              <Text style={styles.voteValueDetailed}>{claim.votesTrue}</Text>
              <View style={[styles.voteBar, { backgroundColor: theme.colors.success, width: "100%" }]} />
            </View>
            <View style={styles.voteItemDetailed}>
              <Text style={styles.voteLabelDetailed}>Fake</Text>
              <Text style={styles.voteValueDetailed}>{claim.votesFake}</Text>
              <View style={[styles.voteBar, { backgroundColor: theme.colors.danger, width: "100%" }]} />
            </View>
            <View style={styles.voteItemDetailed}>
              <Text style={styles.voteLabelDetailed}>Not Sure</Text>
              <Text style={styles.voteValueDetailed}>{claim.votesUnsure}</Text>
              <View style={[styles.voteBar, { backgroundColor: theme.colors.warning, width: "100%" }]} />
            </View>
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
    fontSize: theme.typography.largeTitle.fontSize,
    fontWeight: "700",
    color: theme.colors.text,
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
    lineHeight: 24,
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
    flexDirection: "row",
    justifyContent: "space-between",
  },
  voteItemDetailed: {\n    alignItems: \"center\",\n    flex: 1,\n  },\n  voteLabelDetailed: {\n    fontSize: theme.typography.small.fontSize,\n    color: theme.colors.subtext,\n    marginBottom: theme.spacing.sm,\n  },\n  voteValueDetailed: {\n    fontSize: 20,\n    fontWeight: \"700\",\n    color: theme.colors.text,\n    marginBottom: theme.spacing.sm,\n  },\n  voteBar: {\n    height: 6,\n    borderRadius: 3,\n    marginTop: theme.spacing.sm,\n  },\n  placeholder: {\n    fontSize: theme.typography.body.fontSize,\n    color: theme.colors.muted,\n    fontStyle: \"italic\",\n  },\n  errorContainer: {\n    flex: 1,\n    justifyContent: \"center\",\n    alignItems: \"center\",\n    padding: theme.spacing.lg,\n  },\n  errorText: {\n    fontSize: theme.typography.body.fontSize,\n    color: theme.colors.text,\n  },\n});\n

        <View style={styles.card}>
          <Text style={styles.label}>Posted</Text>
          <Text style={styles.date}>{new Date(claim.createdAt).toLocaleDateString()}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Vote Results</Text>
          <View style={styles.voteRowDetailed}>
            <View style={styles.voteItemDetailed}>
              <Text style={styles.voteLabelDetailed}>True</Text>
              <Text style={styles.voteValueDetailed}>{claim.votesTrue}</Text>
              <View style={[styles.voteBar, { backgroundColor: "#22C55E", width: "100%" }]} />
            </View>
            <View style={styles.voteItemDetailed}>
              <Text style={styles.voteLabelDetailed}>Fake</Text>
              <Text style={styles.voteValueDetailed}>{claim.votesFake}</Text>
              <View style={[styles.voteBar, { backgroundColor: "#EF4444", width: "100%" }]} />
            </View>
            <View style={styles.voteItemDetailed}>
              <Text style={styles.voteLabelDetailed}>Not Sure</Text>
              <Text style={styles.voteValueDetailed}>{claim.votesUnsure}</Text>
              <View style={[styles.voteBar, { backgroundColor: "#F59E0B", width: "100%" }]} />
            </View>
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
    backgroundColor: "#F9FAFB",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 20,
    marginBottom: 16,
    shadowColor: "#000000",
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  title: {
    flex: 1,
    fontSize: 20,
    fontWeight: "700",
    color: "#111827",
    marginRight: 12,
  },
  authorText: {
    fontSize: 14,
    color: "#6B7280",
  },
  label: {
    fontSize: 14,
    fontWeight: "700",
    color: "#374151",
    marginBottom: 12,
  },
  description: {
    fontSize: 16,
    color: "#374151",
    lineHeight: 24,
  },
  sourceUrl: {
    fontSize: 14,
    color: "#2563EB",
  },
  date: {
    fontSize: 14,
    color: "#6B7280",
  },
  voteRowDetailed: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  voteItemDetailed: {
    alignItems: "center",
    flex: 1,
  },
  voteLabelDetailed: {
    fontSize: 13,
    color: "#6B7280",
    marginBottom: 6,
  },
  voteValueDetailed: {
    fontSize: 20,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 8,
  },
  voteBar: {
    height: 6,
    borderRadius: 3,
    marginTop: 4,
  },
  placeholder: {
    fontSize: 14,
    color: "#9CA3AF",
    fontStyle: "italic",
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  errorText: {
    fontSize: 16,
    color: "#374151",
  },
});
