// PHASE 1 STEP 4
import { ScrollView, StyleSheet, SafeAreaView, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Header } from "../../components/Header";
import { ClaimCard } from "../../components/ClaimCard";
import { useClaims } from "../../context/ClaimsContext";
import { theme } from "../../constants/theme";

export default function HomeScreen() {
  const router = useRouter();
  const { claimPosted } = useLocalSearchParams<{ claimPosted?: string }>();
  // PHASE 2 STEP 6
  const { claims, voteOnClaim, reportClaim } = useClaims();

  const handleClaimPress = (claimId: string) => {
    router.push(`/claim/${claimId}`);
  };

  return (
    <SafeAreaView style={styles.container}>
      <Header title="FactLens" subtitle="Verify news with community evidence" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {claimPosted === "1" ? (
          <View style={styles.successBanner}>
            <Text style={styles.successText}>Claim posted. Voting closes in 24 hours.</Text>
          </View>
        ) : null}
        {claims.map((claim) => (
          <ClaimCard
            key={claim.id}
            claim={claim}
            onPress={() => handleClaimPress(claim.id)}
            onVote={voteOnClaim}
            onReport={reportClaim}
          />
        ))}
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
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.xl,
  },
  successBanner: {
    backgroundColor: "#DCFCE7",
    borderColor: "#BBF7D0",
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    marginBottom: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
  },
  successText: {
    color: theme.colors.success,
    fontSize: theme.typography.body.fontSize,
    fontWeight: "700",
  },
});

