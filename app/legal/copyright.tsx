import { useMemo } from "react";
import { SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { Header } from "../../components/Header";
import type { AppTheme } from "../../context/DisplaySettingsContext";
import { useAppTheme } from "../../hooks/useTheme";

export default function CopyrightScreen() {
  const router = useRouter();
  const appTheme = useAppTheme();
  const styles = useMemo(() => createStyles(appTheme), [appTheme]);

  return (
    <SafeAreaView style={styles.container}>
      <Header title="Copyright" subtitle="Rights and content ownership" />
      <ScrollView contentContainerStyle={styles.content} contentInsetAdjustmentBehavior="automatic">
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.8} accessibilityRole="button">
          <Text style={styles.link}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.heading}>Verifact Materials</Text>
        <Text style={styles.body}>
          Verifact names, interface text, product design, and app materials are protected by their respective owners.
        </Text>
        <Text style={styles.heading}>User Submissions</Text>
        <Text style={styles.body}>
          Users are responsible for the claims, evidence, links, images, and profile content they submit. Submit only
          content you have the right to share.
        </Text>
        <Text style={styles.heading}>Copyright Concerns</Text>
        <Text style={styles.body}>
          If you believe content in Verifact infringes copyright, contact support with the claim details and the
          material you want reviewed.
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
