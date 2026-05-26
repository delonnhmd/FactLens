// PHASE 1 STEP 1
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { View, StyleSheet } from "react-native";
import { ClaimsProvider } from "../context/ClaimsContext";

export default function Layout() {
  // PHASE 2 STEP 2
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
