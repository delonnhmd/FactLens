import { NextResponse, type NextRequest } from "next/server";

import { acceptTerms, ensureProfile } from "@/lib/api/auth";
import { createClient } from "@/lib/supabase/server";
import { getSafeInternalDestination } from "@/lib/utils/redirects";
import { publicEnvironment } from "@/lib/validation/env";

function loginFailure(code: string) {
  const url = new URL("/login", publicEnvironment.siteUrl);
  url.searchParams.set("error", code);
  return NextResponse.redirect(url);
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");

  if (!code) {
    return loginFailure("missing_code");
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.session?.access_token) {
    return loginFailure("callback_failed");
  }

  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();

  if (claimsError || !claimsData?.claims?.sub) {
    await supabase.auth.signOut();
    return loginFailure("session_invalid");
  }

  const profileResult = await ensureProfile(data.session.access_token, {
    username: "",
    displayName: "",
  });

  if (!profileResult.ok) {
    await supabase.auth.signOut();
    return loginFailure("profile_unavailable");
  }

  // A PKCE callback follows the email-confirmation branch, where signup had
  // no access token and therefore could not record the accepted terms earlier.
  const termsResult = await acceptTerms(data.session.access_token);

  if (!termsResult.ok) {
    await supabase.auth.signOut();
    return loginFailure("terms_unavailable");
  }

  const destination = getSafeInternalDestination(request.nextUrl.searchParams.get("next"));
  return NextResponse.redirect(new URL(destination, publicEnvironment.siteUrl));
}
