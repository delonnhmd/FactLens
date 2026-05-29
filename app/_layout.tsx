// PHASE 1 STEP 1
import { Ionicons } from "@expo/vector-icons";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { View, StyleSheet } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider } from "../context/AuthContext";
import { ClaimsProvider } from "../context/ClaimsContext";
import { setupAndroidNavigationBar } from "../utils/androidNavigationBar";

export default function Layout() {
  const [fontsLoaded] = useFonts({
    ...Ionicons.font,
  });

  // PHASE 3 STEP 23
  useEffect(() => {
    setupAndroidNavigationBar();
  }, []);

  if (!fontsLoaded) {
    return null;
  }

  // PHASE 3 STEP 20
  // PHASE 3 STEP 21
  // PHASE 3 STEP 23
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <ClaimsProvider>
          <View style={styles.root}>
            <StatusBar style="auto" />
            <Stack screenOptions={{ headerShown: false }} />
          </View>
        </ClaimsProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
});
