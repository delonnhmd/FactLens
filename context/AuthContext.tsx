// PHASE 3 STEP 2
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { Session, User as SupabaseUser } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import { getAuthProfile } from "../services/authProfile";
import { createProfile, getProfile } from "../services/profileService";
import type { Profile } from "../services/profileService";

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
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [currentUser, setCurrentUser] = useState<SupabaseUser | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // PHASE 3 STEP 13
  const loadProfile = useCallback(async (user: SupabaseUser): Promise<AuthActionResult> => {
    const result = await getProfile(user.id);

    if (result.profile || result.error) {
      setProfile(result.profile);
      setProfileError(result.error ?? null);

      if (result.error) {
        return { error: result.error };
      }

      return {};
    }

    const fallbackProfile = getAuthProfile(user);
    const createResult = await createProfile(user.id, fallbackProfile.username, fallbackProfile.displayName);
    setProfile(createResult.profile);
    setProfileError(createResult.error ?? null);

    if (createResult.error) {
      return { error: createResult.error };
    }

    return {};
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
    let mounted = true;

    supabase.auth
      .getSession()
      .then(async ({ data }) => {
        if (!mounted) {
          return;
        }

        await applySession(data.session);
      })
      .finally(() => {
        if (mounted) {
          setLoading(false);
        }
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
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

    return loadProfile(currentUser);
  }, [currentUser, loadProfile]);

  const refreshUser = useCallback(async (): Promise<AuthActionResult> => {
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
    const trimmedUsername = username.trim();
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: {
          username: trimmedUsername,
          displayName: trimmedUsername,
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
      const profileResult = await createProfile(data.user.id, trimmedUsername, trimmedUsername);

      if (profileResult.profile) {
        setProfile(profileResult.profile);
        setProfileError(null);
      } else if (profileResult.error === "Username already taken.") {
        setProfileError(profileResult.error ?? null);
        return { error: profileResult.error };
      }
    } else {
      setProfile(null);
      setProfileError(null);
    }

    return { message: "Check your email to verify your account." };
  }, []);

  const signIn = useCallback(
    async (email: string, password: string): Promise<AuthActionResult> => {
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
      isVerified: !!currentUser?.email_confirmed_at,
      loading,
      signUp,
      signIn,
      signOut,
      refreshUser,
      refreshProfile,
    }),
    [currentUser, loading, profile, profileError, refreshProfile, refreshUser, session, signIn, signOut, signUp],
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
