// PHASE 5 STEP 2
// APPLE GUIDELINE 1.2 — screen now renders the full TERMS_TEXT EULA
// (constants/termsText.ts) with zero-tolerance + 24-hour moderation
// language required by App Review. Screen structure/styles unchanged.
// JS-only change. Deploy: eas update --channel preview
// Do NOT run eas build. Apple review response pending.
// Backend deploys to Render independently.
import { useMemo } from "react";
import { SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { Header } from "../../components/Header";
import { TERMS_TEXT } from "../../constants/termsText";
import type { AppTheme } from "../../context/DisplaySettingsContext";
import { useAppTheme } from "../../hooks/useTheme";

export default function TermsScreen() {
  const router = useRouter();
  const appTheme = useAppTheme();
  const styles = useMemo(() => createStyles(appTheme), [appTheme]);

  return (
    <SafeAreaView style={styles.container}>
      <Header title="Terms of Use" subtitle="Verifact Terms of Use (EULA)" />
      <ScrollView contentContainerStyle={styles.content} contentInsetAdjustmentBehavior="automatic">
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.8} accessibilityRole="button">
          <Text style={styles.link}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.body}>{TERMS_TEXT}</Text>
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
