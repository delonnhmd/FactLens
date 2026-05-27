// PHASE 3 STEP 1
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { Session, User as SupabaseUser } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";

interface AuthActionResult {
  error?: string;
  message?: string;
}

interface AuthContextValue {
  currentUser: SupabaseUser | null;
  session: Session | null;
  isAuthenticated: boolean;
  isVerified: boolean;
  loading: boolean;
  signUp: (email: string, password: string, username: string) => Promise<AuthActionResult>;
  signIn: (email: string, password: string) => Promise<AuthActionResult>;
  signOut: () => Promise<AuthActionResult>;
  refreshUser: () => Promise<AuthActionResult>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [currentUser, setCurrentUser] = useState<SupabaseUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!mounted) {
          return;
        }

        setSession(data.session);
        setCurrentUser(data.session?.user ?? null);
      })
      .finally(() => {
        if (mounted) {
          setLoading(false);
        }
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setCurrentUser(nextSession?.user ?? null);
      setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const refreshUser = useCallback(async (): Promise<AuthActionResult> => {
    const { data, error } = await supabase.auth.getUser();

    if (error) {
      return { error: error.message };
    }

    const { data: sessionData } = await supabase.auth.getSession();
    setSession(sessionData.session);
    setCurrentUser(data.user);
    return {};
  }, []);

  const signUp = useCallback(async (email: string, password: string, username: string): Promise<AuthActionResult> => {
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: {
          username: username.trim(),
        },
      },
    });

    if (error) {
      return { error: error.message };
    }

    setSession(data.session);
    setCurrentUser(data.session?.user ?? null);
    return { message: "Check your email to verify your account." };
  }, []);

  const signIn = useCallback(async (email: string, password: string): Promise<AuthActionResult> => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) {
      return { error: error.message };
    }

    setSession(data.session);
    setCurrentUser(data.user);
    return {};
  }, []);

  const signOut = useCallback(async (): Promise<AuthActionResult> => {
    const { error } = await supabase.auth.signOut();

    if (error) {
      return { error: error.message };
    }

    setSession(null);
    setCurrentUser(null);
    return {};
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      currentUser,
      session,
      isAuthenticated: !!session,
      isVerified: !!currentUser?.email_confirmed_at,
      loading,
      signUp,
      signIn,
      signOut,
      refreshUser,
    }),
    [currentUser, loading, refreshUser, session, signIn, signOut, signUp],
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
