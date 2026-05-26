// PHASE 1 STEP 1
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { View, StyleSheet } from "react-native";
import { ClaimsProvider } from "../hooks/useClaims";

export default function Layout() {
  return (
    <ClaimsProvider>
      <View style={styles.root}>
        <StatusBar style="auto" />
        <Stack screenOptions={{ headerShown: false }} />
      </View>
    </ClaimsProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
});
