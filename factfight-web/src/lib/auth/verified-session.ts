import "server-only";

import { createClient } from "@/lib/supabase/server";

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
    const { error: refreshError } = await supabase.auth.refreshSession();
    if (!refreshError) {
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
  const { error } = await supabase.auth.refreshSession();

  if (error) {
    return { ok: false, message: "Your session could not be refreshed." };
  }

  return readVerifiedSession(supabase);
}
