// PHASE 3 STEP 2
// PHASE 3 STEP 28
// PHASE 3 STEP 29
// PHASE 5 STEP 4
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { Session, User as SupabaseUser } from "@supabase/supabase-js";
import { APP_CONFIG } from "../constants/appConfig";
import { AUTH_CALLBACK_URL } from "../constants/launchConfig";
import { supabase, supabaseConfigError } from "../lib/supabase";
import { ensureProfileForUser, getProfile } from "../services/profileService";
import type { Profile } from "../services/profileService";
import { normalizeUsername } from "../utils/username";

interface AuthActionResult {
  error?: string;
  message?: string;
  profile?: Profile | null;
}

interface AuthContextValue {
  currentUser: SupabaseUser | null;
  profile: Profile | null;
  profileError: string | null;
  session: Session | null;
  isAuthenticated: boolean;
  isVerified: boolean;
  loading: boolean;
  signUp: (email: string, password: string, username: string) => Promise<AuthActionResult>;
  signIn: (email: string, password: string) => Promise<AuthActionResult>;
  signOut: () => Promise<AuthActionResult>;
  refreshUser: () => Promise<AuthActionResult>;
  refreshProfile: () => Promise<AuthActionResult>;
  // PHASE 3 STEP 15
  ensureProfile: () => Promise<AuthActionResult>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);
const CONFIG_UNAVAILABLE_MESSAGE = "Verifact account services are temporarily unavailable.";

function getAuthErrorMessage(message: string, action: "sign-in" | "sign-up" | "sign-out" | "refresh" = "refresh"): string {
  const normalizedMessage = message.toLowerCase();

  if (normalizedMessage.includes("invalid login credentials")) {
    return "Email or password is incorrect.";
  }

  if (normalizedMessage.includes("already registered") || normalizedMessage.includes("already exists")) {
    return "An account with this email may already exist.";
  }

  if (normalizedMessage.includes("password")) {
    return "Please check your password and try again.";
  }

  if (normalizedMessage.includes("rate limit") || normalizedMessage.includes("too many")) {
    return "Too many attempts. Please try again later.";
  }

  if (action === "sign-in") {
    return "Could not sign in right now.";
  }

  if (action === "sign-up") {
    return "Could not create account right now.";
  }

  if (action === "sign-out") {
    return "Could not sign out right now.";
  }

  return "Could not refresh your account right now.";
}

// PHASE 3 STEP 28
function getUserVerified(user: SupabaseUser | null): boolean {
  if (!user) {
    return false;
  }

  return APP_CONFIG.REQUIRE_EMAIL_VERIFICATION ? Boolean(user.email_confirmed_at) : true;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [currentUser, setCurrentUser] = useState<SupabaseUser | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // PHASE 3 STEP 28
  useEffect(() => {
    console.log("[auth] test mode:", APP_CONFIG.TEST_MODE);
    console.log("[auth] require email verification:", APP_CONFIG.REQUIRE_EMAIL_VERIFICATION);
  }, []);

  // PHASE 3 STEP 13
  // PHASE 3 STEP 15
  // PHASE 3 STEP 18C
  // PHASE 3 STEP 22
  const loadProfile = useCallback(async (user: SupabaseUser): Promise<AuthActionResult> => {
    try {
      console.log("[auth] current user id:", user.id);
      console.log("[auth] email confirmed:", Boolean(user.email_confirmed_at));
      const userVerified = getUserVerified(user);

      const existingProfile = await getProfile(user.id);
      console.log("[profile] loaded by id:", existingProfile.profile);
      console.log("[profile] profile verified:", existingProfile.profile?.verified);

      if (existingProfile.profile) {
        if (existingProfile.profile.is_deleted) {
          await supabase.auth.signOut();
          setSession(null);
          setCurrentUser(null);
          setProfile(null);
          setProfileError("This account has been deleted.");
          return { error: "This account has been deleted.", profile: null };
        }

        const profileResult =
          userVerified && !existingProfile.profile.verified
            ? await ensureProfileForUser(user)
            : existingProfile;
        const nextProfile = profileResult.profile
          ? {
              ...profileResult.profile,
              verified: profileResult.profile.verified || userVerified,
            }
          : null;

        setProfile(nextProfile);
        setProfileError(profileResult.error ?? null);
        console.log("[profile] setting profile state:", nextProfile?.id);
        console.log("[profile] ensure profile result:", nextProfile?.id);
        console.log("[profile] ensure result:", nextProfile?.id);

        if (profileResult.error) {
          return { error: profileResult.error, profile: nextProfile };
        }

        return profileResult.message ? { message: profileResult.message, profile: nextProfile } : { profile: nextProfile };
      }

      if (existingProfile.error) {
        setProfile(null);
        setProfileError(existingProfile.error);
        return { error: existingProfile.error };
      }

      const result = await ensureProfileForUser(user);
      const nextProfile = result.profile
        ? {
            ...result.profile,
            verified: result.profile.verified || userVerified,
          }
        : null;

      setProfile(nextProfile);
      setProfileError(result.error ?? null);
      console.log("[profile] setting profile state:", nextProfile?.id);
      console.log("[profile] ensure profile result:", nextProfile?.id);
      console.log("[profile] ensure result:", nextProfile?.id);

      if (result.error) {
        return { error: result.error, profile: nextProfile };
      }

      return result.message ? { message: result.message, profile: nextProfile } : { profile: nextProfile };
    } catch {
      const message = "Could not load your profile right now.";
      setProfile(null);
      setProfileError(message);
      return { error: message, profile: null };
    }
  }, []);

  const applySession = useCallback(
    async (nextSession: Session | null) => {
      const nextUser = nextSession?.user ?? null;
      setSession(nextSession);
      setCurrentUser(nextUser);

      if (nextUser) {
        await loadProfile(nextUser);
        return;
      }

      setProfile(null);
      setProfileError(null);
    },
    [loadProfile],
  );

  useEffect(() => {
    if (supabaseConfigError) {
      setProfileError(CONFIG_UNAVAILABLE_MESSAGE);
      setLoading(false);
      return;
    }

    let mounted = true;

    // PHASE 3 STEP 18C
    supabase.auth
      .getSession()
      .then(async ({ data }) => {
        if (!mounted) {
          return;
        }

        await applySession(data.session);
      })
      .catch(() => {
        if (mounted) {
          setProfileError("Could not load your session right now.");
        }
      })
      .finally(() => {
        if (mounted) {
          setLoading(false);
        }
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (event === "SIGNED_OUT") {
        setSession(null);
        setCurrentUser(null);
        setProfile(null);
        setProfileError(null);
        setLoading(false);
        return;
      }

      void applySession(nextSession).finally(() => setLoading(false));
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [applySession]);

  const refreshProfile = useCallback(async (): Promise<AuthActionResult> => {
    if (!currentUser) {
      return { error: "You must be signed in to load a profile." };
    }

    // PHASE 3 STEP 18C
    return loadProfile(currentUser);
  }, [currentUser, loadProfile]);

  // PHASE 3 STEP 15
  const ensureProfile = useCallback(async (): Promise<AuthActionResult> => refreshProfile(), [refreshProfile]);

  const refreshUser = useCallback(async (): Promise<AuthActionResult> => {
    if (supabaseConfigError) {
      return { error: CONFIG_UNAVAILABLE_MESSAGE };
    }

    const { data, error } = await supabase.auth.getUser();

    if (error) {
      return { error: getAuthErrorMessage(error.message, "refresh") };
    }

    const { data: sessionData } = await supabase.auth.getSession();
    setSession(sessionData.session);
    setCurrentUser(data.user);
    await loadProfile(data.user);
    return {};
  }, [loadProfile]);

  const signUp = useCallback(async (email: string, password: string, username: string): Promise<AuthActionResult> => {
    if (supabaseConfigError) {
      return { error: CONFIG_UNAVAILABLE_MESSAGE };
    }

    const trimmedUsername = normalizeUsername(username);

    if (!trimmedUsername) {
      return { error: "Username must be at least 3 characters." };
    }

    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo: AUTH_CALLBACK_URL,
        data: {
          username: trimmedUsername,
          displayName: username.trim() || trimmedUsername,
        },
      },
    });

    if (error) {
      return { error: getAuthErrorMessage(error.message, "sign-up") };
    }

    const nextUser = data.session?.user ?? data.user ?? null;
    setSession(data.session);
    setCurrentUser(nextUser);

    if (data.user && data.session) {
      const profileResult = await loadProfile(data.user);

      if (profileResult.error) {
        return profileResult;
      }
    } else {
      setProfile(null);
      setProfileError(null);
    }

    return {
      message: APP_CONFIG.REQUIRE_EMAIL_VERIFICATION ? "Check your email to verify your account." : "Account created.",
    };
  }, [loadProfile]);

  const signIn = useCallback(
    async (email: string, password: string): Promise<AuthActionResult> => {
      if (supabaseConfigError) {
        return { error: CONFIG_UNAVAILABLE_MESSAGE };
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        return { error: getAuthErrorMessage(error.message, "sign-in") };
      }

      setSession(data.session);
      setCurrentUser(data.user);
      await loadProfile(data.user);
      return {};
    },
    [loadProfile],
  );

  const signOut = useCallback(async (): Promise<AuthActionResult> => {
    if (supabaseConfigError) {
      setSession(null);
      setCurrentUser(null);
      setProfile(null);
      setProfileError(CONFIG_UNAVAILABLE_MESSAGE);
      return {};
    }

    const { error } = await supabase.auth.signOut();

    if (error) {
      return { error: getAuthErrorMessage(error.message, "sign-out") };
    }

    setSession(null);
    setCurrentUser(null);
    setProfile(null);
    setProfileError(null);
    return {};
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      currentUser,
      profile,
      profileError,
      session,
      isAuthenticated: !!session,
      // PHASE 3 STEP 22
      // PHASE 3 STEP 28
      isVerified: getUserVerified(currentUser),
      loading,
      signUp,
      signIn,
      signOut,
      refreshUser,
      refreshProfile,
      ensureProfile,
    }),
    [
      currentUser,
      ensureProfile,
      loading,
      profile,
      profileError,
      refreshProfile,
      refreshUser,
      session,
      signIn,
      signOut,
      signUp,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }

  return context;
}
