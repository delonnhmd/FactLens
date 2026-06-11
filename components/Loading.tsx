// PHASE 1 STEP 4
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { useMemo } from "react";
import type { AppTheme } from "../context/DisplaySettingsContext";
import { useAppTheme } from "../hooks/useTheme";

export function Loading() {
  const appTheme = useAppTheme();
  const styles = useMemo(() => createStyles(appTheme), [appTheme]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={appTheme.colors.primary} />
    </View>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: theme.colors.background,
  },
  });
}
