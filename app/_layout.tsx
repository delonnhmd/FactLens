// PHASE 1 STEP 1
// PHASE 3 STEP 29
import "../utils/productionConsole";
import { Ionicons } from "@expo/vector-icons";
import { useFonts } from "expo-font";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Loading } from "../components/Loading";
import { AuthProvider, useAuth } from "../context/AuthContext";
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
  const { isAuthenticated, loading } = useAuth();
  const appTheme = useAppTheme();
  const router = useRouter();
  const segments = useSegments();
  const routeSegments = [...segments] as string[];
  const firstSegment = routeSegments[0] ?? "";
  const secondSegment = routeSegments[1] ?? "";
  const routeKey = routeSegments.join("/");
  const inAuthFlow = firstSegment === "auth" || firstSegment === "callback";
  const inAuthCallback = firstSegment === "callback" || (firstSegment === "auth" && secondSegment === "callback");
  const inPublicFlow =
    inAuthFlow || firstSegment === "legal" || firstSegment === "profile" || firstSegment === "+not-found";
  const shouldRouteToLogin = !loading && !isAuthenticated && !inPublicFlow;
  const shouldRouteToHome = !loading && isAuthenticated && firstSegment === "auth" && !inAuthCallback;

  useEffect(() => {
    if (shouldRouteToLogin) {
      router.replace("/auth");
      return;
    }

    if (shouldRouteToHome) {
      router.replace("/");
    }
  }, [routeKey, router, shouldRouteToHome, shouldRouteToLogin]);

  return (
    <View style={{ flex: 1, backgroundColor: appTheme.colors.card }}>
      <StatusBar style={appTheme.isDark ? "light" : "dark"} />
      {loading || shouldRouteToLogin || shouldRouteToHome ? (
        <Loading />
      ) : (
        <Stack screenOptions={{ headerShown: false }} />
      )}
    </View>
  );
}
