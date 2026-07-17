"use client";

import { createBrowserClient } from "@supabase/ssr";

import { publicEnvironment } from "@/lib/validation/env";

export function createClient() {
  return createBrowserClient(
    publicEnvironment.supabaseUrl,
    publicEnvironment.supabaseAnonKey,
  );
}
