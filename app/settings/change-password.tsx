import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import type { AppTheme } from "../../context/DisplaySettingsContext";
import { useAuth } from "../../context/AuthContext";
import { useAppTheme } from "../../hooks/useTheme";
import { supabase, supabaseConfigError } from "../../lib/supabase";

// The signup screen delegates password strength to Supabase Auth. The current
// project uses Supabase's six-character minimum, so this screen enforces the
// same rule before making any authentication request.
const PASSWORD_MIN_LENGTH = 6;

export default function ChangePasswordScreen() {
  const router = useRouter();
  const appTheme = useAppTheme();
  const styles = useMemo(() => createStyles(appTheme), [appTheme]);
  const { currentUser } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [updating, setUpdating] = useState(false);

  const handleUpdatePassword = async () => {
    Keyboard.dismiss();
    setErrorMessage("");

    if (!currentPassword || !newPassword || !confirmPassword) {
      setErrorMessage("All password fields are required.");
      return;
    }

    if (newPassword.length < PASSWORD_MIN_LENGTH) {
      setErrorMessage(`New password must be at least ${PASSWORD_MIN_LENGTH} characters.`);
      return;
    }

    if (newPassword === currentPassword) {
      setErrorMessage("New password must be different");
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage("Passwords don't match");
      return;
    }

    const email = currentUser?.email;

    if (!email || supabaseConfigError) {
      setErrorMessage("Your account session is unavailable. Please log in again.");
      return;
    }

    setUpdating(true);

    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password: currentPassword,
      });

      if (signInError) {
        setErrorMessage("Current password is incorrect");
        return;
      }

      const { error } = await supabase.auth.updateUser({ password: newPassword });

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      Alert.alert("Password updated.", undefined, [
        {
          text: "OK",
          onPress: () => router.back(),
        },
      ]);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Password update failed.");
    } finally {
      setUpdating(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerBackButton}
          activeOpacity={0.75}
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Back"
          accessibilityHint="Returns to Settings"
        >
          <Ionicons name="chevron-back" size={22} color={appTheme.colors.chipActiveText} />
          <Text style={styles.headerBackText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Change password</Text>
        <View style={styles.headerButton} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          contentInsetAdjustmentBehavior="automatic"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.formCard}>
            <Text style={styles.introText}>
              Confirm your current password before choosing a new one.
            </Text>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Current password</Text>
              <TextInput
                value={currentPassword}
                onChangeText={setCurrentPassword}
                placeholder="Current password"
                placeholderTextColor={appTheme.colors.muted}
                style={styles.input}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                textContentType="password"
                editable={!updating}
                returnKeyType="next"
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>New password</Text>
              <TextInput
                value={newPassword}
                onChangeText={setNewPassword}
                placeholder="New password"
                placeholderTextColor={appTheme.colors.muted}
                style={styles.input}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                textContentType="password"
                editable={!updating}
                returnKeyType="next"
              />
              <Text style={styles.helperText}>Use at least {PASSWORD_MIN_LENGTH} characters.</Text>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Confirm new password</Text>
              <TextInput
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="Confirm new password"
                placeholderTextColor={appTheme.colors.muted}
                style={styles.input}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                textContentType="password"
                editable={!updating}
                returnKeyType="done"
                onSubmitEditing={handleUpdatePassword}
              />
            </View>

            {errorMessage ? (
              <Text accessibilityLiveRegion="polite" style={styles.errorText}>
                {errorMessage}
              </Text>
            ) : null}

            <TouchableOpacity
              style={[styles.button, updating && styles.buttonDisabled]}
              activeOpacity={0.8}
              disabled={updating}
              onPress={handleUpdatePassword}
              accessibilityRole="button"
              accessibilityLabel="Update password"
              accessibilityState={{ disabled: updating, busy: updating }}
            >
              {updating ? <ActivityIndicator color={appTheme.colors.chipActiveText} /> : null}
              <Text style={styles.buttonText}>{updating ? "Updating..." : "Update password"}</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    container: {
      backgroundColor: theme.colors.card,
      flex: 1,
    },
    keyboardView: {
      flex: 1,
    },
    header: {
      alignItems: "center",
      backgroundColor: theme.colors.navy,
      flexDirection: "row",
      justifyContent: "space-between",
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    headerButton: {
      height: 44,
      width: 44,
    },
    headerBackButton: {
      alignItems: "center",
      flexDirection: "row",
      gap: 2,
      height: 44,
      justifyContent: "center",
      paddingRight: 8,
    },
    headerBackText: {
      color: theme.colors.chipActiveText,
      fontSize: Math.round(16 * (theme.typography.body.fontSize / 16)),
      fontWeight: "500",
    },
    headerTitle: {
      color: theme.colors.chipActiveText,
      fontSize: Math.round(20 * (theme.typography.body.fontSize / 16)),
      fontWeight: "500",
    },
    content: {
      padding: 12,
      paddingBottom: 28,
    },
    formCard: {
      backgroundColor: theme.colors.background,
      borderColor: theme.colors.lightBorder,
      borderRadius: 12,
      borderWidth: theme.borderWidth,
      padding: 14,
    },
    introText: {
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
      borderWidth: theme.borderWidth,
      color: theme.colors.text,
      fontSize: theme.typography.body.fontSize,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.md,
    },
    helperText: {
      color: theme.colors.muted,
      fontSize: theme.typography.small.fontSize,
      marginTop: theme.spacing.sm,
    },
    errorText: {
      color: theme.colors.danger,
      fontSize: theme.typography.small.fontSize,
      fontWeight: "500",
      marginBottom: theme.spacing.md,
    },
    button: {
      alignItems: "center",
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
      color: theme.colors.chipActiveText,
      fontSize: theme.typography.body.fontSize,
      fontWeight: "500",
    },
  });
}
