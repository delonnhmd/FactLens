// PHASE 3 STEP 1
import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppState } from "react-native";
import { createClient } from "@supabase/supabase-js";

const FALLBACK_SUPABASE_URL = "https://islcxqkevxxopatqvlqz.supabase.co";
const FALLBACK_SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlzbGN4cWtldnh4b3BhdHF2bHF6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3NDE5ODksImV4cCI6MjA5NTMxNzk4OX0.96zZEPyRz2_RLkKJTx1GJIzQ-E1EcGA1X82FLPohTlg";

const supabaseUrlFromEnv = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKeyFromEnv = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const supabaseUrl = supabaseUrlFromEnv || FALLBACK_SUPABASE_URL;
const supabaseAnonKey = supabaseAnonKeyFromEnv || FALLBACK_SUPABASE_ANON_KEY;

console.log("SUPABASE_ENV", {
  EXPO_PUBLIC_SUPABASE_URL: supabaseUrlFromEnv ?? null,
  EXPO_PUBLIC_SUPABASE_ANON_KEY_PRESENT: Boolean(supabaseAnonKeyFromEnv),
  USING_FALLBACK_SUPABASE_URL: !supabaseUrlFromEnv,
  USING_FALLBACK_SUPABASE_ANON_KEY: !supabaseAnonKeyFromEnv,
});

// PHASE 3 STEP 13
// Do not throw during module import. Expo can otherwise red-screen before the
// app has a chance to render a friendly configuration error.
export const supabaseConfigError =
  !supabaseUrl || !supabaseAnonKey
    ? "Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY."
    : null;

export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey,
  {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  },
);

// autoRefreshToken's timer only ticks while JS is actively running. Without
// this, backgrounding the app (e.g. the OS image picker while attaching a
// claim photo) can silently stall the timer, so the token is already stale
// by the time the user returns to vote. Per Supabase's React Native guidance:
// https://supabase.com/docs/reference/javascript/auth-startautorefresh
AppState.addEventListener("change", (state) => {
  if (state === "active") {
    supabase.auth.startAutoRefresh();
  } else {
    supabase.auth.stopAutoRefresh();
  }
});
