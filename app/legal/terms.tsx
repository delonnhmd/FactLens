// PHASE 5 STEP 2
import { SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { Header } from "../../components/Header";
import { theme } from "../../constants/theme";

export default function TermsScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container}>
      <Header title="Terms of Service" subtitle="Verifact public launch terms" />
      <ScrollView contentContainerStyle={styles.content}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.8}>
          <Text style={styles.link}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.heading}>Use of Verifact</Text>
        <Text style={styles.body}>
          Verifact is an informational community news-verification app. Content, AI pre-checks, source analysis,
          and community voting are not guaranteed to be complete, accurate, or final truth.
        </Text>
        <Text style={styles.heading}>User Content</Text>
        <Text style={styles.body}>
          You are responsible for the claims, evidence, reports, and profile information you submit. Do not post
          spam, harassment, explicit content, hateful content, illegal threats, malicious evidence, or harmful abuse.
        </Text>
        <Text style={styles.heading}>Moderation</Text>
        <Text style={styles.body}>
          Verifact may remove, hide, or restrict content and accounts that violate these terms or create safety risk.
          Reports are reviewed for launch safety and abuse prevention.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: theme.colors.card, flex: 1 },
  content: { padding: 14 },
  link: { color: theme.colors.link, fontSize: 14, fontWeight: "500", marginBottom: 14 },
  heading: { color: theme.colors.text, fontSize: 16, fontWeight: "500", marginBottom: 8, marginTop: 10 },
  body: { color: theme.colors.subtext, fontSize: 14, lineHeight: 21 },
});
