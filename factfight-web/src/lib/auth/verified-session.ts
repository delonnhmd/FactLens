import "server-only";

import { createClient } from "@/lib/supabase/server";
import { refreshViaSingleFlight } from "@/lib/supabase/refresh-single-flight";

export type VerifiedSessionResult =
  | {
      ok: true;
      accessToken: string;
      userId: string;
    }
  | {
      ok: false;
      message: string;
    };

type ServerSupabaseClient = Awaited<ReturnType<typeof createClient>>;

async function readVerifiedSession(
  supabase: ServerSupabaseClient,
): Promise<VerifiedSessionResult> {
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  const userId =
    typeof claimsData?.claims?.sub === "string" ? claimsData.claims.sub : "";

  if (claimsError || !userId) {
    return { ok: false, message: "Log in to continue." };
  }

  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token ?? "";

  if (sessionError || !accessToken) {
    return { ok: false, message: "Your session has expired. Log in again." };
  }

  return { ok: true, accessToken, userId };
}

/**
 * Refreshes the session behind `supabase` via the same single-flight cache
 * the root proxy uses. A bare getClaims()/getSession() failure here used to
 * trigger its own independent refreshSession() call — uncoordinated with the
 * proxy's own refresh for the very same page load. Two independent refreshes
 * of the same stale refresh token (one from the proxy handling the request,
 * one from this Server Action) race exactly like two concurrent requests do:
 * Supabase revokes the whole token family on concurrent reuse. Routing both
 * through refreshViaSingleFlight means a proxy refresh and a Server Action
 * refresh for the same request coalesce into one network call instead of
 * fighting over the same token.
 */
async function attemptSingleFlightRefresh(supabase: ServerSupabaseClient): Promise<boolean> {
  const { data: sessionData } = await supabase.auth.getSession();
  const currentRefreshToken = sessionData.session?.refresh_token;

  if (!currentRefreshToken) {
    return false;
  }

  const grant = await refreshViaSingleFlight(currentRefreshToken);
  if (!grant.ok) {
    return false;
  }

  const { error: setSessionError } = await supabase.auth.setSession({
    access_token: grant.accessToken,
    refresh_token: grant.refreshToken,
  });

  return !setSessionError;
}

/**
 * Validates the signed auth token before reading the session's access token.
 * getSession() is used only as the token transport for Render; it is never the
 * authorization decision.
 *
 * getClaims()/getSession() read whatever is currently in cookies and can fail
 * on a token that only *looks* stale (e.g. the previous refresh rotated the
 * token at GoTrue but a Server Component elsewhere in the render couldn't
 * persist the new cookie). A bare failure here used to be treated as "not
 * logged in" with no recovery, which bounced real, still-valid sessions to
 * /login right after a mutation (e.g. voting) succeeded. Server Actions CAN
 * reliably write cookies, so attempt one explicit refresh — which persists
 * the rotated cookie via this call's own client — before giving up.
 */
export async function getVerifiedSession(): Promise<VerifiedSessionResult> {
  const supabase = await createClient();
  let session = await readVerifiedSession(supabase);

  if (!session.ok) {
    const refreshed = await attemptSingleFlightRefresh(supabase);
    if (refreshed) {
      session = await readVerifiedSession(supabase);
    }
  }

  return session;
}

/**
 * Force-rotates an authenticated session and then validates the new token.
 * Server Actions can persist the rotated cookies, so callers can safely retry
 * one API request without clearing the user's local session.
 */
export async function refreshVerifiedSession(): Promise<VerifiedSessionResult> {
  const supabase = await createClient();
  const refreshed = await attemptSingleFlightRefresh(supabase);

  if (!refreshed) {
    return { ok: false, message: "Your session could not be refreshed." };
  }

  return readVerifiedSession(supabase);
}
