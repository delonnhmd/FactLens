"use client";

import { createBrowserClient } from "@supabase/ssr";

import { publicEnvironment } from "@/lib/validation/env";

let browserClient: ReturnType<typeof createBrowserClient> | undefined;

export function createClient() {
  browserClient ??= createBrowserClient(
    publicEnvironment.supabaseUrl,
    publicEnvironment.supabaseAnonKey,
  );

  return browserClient;
}
