import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Platform, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Linking from "expo-linking";
import { useLocalSearchParams, useRouter } from "expo-router";
import { theme } from "../../constants/theme";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../lib/supabase";

type CallbackStatus = "loading" | "success" | "error";

interface AuthCallbackParams {
  code: string;
  accessToken: string;
  refreshToken: string;
  error: string;
}

function getStringParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function getCurrentUrl(linkingUrl: string | null): string {
  if (Platform.OS === "web" && typeof window !== "undefined") {
    return window.location.href;
  }

  return linkingUrl ?? "";
}

function readUrlParams(url: string): AuthCallbackParams {
  if (!url) {
    return { code: "", accessToken: "", refreshToken: "", error: "" };
  }

  try {
    const parsedUrl = new URL(url);
    const searchParams = parsedUrl.searchParams;
    const hashParams = new URLSearchParams(parsedUrl.hash.replace(/^#/, ""));

    return {
      code: searchParams.get("code") ?? hashParams.get("code") ?? "",
      accessToken: searchParams.get("access_token") ?? hashParams.get("access_token") ?? "",
      refreshToken: searchParams.get("refresh_token") ?? hashParams.get("refresh_token") ?? "",
      error:
        searchParams.get("error_description") ??
        hashParams.get("error_description") ??
        searchParams.get("error") ??
        hashParams.get("error") ??
        "",
    };
  } catch {
    return { code: "", accessToken: "", refreshToken: "", error: "" };
  }
}

function clearSensitiveWebUrl(status: CallbackStatus) {
  if (Platform.OS !== "web" || typeof window === "undefined" || !window.history?.replaceState) {
    return;
  }

  const nextPath = status === "success" ? "/auth/confirmed" : "/auth/callback";
  window.history.replaceState(null, "", nextPath);
}

function getFriendlyCallbackError(message: string): string {
  const normalizedMessage = message.toLowerCase();

  if (normalizedMessage.includes("expired")) {
    return "This verification link has expired. Request a new verification email and try again.";
  }

  if (normalizedMessage.includes("invalid") || normalizedMessage.includes("token")) {
    return "This verification link is no longer valid. Request a new verification email and try again.";
  }

  if (normalizedMessage.includes("already")) {
    return "This email may already be verified. Continue to login to access Verifact.";
  }

  return "Could not verify this email link. Request a new verification email and try again.";
}

export default function AuthCallbackScreen() {
  const router = useRouter();
  const routeParams = useLocalSearchParams();
  const linkingUrl = Linking.useURL();
  const currentUrl = getCurrentUrl(linkingUrl);
  const [status, setStatus] = useState<CallbackStatus>("loading");
  const [message, setMessage] = useState("Verifying your email...");
  const { refreshUser } = useAuth();

  const authParams = useMemo(() => {
    const parsedParams = readUrlParams(currentUrl);

    return {
      code: getStringParam(routeParams.code) || parsedParams.code,
      accessToken: getStringParam(routeParams.access_token) || parsedParams.accessToken,
      refreshToken: getStringParam(routeParams.refresh_token) || parsedParams.refreshToken,
      error:
        getStringParam(routeParams.error_description) ||
        getStringParam(routeParams.error) ||
        parsedParams.error,
    };
  }, [currentUrl, routeParams.access_token, routeParams.code, routeParams.error, routeParams.error_description, routeParams.refresh_token]);

  useEffect(() => {
    let mounted = true;

    async function verifyEmail() {
      setStatus("loading");
      setMessage("Verifying your email...");

      try {
        if (authParams.error) {
          throw new Error(authParams.error);
        }

        if (authParams.code) {
          const { error } = await supabase.auth.exchangeCodeForSession(authParams.code);

          if (error) {
            throw error;
          }
        } else if (authParams.accessToken && authParams.refreshToken) {
          const { error } = await supabase.auth.setSession({
            access_token: authParams.accessToken,
            refresh_token: authParams.refreshToken,
          });

          if (error) {
            throw error;
          }
        } else {
          const { data } = await supabase.auth.getSession();

          if (!data.session) {
            if (mounted) {
              clearSensitiveWebUrl("success");
              setStatus("success");
              setMessage("Your account has been verified successfully. You can now return to Verifact and sign in.");
            }
            return;
          }
        }

        await refreshUser();

        if (!mounted) {
          return;
        }

        clearSensitiveWebUrl("success");
        setStatus("success");
        setMessage("Your account has been verified successfully. You can now return to Verifact and sign in.");
      } catch (error) {
        if (!mounted) {
          return;
        }

        clearSensitiveWebUrl("error");
        setStatus("error");
        setMessage(getFriendlyCallbackError(error instanceof Error ? error.message : ""));
      }
    }

    void verifyEmail();

    return () => {
      mounted = false;
    };
  }, [authParams.accessToken, authParams.code, authParams.error, authParams.refreshToken, refreshUser]);

  const handleContinueToLogin = async () => {
    await supabase.auth.signOut();
    router.replace("/auth");
  };

  const title =
    status === "loading" ? "Verifying your email..." : status === "success" ? "Email verified successfully" : "Verification link problem";
  const iconName = status === "success" ? "checkmark-circle-outline" : status === "error" ? "alert-circle-outline" : "shield-checkmark-outline";
  const iconColor = status === "error" ? theme.colors.danger : theme.colors.primary;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.card}>
        <View style={[styles.iconWrap, status === "error" && styles.iconWrapError]}>
          {status === "loading" ? (
            <ActivityIndicator color={theme.colors.primary} />
          ) : (
            <Ionicons name={iconName} size={36} color={iconColor} />
          )}
        </View>

        <Text style={styles.title}>{title}</Text>
        <Text style={styles.body}>{message}</Text>

        {status !== "loading" ? (
          <View style={styles.actions}>
            <TouchableOpacity style={styles.button} activeOpacity={0.85} onPress={handleContinueToLogin}>
              <Text style={styles.buttonText}>Continue to Login</Text>
            </TouchableOpacity>
          </View>
        ) : null}
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
    height: 70,
    justifyContent: "center",
    marginBottom: theme.spacing.md,
    width: 70,
  },
  iconWrapError: {
    backgroundColor: theme.colors.dangerBg,
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
  actions: {
    alignSelf: "stretch",
    gap: theme.spacing.sm,
  },
  button: {
    alignItems: "center",
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
