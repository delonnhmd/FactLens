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

/**
 * Validates the signed auth token before reading the session's access token.
 * getSession() is used only as the token transport for Render; it is never the
 * authorization decision.
 */
export async function getVerifiedSession(): Promise<VerifiedSessionResult> {
  const supabase = await createClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  const userId = typeof claimsData?.claims?.sub === "string" ? claimsData.claims.sub : "";

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
