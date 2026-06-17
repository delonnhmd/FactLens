import { SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { theme } from "../../constants/theme";
import { supabase } from "../../lib/supabase";

export default function AuthConfirmedScreen() {
  const router = useRouter();

  const handleContinueToLogin = async () => {
    await supabase.auth.signOut();
    router.replace("/auth");
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.card}>
        <View style={styles.iconWrap}>
          <Ionicons name="checkmark-circle-outline" size={38} color={theme.colors.primary} />
        </View>
        <Text style={styles.title}>Email verified successfully</Text>
        <Text style={styles.body}>
          Your account has been verified successfully. You can now return to Verifact and sign in.
        </Text>
        <TouchableOpacity style={styles.button} activeOpacity={0.85} onPress={handleContinueToLogin}>
          <Text style={styles.buttonText}>Continue to Login</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    backgroundColor: theme.colors.card,
    flex: 1,
    justifyContent: "center",
    padding: theme.spacing.lg,
  },
  card: {
    alignItems: "center",
    backgroundColor: theme.colors.background,
    borderColor: theme.colors.lightBorder,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    maxWidth: 440,
    padding: theme.spacing.lg,
    width: "100%",
    ...theme.shadows.light,
  },
  iconWrap: {
    alignItems: "center",
    backgroundColor: theme.colors.sourceBg,
    borderRadius: 999,
    height: 72,
    justifyContent: "center",
    marginBottom: theme.spacing.md,
    width: 72,
  },
  title: {
    color: theme.colors.text,
    fontSize: theme.typography.title.fontSize,
    fontWeight: "500",
    lineHeight: theme.typography.title.lineHeight,
    marginBottom: theme.spacing.sm,
    textAlign: "center",
  },
  body: {
    color: theme.colors.subtext,
    fontSize: theme.typography.body.fontSize,
    lineHeight: theme.typography.body.lineHeight,
    marginBottom: theme.spacing.lg,
    textAlign: "center",
  },
  button: {
    alignItems: "center",
    alignSelf: "stretch",
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.sm,
    minHeight: 48,
    justifyContent: "center",
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
  },
  buttonText: {
    color: theme.colors.background,
    fontSize: theme.typography.body.fontSize,
    fontWeight: "500",
  },
});
