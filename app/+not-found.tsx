// PHASE 1 STEP 1
import { Link, Stack } from "expo-router";
import { Text, View, StyleSheet } from "react-native";

export default function NotFound() {
  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: "Page not found" }} />
      <Text style={styles.title}>Oops! Page not found.</Text>
      <Link href="/" style={styles.link}>
        Go back home
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    backgroundColor: "#FFFFFF",
  },
  title: {
    fontSize: 20,
    fontWeight: "600",
    marginBottom: 16,
    color: "#111827",
  },
  link: {
    color: "#2563EB",
    fontSize: 16,
  },
});
