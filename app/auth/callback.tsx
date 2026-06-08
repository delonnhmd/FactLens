import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Platform, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
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
              setStatus("success");
              setMessage("Email verified. You can return to FactLens.");
            }
            return;
          }
        }

        await refreshUser();

        if (!mounted) {
          return;
        }

        setStatus("success");
        setMessage("Email verified. Opening FactLens...");
        setTimeout(() => {
          router.replace("/");
        }, 700);
      } catch {
        if (!mounted) {
          return;
        }

        setStatus("error");
        setMessage("Could not verify this email link. Open FactLens and try logging in again.");
      }
    }

    void verifyEmail();

    return () => {
      mounted = false;
    };
  }, [authParams.accessToken, authParams.code, authParams.error, authParams.refreshToken, refreshUser, router]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.card}>
        {status === "loading" ? <ActivityIndicator color={theme.colors.primary} /> : null}
        <Text style={styles.title}>{status === "loading" ? "Verifying your email..." : message}</Text>
        {status !== "loading" ? (
          <TouchableOpacity style={styles.button} activeOpacity={0.85} onPress={() => router.replace("/")}>
            <Text style={styles.buttonText}>Open FactLens</Text>
          </TouchableOpacity>
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
    padding: 20,
  },
  card: {
    alignItems: "center",
    backgroundColor: theme.colors.background,
    borderColor: theme.colors.lightBorder,
    borderRadius: theme.radius.md,
    borderWidth: 0.5,
    gap: 14,
    maxWidth: 420,
    padding: 20,
    width: "100%",
  },
  title: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: "500",
    lineHeight: 22,
    textAlign: "center",
  },
  button: {
    alignItems: "center",
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.sm,
    paddingHorizontal: 16,
    paddingVertical: 11,
  },
  buttonText: {
    color: theme.colors.background,
    fontSize: 14,
    fontWeight: "500",
  },
});
