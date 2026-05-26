// PHASE 2 STEP 9
import { createContext, useContext, useMemo } from "react";
import type { ReactNode } from "react";
import { Alert } from "react-native";
import { mockUser } from "../constants/mockUser";
import type { User } from "../types/user";

interface AuthContextValue {
  currentUser: User;
  isAuthenticated: boolean;
  isVerified: boolean;
  loginPlaceholder: () => void;
  logoutPlaceholder: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const value = useMemo<AuthContextValue>(
    () => ({
      currentUser: mockUser,
      isAuthenticated: true,
      isVerified: true,
      loginPlaceholder: () => Alert.alert("Account creation will be added later."),
      logoutPlaceholder: () => Alert.alert("Logout will be added later."),
    }),
    [],
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
