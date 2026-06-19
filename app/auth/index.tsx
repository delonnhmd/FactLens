// PHASE 3 STEP 1
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { Header } from "../../components/Header";
import { RESET_PASSWORD_URL } from "../../constants/launchConfig";
import { theme } from "../../constants/theme";
import { useAuth } from "../../context/AuthContext";
import { supabase, supabaseConfigError } from "../../lib/supabase";
import { checkUsernameAvailability } from "../../services/profileService";
import { getUsernameValidationError } from "../../utils/username";

type AuthMode = "LOGIN" | "SIGN_UP";
type UsernameAvailabilityStatus = "idle" | "checking" | "available" | "unavailable" | "invalid";

export default function AuthScreen() {
  const router = useRouter();
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<AuthMode>("LOGIN");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetModalVisible, setResetModalVisible] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [resetMessage, setResetMessage] = useState("");
  const [resetError, setResetError] = useState("");
  const [usernameAvailabilityStatus, setUsernameAvailabilityStatus] = useState<UsernameAvailabilityStatus>("idle");
  const [usernameAvailabilityMessage, setUsernameAvailabilityMessage] = useState("");

  const signingUp = mode === "SIGN_UP";
  const usernameSubmitBlocked =
    signingUp &&
    (!username.trim() ||
      usernameAvailabilityStatus === "checking" ||
      usernameAvailabilityStatus === "unavailable" ||
      usernameAvailabilityStatus === "invalid");
  const submitDisabled = loading || usernameSubmitBlocked;

  useEffect(() => {
    if (!signingUp) {
      setUsernameAvailabilityStatus("idle");
      setUsernameAvailabilityMessage("");
      return;
    }

    if (!username.trim()) {
      setUsernameAvailabilityStatus("idle");
      setUsernameAvailabilityMessage("");
      return;
    }

    const validationError = getUsernameValidationError(username);

    if (validationError) {
      setUsernameAvailabilityStatus("invalid");
      setUsernameAvailabilityMessage(validationError);
      return;
    }

    let active = true;
    setUsernameAvailabilityStatus("checking");
    setUsernameAvailabilityMessage("Checking username...");

    const timer = setTimeout(() => {
      checkUsernameAvailability(username)
        .then((result) => {
          if (!active) {
            return;
          }

          if (result.available) {
            setUsernameAvailabilityStatus("available");
            setUsernameAvailabilityMessage("Username available");
            return;
          }

          setUsernameAvailabilityStatus("unavailable");
          setUsernameAvailabilityMessage(result.error ?? "Username already taken");
        })
        .catch(() => {
          if (!active) {
            return;
          }

          setUsernameAvailabilityStatus("unavailable");
          setUsernameAvailabilityMessage("Could not check username availability right now.");
        });
    }, 450);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [signingUp, username]);

  const handleSubmit = async () => {
    setError("");
    setMessage("");

    if (!email.trim()) {
      setError("Email is required.");
      return;
    }

    if (!password) {
      setError("Password is required.");
      return;
    }

    if (signingUp && !username.trim()) {
      setError("Username is required.");
      return;
    }

    if (signingUp) {
      const usernameValidationError = getUsernameValidationError(username);

      if (usernameValidationError) {
        setError(usernameValidationError);
        return;
      }

      const availability = await checkUsernameAvailability(username);

      if (!availability.available) {
        setError(availability.error ?? "Username is already taken");
        return;
      }
    }

    setLoading(true);
    const result = signingUp ? await signUp(email, password, username) : await signIn(email, password);
    setLoading(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    if (signingUp) {
      router.replace({
        pathname: "/auth/verify-email",
        params: { email: email.trim().toLowerCase() },
      });
      return;
    }

    router.replace("/");
  };

  const toggleMode = () => {
    setMode((currentMode) => (currentMode === "LOGIN" ? "SIGN_UP" : "LOGIN"));
    setError("");
    setMessage("");
  };

  const openResetModal = () => {
    setResetEmail(email.trim().toLowerCase());
    setResetError("");
    setResetMessage("");
    setResetModalVisible(true);
  };

  const closeResetModal = () => {
    if (resetLoading) {
      return;
    }

    setResetModalVisible(false);
    setResetError("");
    setResetMessage("");
  };

  const handleSendPasswordReset = async () => {
    setResetError("");
    setResetMessage("");

    const trimmedEmail = resetEmail.trim();

    if (!trimmedEmail || supabaseConfigError) {
      setResetError("We could not send the reset email. Please try again.");
      return;
    }

    try {
      setResetLoading(true);
      const { error: resetPasswordError } = await supabase.auth.resetPasswordForEmail(trimmedEmail, {
        redirectTo: RESET_PASSWORD_URL,
      });

      if (resetPasswordError) {
        setResetError("We could not send the reset email. Please try again.");
        return;
      }

      setResetMessage("Password reset email sent. Please check your inbox.");
    } catch {
      setResetError("We could not send the reset email. Please try again.");
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Header title="Verifact Account" subtitle="Log in or create a verified account" />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <Text style={styles.title}>{signingUp ? "Create account" : "Log in"}</Text>
          <Text style={styles.subtitle}>
            {signingUp
              ? "Check your inbox and spam folder for the Verifact verification email. After verifying your email, return here and sign in."
              : "Log in to post claims and manage your Verifact account."}
          </Text>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor={theme.colors.muted}
              style={styles.input}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Password</Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="Password"
              placeholderTextColor={theme.colors.muted}
              style={styles.input}
              secureTextEntry
            />
          </View>

          {!signingUp ? (
            <TouchableOpacity
              style={styles.forgotButton}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessible
              accessibilityLabel="Reset your password"
              onPress={openResetModal}
            >
              <Text style={styles.forgotButtonText}>Forgot your password?</Text>
            </TouchableOpacity>
          ) : null}

          {signingUp ? (
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Username</Text>
              <TextInput
                value={username}
                onChangeText={setUsername}
                placeholder="your_username"
                placeholderTextColor={theme.colors.muted}
                style={styles.input}
                autoCapitalize="none"
                autoCorrect={false}
                maxLength={20}
              />
              {usernameAvailabilityMessage ? (
                <Text
                  style={[
                    styles.availabilityText,
                    usernameAvailabilityStatus === "available" ? styles.availableText : styles.unavailableText,
                  ]}
                >
                  {usernameAvailabilityMessage}
                </Text>
              ) : null}
            </View>
          ) : null}

          {error ? <Text style={styles.errorText}>{error}</Text> : null}
          {message ? <Text style={styles.messageText}>{message}</Text> : null}

          <TouchableOpacity
            style={[styles.button, submitDisabled && styles.buttonDisabled]}
            activeOpacity={0.8}
            disabled={submitDisabled}
            onPress={handleSubmit}
          >
            <Text style={styles.buttonText}>
              {loading ? "Please wait..." : signingUp ? "Sign Up" : "Log In"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.secondaryButton} activeOpacity={0.8} onPress={toggleMode}>
            <Text style={styles.secondaryButtonText}>
              {signingUp ? "Already have an account? Log in" : "Need an account? Sign up"}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <Modal visible={resetModalVisible} animationType="fade" transparent onRequestClose={closeResetModal}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.modalOverlay}
        >
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Reset your password</Text>
            <Text style={styles.modalBody}>
              Enter the email address on your Verifact account and we will send a reset link.
            </Text>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                value={resetEmail}
                onChangeText={setResetEmail}
                placeholder="you@example.com"
                placeholderTextColor={theme.colors.muted}
                style={styles.input}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                editable={!resetLoading}
              />
            </View>

            {resetError ? <Text style={styles.errorText}>{resetError}</Text> : null}
            {resetMessage ? <Text style={styles.messageText}>{resetMessage}</Text> : null}

            <TouchableOpacity
              style={[styles.button, resetLoading && styles.buttonDisabled]}
              activeOpacity={0.8}
              disabled={resetLoading}
              onPress={handleSendPasswordReset}
            >
              {resetLoading ? <ActivityIndicator color={theme.colors.background} /> : null}
              <Text style={styles.buttonText}>{resetLoading ? "Sending..." : "Send reset email"}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.secondaryButton} activeOpacity={0.8} onPress={closeResetModal}>
              <Text style={styles.secondaryButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.card,
  },
  content: {
    padding: theme.spacing.lg,
  },
  card: {
    backgroundColor: theme.colors.background,
    borderColor: theme.colors.lightBorder,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    padding: theme.spacing.lg,
    ...theme.shadows.light,
  },
  title: {
    color: theme.colors.text,
    fontSize: theme.typography.largeTitle.fontSize,
    fontWeight: "500",
    marginBottom: theme.spacing.sm,
  },
  subtitle: {
    color: theme.colors.subtext,
    fontSize: theme.typography.body.fontSize,
    lineHeight: theme.typography.body.lineHeight,
    marginBottom: theme.spacing.lg,
  },
  fieldGroup: {
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
  forgotButton: {
    alignItems: "flex-end",
    alignSelf: "stretch",
    marginBottom: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
  },
  forgotButtonText: {
    color: theme.colors.link,
    fontSize: theme.typography.small.fontSize,
    fontWeight: "500",
    textAlign: "right",
  },
  errorText: {
    color: theme.colors.danger,
    fontSize: theme.typography.small.fontSize,
    fontWeight: "500",
    marginBottom: theme.spacing.md,
  },
  messageText: {
    color: theme.colors.success,
    fontSize: theme.typography.small.fontSize,
    fontWeight: "500",
    marginBottom: theme.spacing.md,
  },
  availabilityText: {
    fontSize: theme.typography.small.fontSize,
    fontWeight: "500",
    marginTop: theme.spacing.sm,
  },
  availableText: {
    color: theme.colors.success,
  },
  unavailableText: {
    color: theme.colors.danger,
  },
  button: {
    alignItems: "center",
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.sm,
    flexDirection: "row",
    gap: theme.spacing.sm,
    justifyContent: "center",
    paddingVertical: theme.spacing.md,
  },
  buttonDisabled: {
    backgroundColor: theme.colors.muted,
  },
  buttonText: {
    color: theme.colors.background,
    fontSize: theme.typography.body.fontSize,
    fontWeight: "500",
  },
  secondaryButton: {
    alignItems: "center",
    marginTop: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  secondaryButtonText: {
    color: theme.colors.primary,
    fontSize: theme.typography.small.fontSize,
    fontWeight: "500",
  },
  modalOverlay: {
    alignItems: "center",
    backgroundColor: "rgba(15, 23, 42, 0.48)",
    flex: 1,
    justifyContent: "center",
    padding: theme.spacing.lg,
  },
  modalCard: {
    backgroundColor: theme.colors.background,
    borderColor: theme.colors.lightBorder,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    maxWidth: 440,
    padding: theme.spacing.lg,
    width: "100%",
    ...theme.shadows.light,
  },
  modalTitle: {
    color: theme.colors.text,
    fontSize: theme.typography.title.fontSize,
    fontWeight: "500",
    lineHeight: theme.typography.title.lineHeight,
    marginBottom: theme.spacing.sm,
  },
  modalBody: {
    color: theme.colors.subtext,
    fontSize: theme.typography.body.fontSize,
    lineHeight: theme.typography.body.lineHeight,
    marginBottom: theme.spacing.lg,
  },
});
