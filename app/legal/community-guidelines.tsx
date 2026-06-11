// PHASE 5 STEP 2
import { useMemo } from "react";
import { SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { Header } from "../../components/Header";
import type { AppTheme } from "../../context/DisplaySettingsContext";
import { useAppTheme } from "../../hooks/useTheme";

const rules = [
  "Post claims and evidence in good faith.",
  "Do not post nude, porn, sexually explicit, abusive, hateful, or harmful content.",
  "Do not use Verifact for spam, scams, harassment, threats, or coordinated manipulation.",
  "Do not submit malicious evidence or sources designed to mislead users.",
  "Report content that appears unsafe, abusive, explicit, spammy, or manipulative.",
];

export default function CommunityGuidelinesScreen() {
  const router = useRouter();
  const appTheme = useAppTheme();
  const styles = useMemo(() => createStyles(appTheme), [appTheme]);

  return (
    <SafeAreaView style={styles.container}>
      <Header title="Community Guidelines" subtitle="Public launch safety rules" />
      <ScrollView contentContainerStyle={styles.content} contentInsetAdjustmentBehavior="automatic">
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.8} accessibilityRole="button">
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

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    container: { backgroundColor: theme.colors.card, flex: 1 },
    content: { gap: 10, padding: 14, paddingBottom: 28 },
    link: { color: theme.colors.link, fontSize: theme.typography.body.fontSize, fontWeight: "500", marginBottom: 4 },
    rule: {
      backgroundColor: theme.colors.background,
      borderColor: theme.colors.lightBorder,
      borderRadius: theme.radius.sm,
      borderWidth: theme.borderWidth,
      color: theme.colors.text,
      fontSize: theme.typography.small.fontSize,
      lineHeight: theme.typography.body.lineHeight,
      padding: 12,
    },
  });
}
