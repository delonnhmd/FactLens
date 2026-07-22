import "server-only";

import { publicEnvironment } from "@/lib/validation/env";

export type RefreshGrantResult =
  | { ok: true; accessToken: string; refreshToken: string }
  | { ok: false };

// Every place in the app that can refresh a Supabase session (the root proxy
// on every page load, and getVerifiedSession()/refreshVerifiedSession() on
// every Server Action) must share this one cache. Two call sites refreshing
// the same stale refresh token independently is exactly what caused sessions
// to get killed: Supabase revokes the whole token family when a refresh
// token is reused concurrently. Coalescing concurrent refreshes of the same
// token into a single network call removes the race instead of relocating
// it from one code path to another.
//
// This map is process-local (module scope survives across requests on a warm
// instance, not across isolates), so it reduces the race without requiring
// cross-instance state.
const inFlightRefreshes = new Map<string, Promise<RefreshGrantResult>>();

export function refreshViaSingleFlight(refreshToken: string): Promise<RefreshGrantResult> {
  const existing = inFlightRefreshes.get(refreshToken);
  if (existing) {
    return existing;
  }

  const attempt = fetch(`${publicEnvironment.supabaseUrl}/auth/v1/token?grant_type=refresh_token`, {
    method: "POST",
    headers: {
      apikey: publicEnvironment.supabaseAnonKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ refresh_token: refreshToken }),
  })
    .then(async (response) => {
      if (!response.ok) {
        return { ok: false as const };
      }
      const body = (await response.json().catch(() => null)) as {
        access_token?: string;
        refresh_token?: string;
      } | null;
      if (!body?.access_token || !body.refresh_token) {
        return { ok: false as const };
      }
      return { ok: true as const, accessToken: body.access_token, refreshToken: body.refresh_token };
    })
    .catch(() => ({ ok: false as const }))
    .finally(() => {
      inFlightRefreshes.delete(refreshToken);
    });

  inFlightRefreshes.set(refreshToken, attempt);
  return attempt;
}
