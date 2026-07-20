import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect } from "react";
import { SafeAreaView, StyleSheet, Text, View } from "react-native";

import { Header } from "../../components/Header";
import { theme } from "../../constants/theme";

// Author links historically opened /user/[id]. Keep that route compatible,
// but use the single privacy-safe public profile implementation with the
// Posts / Replies / Evidence / About tabs.
export default function PublicUserForwardScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const userId = Array.isArray(params.id) ? params.id[0] : params.id;

  useEffect(() => {
    if (!userId) return;
    router.replace({
      pathname: "/profile/[slug]",
      params: { slug: userId, userId },
    });
  }, [router, userId]);

  return (
    <SafeAreaView style={styles.container}>
      <Header title="Contributor" subtitle="Public Verifact profile" />
      <View style={styles.card}>
        <Text style={styles.text}>{userId ? "Opening contributor profile..." : "Contributor profile unavailable."}</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: theme.colors.card, flex: 1 },
  card: {
    backgroundColor: theme.colors.background,
    borderColor: theme.colors.lightBorder,
    borderRadius: theme.radius.md,
    borderWidth: 0.5,
    margin: 10,
    padding: 20,
  },
  text: { color: theme.colors.subtext, fontSize: 14, textAlign: "center" },
});
