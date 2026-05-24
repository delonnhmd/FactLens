// PHASE 1 STEP 4
import { ScrollView, StyleSheet, SafeAreaView } from "react-native";
import { useRouter } from "expo-router";
import { Header } from "../../components/Header";
import { ClaimCard } from "../../components/ClaimCard";
import { mockClaims } from "../../constants/mockData";
import { theme } from "../../constants/theme";

export default function HomeScreen() {
  const router = useRouter();

  const handleClaimPress = (claimId: string) => {
    router.push(`/claim/${claimId}`);
  };

  return (
    <SafeAreaView style={styles.container}>
      <Header title="FactLens" subtitle="Verify news with community evidence" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {mockClaims.map((claim) => (
          <ClaimCard key={claim.id} claim={claim} onPress={() => handleClaimPress(claim.id)} />
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

