import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, SafeAreaView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { AUTH_CALLBACK_URL } from "../../constants/launchConfig";
import { theme } from "../../constants/theme";
import { supabase, supabaseConfigError } from "../../lib/supabase";

const RESEND_COOLDOWN_SECONDS = 60;

function getStringParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function getFriendlyResendError(message: string): string {
  const normalizedMessage = message.toLowerCase();

  if (normalizedMessage.includes("rate limit") || normalizedMessage.includes("too many")) {
    return "Please wait a moment before sending another verification email.";
  }

  if (normalizedMessage.includes("invalid") || normalizedMessage.includes("email")) {
    return "Enter the email address you used to create your account.";
  }

  return "Could not resend the verification email right now.";
}

export default function VerifyEmailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const initialEmail = useMemo(() => getStringParam(params.email).trim().toLowerCase(), [params.email]);
  const [email, setEmail] = useState(initialEmail);
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_SECONDS);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("After verifying your email, return here and sign in.");
  const [error, setError] = useState("");

  useEffect(() => {
    if (cooldown <= 0) {
      return;
    }

    const timer = setTimeout(() => {
      setCooldown((currentValue) => Math.max(0, currentValue - 1));
    }, 1000);

    return () => clearTimeout(timer);
  }, [cooldown]);

  const resendDisabled = loading || cooldown > 0 || !email.trim();

  const handleResend = async () => {
    setError("");
    setMessage("");

    if (supabaseConfigError) {
      setError("Unable to connect to account services right now. Please try again shortly.");
      return;
    }

    const trimmedEmail = email.trim().toLowerCase();

    if (!trimmedEmail) {
      setError("Enter the email address you used to create your account.");
      return;
    }

    setLoading(true);
    const { error: resendError } = await supabase.auth.resend({
      type: "signup",
      email: trimmedEmail,
      options: {
        emailRedirectTo: AUTH_CALLBACK_URL,
      },
    });
    setLoading(false);

    if (resendError) {
      setError(getFriendlyResendError(resendError.message));
      return;
    }

    setCooldown(RESEND_COOLDOWN_SECONDS);
    setMessage("Verification email sent. Check your inbox and spam folder for the Verifact verification email.");
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.card}>
        <View style={styles.iconWrap}>
          <Ionicons name="mail-outline" size={34} color={theme.colors.primary} />
        </View>
        <Text style={styles.title}>Verify your email</Text>
        <Text style={styles.body}>
          Check your inbox and spam folder for the Verifact verification email.
        </Text>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Email address</Text>
          <TextInput
            value={email}
            onChangeText={(nextEmail) => setEmail(nextEmail.trim().toLowerCase())}
            placeholder="you@example.com"
            placeholderTextColor={theme.colors.muted}
            style={styles.input}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        {message ? <Text style={styles.messageText}>{message}</Text> : null}

        <TouchableOpacity
          style={[styles.button, resendDisabled && styles.buttonDisabled]}
          activeOpacity={0.85}
          disabled={resendDisabled}
          onPress={handleResend}
        >
          {loading ? <ActivityIndicator color={theme.colors.background} /> : null}
          <Text style={styles.buttonText}>
            {cooldown > 0 ? `Resend verification in ${cooldown}s` : "Resend verification email"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.secondaryButton} activeOpacity={0.85} onPress={() => router.replace("/auth")}>
          <Text style={styles.secondaryButtonText}>Back to login</Text>
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
    height: 68,
    justifyContent: "center",
    marginBottom: theme.spacing.md,
    width: 68,
  },
  title: {
    color: theme.colors.text,
    fontSize: theme.typography.largeTitle.fontSize,
    fontWeight: "500",
    lineHeight: theme.typography.largeTitle.lineHeight,
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
  fieldGroup: {
    alignSelf: "stretch",
    marginBottom: theme.spacing.md,
  },
  label: {
    color: theme.colors.text,
    fontSize: theme.typography.small.fontSize,
    fontWeight: "500",
    marginBottom: theme.spacing.sm,
  },
  input: {
    backgroundColor: theme.colors.background,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    color: theme.colors.text,
    fontSize: theme.typography.body.fontSize,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
  },
  errorText: {
    alignSelf: "stretch",
    color: theme.colors.danger,
    fontSize: theme.typography.small.fontSize,
    fontWeight: "500",
    marginBottom: theme.spacing.md,
  },
  messageText: {
    alignSelf: "stretch",
    color: theme.colors.success,
    fontSize: theme.typography.small.fontSize,
    fontWeight: "500",
    marginBottom: theme.spacing.md,
  },
  button: {
    alignItems: "center",
    alignSelf: "stretch",
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.sm,
    flexDirection: "row",
    gap: theme.spacing.sm,
    justifyContent: "center",
    minHeight: 50,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
  },
  buttonDisabled: {
    backgroundColor: theme.colors.muted,
  },
  buttonText: {
    color: theme.colors.background,
    fontSize: theme.typography.body.fontSize,
    fontWeight: "500",
    textAlign: "center",
  },
  secondaryButton: {
    marginTop: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  secondaryButtonText: {
    color: theme.colors.primary,
    fontSize: theme.typography.small.fontSize,
    fontWeight: "500",
  },
});
