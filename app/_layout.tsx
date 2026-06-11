// PHASE 1 STEP 1
// PHASE 3 STEP 29
import "../utils/productionConsole";
import { Ionicons } from "@expo/vector-icons";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider } from "../context/AuthContext";
import { ClaimsProvider } from "../context/ClaimsContext";
import { DisplaySettingsProvider } from "../context/DisplaySettingsContext";
import { useAppTheme } from "../hooks/useTheme";
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
      <DisplaySettingsProvider>
        <AuthProvider>
          <ClaimsProvider>
            <RootStack />
          </ClaimsProvider>
        </AuthProvider>
      </DisplaySettingsProvider>
    </SafeAreaProvider>
  );
}

function RootStack() {
  const appTheme = useAppTheme();

  return (
    <View style={{ flex: 1, backgroundColor: appTheme.colors.card }}>
      <StatusBar style={appTheme.isDark ? "light" : "dark"} />
      <Stack screenOptions={{ headerShown: false }} />
    </View>
  );
}
