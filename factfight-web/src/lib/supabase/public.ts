import "server-only";

import { createClient } from "@supabase/supabase-js";

import { PUBLIC_REVALIDATE_SECONDS } from "@/lib/constants/public-site";
import { publicEnvironment } from "@/lib/validation/env";

const revalidatingFetch: typeof fetch = (input, init) =>
  fetch(input, {
    ...init,
    next: { revalidate: PUBLIC_REVALIDATE_SECONDS },
  });

/**
 * Stateless anonymous client for cacheable public pages.
 *
 * This client intentionally has no cookies and no privileged key. Every query
 * is constrained by the production RLS policies for the anon role.
 */
export function createPublicClient() {
  return createClient(publicEnvironment.supabaseUrl, publicEnvironment.supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
    global: { fetch: revalidatingFetch },
  });
}
