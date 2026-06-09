// PHASE 5 STEP 2
import { SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { Header } from "../../components/Header";
import { theme } from "../../constants/theme";

const rules = [
  "Post claims and evidence in good faith.",
  "Do not post nude, porn, sexually explicit, abusive, hateful, or harmful content.",
  "Do not use Verifact for spam, scams, harassment, threats, or coordinated manipulation.",
  "Do not submit malicious evidence or sources designed to mislead users.",
  "Report content that appears unsafe, abusive, explicit, spammy, or manipulative.",
];

export default function CommunityGuidelinesScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container}>
      <Header title="Community Guidelines" subtitle="Public launch safety rules" />
      <ScrollView contentContainerStyle={styles.content}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.8}>
          <Text style={styles.link}>Back</Text>
        </TouchableOpacity>
        {rules.map((rule) => (
          <Text key={rule} style={styles.rule}>
            {rule}
          </Text>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: theme.colors.card, flex: 1 },
  content: { gap: 10, padding: 14 },
  link: { color: theme.colors.link, fontSize: 14, fontWeight: "500", marginBottom: 4 },
  rule: {
    backgroundColor: theme.colors.background,
    borderColor: theme.colors.lightBorder,
    borderRadius: theme.radius.sm,
    borderWidth: 0.5,
    color: theme.colors.text,
    fontSize: 14,
    lineHeight: 20,
    padding: 12,
  },
});
