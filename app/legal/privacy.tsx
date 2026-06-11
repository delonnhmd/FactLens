import { useMemo } from "react";
import { SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { Header } from "../../components/Header";
import type { AppTheme } from "../../context/DisplaySettingsContext";
import { useAppTheme } from "../../hooks/useTheme";

export default function PrivacyScreen() {
  const router = useRouter();
  const appTheme = useAppTheme();
  const styles = useMemo(() => createStyles(appTheme), [appTheme]);

  return (
    <SafeAreaView style={styles.container}>
      <Header title="Privacy Policy" subtitle="How Verifact handles account data" />
      <ScrollView contentContainerStyle={styles.content} contentInsetAdjustmentBehavior="automatic">
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.8} accessibilityRole="button">
          <Text style={styles.link}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.heading}>Account Data</Text>
        <Text style={styles.body}>
          Verifact uses account, profile, claim, vote, report, and evidence information to run community verification
          features and protect launch safety.
        </Text>
        <Text style={styles.heading}>Public Contributions</Text>
        <Text style={styles.body}>
          Claims, votes, evidence, rankings, and public profile details may be visible to other users as part of the
          verification experience.
        </Text>
        <Text style={styles.heading}>Safety and Support</Text>
        <Text style={styles.body}>
          Reports and moderation signals may be reviewed to prevent spam, harassment, unsafe content, and abuse.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    container: { backgroundColor: theme.colors.card, flex: 1 },
    content: { padding: 14, paddingBottom: 28 },
    link: { color: theme.colors.link, fontSize: theme.typography.body.fontSize, fontWeight: "500", marginBottom: 14 },
    heading: { color: theme.colors.text, fontSize: theme.typography.body.fontSize, fontWeight: "500", marginBottom: 8, marginTop: 10 },
    body: { color: theme.colors.subtext, fontSize: theme.typography.small.fontSize, lineHeight: theme.typography.body.lineHeight },
  });
}
