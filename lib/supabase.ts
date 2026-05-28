// PHASE 3 STEP 1
import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

// PHASE 3 STEP 13
// Do not throw during module import. Expo can otherwise red-screen before the
// app has a chance to render a friendly configuration error.
export const supabaseConfigError =
  !supabaseUrl || !supabaseAnonKey
    ? "Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY."
    : null;

export const supabase = createClient(
  supabaseUrl ?? "https://missing-supabase-url.supabase.co",
  supabaseAnonKey ?? "missing-supabase-anon-key",
  {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  },
);
