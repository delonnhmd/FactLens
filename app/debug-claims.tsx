// PHASE 3 STEP 27

import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { Header } from "../components/Header";
import { theme } from "../constants/theme";
import { supabase } from "../lib/supabase";
import { formatErrorForDisplay } from "../utils/debugError";

type DebugState = {
  loading: boolean;
  rowCount: number;
  responseJson: string;
  errorJson: string;
};

export default function DebugClaimsScreen() {
  const router = useRouter();
  const [state, setState] = useState<DebugState>({
    loading: true,
    rowCount: 0,
    responseJson: "",
    errorJson: "",
  });

  const loadClaims = useCallback(async () => {
    setState((current) => ({ ...current, loading: true, errorJson: "" }));

    try {
      const { data, error } = await supabase.from("claims").select("*").limit(5);

      if (error) {
        setState({
          loading: false,
          rowCount: 0,
          responseJson: "",
          errorJson: formatErrorForDisplay(error),
        });
        return;
      }

      setState({
        loading: false,
        rowCount: data?.length ?? 0,
        responseJson: JSON.stringify(data ?? [], null, 2),
        errorJson: "",
      });
    } catch (error) {
      setState({
        loading: false,
        rowCount: 0,
        responseJson: "",
        errorJson: formatErrorForDisplay(error),
      });
    }
  }, []);

  useEffect(() => {
    void loadClaims();
  }, [loadClaims]);

  return (
    <SafeAreaView style={styles.container}>
      <Header title="Claims Debug" subtitle="Raw Supabase claims fetch" />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.actions}>
          <TouchableOpacity style={styles.secondaryButton} activeOpacity={0.8} onPress={() => router.back()}>
            <Text style={styles.secondaryButtonText}>Back</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.button} activeOpacity={0.8} onPress={loadClaims}>
            <Text style={styles.buttonText}>Run Fetch</Text>
          </TouchableOpacity>
        </View>

        {state.loading ? (
          <View style={styles.panel}>
            <ActivityIndicator size="small" color={theme.colors.primary} />
            <Text style={styles.panelText}>Loading claims...</Text>
          </View>
        ) : null}

        <View style={styles.panel}>
          <Text style={styles.label}>Rows returned</Text>
          <Text style={styles.value}>{state.rowCount}</Text>
        </View>

        {state.errorJson ? (
          <View style={styles.errorPanel}>
            <Text style={styles.label}>Error JSON</Text>
            <Text style={styles.mono}>{state.errorJson}</Text>
          </View>
        ) : null}

        <View style={styles.panel}>
          <Text style={styles.label}>Raw response</Text>
          <Text style={styles.mono}>{state.responseJson || "No response data."}</Text>
        </View>
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
    padding: theme.spacing.lg,
  },
  actions: {
    flexDirection: "row",
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  button: {
    alignItems: "center",
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.sm,
    flex: 1,
    paddingVertical: theme.spacing.md,
  },
  buttonText: {
    color: theme.colors.background,
    fontSize: theme.typography.body.fontSize,
    fontWeight: "800",
  },
  secondaryButton: {
    alignItems: "center",
    borderColor: theme.colors.border,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    flex: 1,
    paddingVertical: theme.spacing.md,
  },
  secondaryButtonText: {
    color: theme.colors.text,
    fontSize: theme.typography.body.fontSize,
    fontWeight: "800",
  },
  panel: {
    backgroundColor: theme.colors.background,
    borderColor: theme.colors.lightBorder,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    marginBottom: theme.spacing.md,
    padding: theme.spacing.md,
  },
  errorPanel: {
    backgroundColor: "#FEE2E2",
    borderColor: "#FECACA",
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    marginBottom: theme.spacing.md,
    padding: theme.spacing.md,
  },
  label: {
    color: theme.colors.subtext,
    fontSize: theme.typography.small.fontSize,
    fontWeight: "800",
    marginBottom: theme.spacing.xs,
  },
  value: {
    color: theme.colors.text,
    fontSize: theme.typography.title.fontSize,
    fontWeight: "800",
  },
  panelText: {
    color: theme.colors.subtext,
    fontSize: theme.typography.body.fontSize,
    fontWeight: "700",
    marginTop: theme.spacing.sm,
  },
  mono: {
    color: theme.colors.text,
    fontFamily: "Courier",
    fontSize: 12,
    lineHeight: 18,
  },
});
