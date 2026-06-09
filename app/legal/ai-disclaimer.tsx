// PHASE 5 STEP 2
import { SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { Header } from "../../components/Header";
import { theme } from "../../constants/theme";

export default function AiDisclaimerScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container}>
      <Header title="AI Disclaimer" subtitle="How Verifact uses AI signals" />
      <ScrollView contentContainerStyle={styles.content}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.8}>
          <Text style={styles.link}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.body}>
          Verifact AI pre-checks are preliminary risk signals. AI may be incorrect, incomplete, outdated, or unable
          to read a source page. AI does not decide final truth.
        </Text>
        <Text style={styles.body}>
          Community voting, evidence, source quality, and finalization rules are also imperfect. Treat Verifact as
          informational support, not legal, medical, financial, or safety advice.
        </Text>
        <Text style={styles.body}>
          If content appears harmful, abusive, explicit, spammy, or manipulative, use Report Content so it can be
          reviewed.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: theme.colors.card, flex: 1 },
  content: { gap: 12, padding: 14 },
  link: { color: theme.colors.link, fontSize: 14, fontWeight: "500", marginBottom: 4 },
  body: { color: theme.colors.subtext, fontSize: 14, lineHeight: 21 },
});
