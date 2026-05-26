// PHASE 1 STEP 1
import { Ionicons } from "@expo/vector-icons";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { View, StyleSheet } from "react-native";
import { AuthProvider } from "../context/AuthContext";
import { ClaimsProvider } from "../context/ClaimsContext";

export default function Layout() {
  const [fontsLoaded] = useFonts({
    ...Ionicons.font,
  });

  if (!fontsLoaded) {
    return null;
  }

  return (
    <AuthProvider>
      <ClaimsProvider>
        <View style={styles.root}>
          <StatusBar style="auto" />
          <Stack screenOptions={{ headerShown: false }} />
        </View>
      </ClaimsProvider>
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
});
