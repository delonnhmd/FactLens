// PHASE 3 STEP 2
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { Session, User as SupabaseUser } from "@supabase/supabase-js";
import { supabase, supabaseConfigError } from "../lib/supabase";
import { ensureProfileForUser, getProfile } from "../services/profileService";
import type { Profile } from "../services/profileService";
import { normalizeUsername } from "../utils/username";

interface AuthActionResult {
  error?: string;
  message?: string;
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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [currentUser, setCurrentUser] = useState<SupabaseUser | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // PHASE 3 STEP 13
  // PHASE 3 STEP 15
  // PHASE 3 STEP 18C
  // PHASE 3 STEP 22
  const loadProfile = useCallback(async (user: SupabaseUser): Promise<AuthActionResult> => {
    try {
      console.log("[auth] current user id:", user.id);
      console.log("[auth] email confirmed:", Boolean(user.email_confirmed_at));

      const existingProfile = await getProfile(user.id);
      console.log("[profile] loaded by id:", existingProfile.profile);
      console.log("[profile] profile verified:", existingProfile.profile?.verified);

      if (existingProfile.profile) {
        const profileResult =
          user.email_confirmed_at && !existingProfile.profile.verified
            ? await ensureProfileForUser(user)
            : existingProfile;
        const nextProfile = profileResult.profile
          ? {
              ...profileResult.profile,
              verified: profileResult.profile.verified || Boolean(user.email_confirmed_at),
            }
          : null;

        setProfile(nextProfile);
        setProfileError(profileResult.error ?? null);
        console.log("[profile] setting profile state:", nextProfile?.id);

        if (profileResult.error) {
          return { error: profileResult.error };
        }

        return profileResult.message ? { message: profileResult.message } : {};
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
            verified: result.profile.verified || Boolean(user.email_confirmed_at),
          }
        : null;

      setProfile(nextProfile);
      setProfileError(result.error ?? null);
      console.log("[profile] setting profile state:", nextProfile?.id);

      if (result.error) {
        return { error: result.error };
      }

      return result.message ? { message: result.message } : {};
    } catch {
      const message = "We could not load your profile. Please try again.";
      setProfile(null);
      setProfileError(message);
      return { error: message };
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
      setProfileError(supabaseConfigError);
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
          setProfileError("We could not load your session. Please try again.");
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
      return { error: supabaseConfigError };
    }

    const { data, error } = await supabase.auth.getUser();

    if (error) {
      return { error: error.message };
    }

    const { data: sessionData } = await supabase.auth.getSession();
    setSession(sessionData.session);
    setCurrentUser(data.user);
    await loadProfile(data.user);
    return {};
  }, [loadProfile]);

  const signUp = useCallback(async (email: string, password: string, username: string): Promise<AuthActionResult> => {
    if (supabaseConfigError) {
      return { error: supabaseConfigError };
    }

    const trimmedUsername = normalizeUsername(username);

    if (!trimmedUsername) {
      return { error: "Username must be at least 3 characters." };
    }

    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: {
          username: trimmedUsername,
          displayName: username.trim() || trimmedUsername,
        },
      },
    });

    if (error) {
      return { error: error.message };
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

    return { message: "Check your email to verify your account." };
  }, [loadProfile]);

  const signIn = useCallback(
    async (email: string, password: string): Promise<AuthActionResult> => {
      if (supabaseConfigError) {
        return { error: supabaseConfigError };
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        return { error: error.message };
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
      setProfileError(supabaseConfigError);
      return {};
    }

    const { error } = await supabase.auth.signOut();

    if (error) {
      return { error: error.message };
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
      isVerified: Boolean(currentUser?.email_confirmed_at),
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
