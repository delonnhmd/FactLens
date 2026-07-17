import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { publicEnvironment } from "@/lib/validation/env";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    publicEnvironment.supabaseUrl,
    publicEnvironment.supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Server Components cannot always write cookies. The root proxy
            // refreshes the session and applies cookie changes to the response.
          }
        },
      },
    },
  );
}
