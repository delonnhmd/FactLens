// PHASE 1 STEP 4
import { ScrollView, StyleSheet, SafeAreaView } from "react-native";
import { useRouter } from "expo-router";
import { Header } from "../../components/Header";
import { ClaimCard } from "../../components/ClaimCard";
import { useClaims } from "../../hooks/useClaims";
import { theme } from "../../constants/theme";

export default function TrendingScreen() {
  const router = useRouter();
  // PHASE 2 STEP 1
  const { claims, castVote } = useClaims();

  const handleClaimPress = (claimId: string) => {
    router.push(`/claim/${claimId}`);
  };

  return (
    <SafeAreaView style={styles.container}>
      <Header title="Trending Claims" subtitle="See what's gaining attention" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {claims.map((claim) => (
          <ClaimCard
            key={claim.id}
            claim={claim}
            onPress={() => handleClaimPress(claim.id)}
            onVote={castVote}
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
});
