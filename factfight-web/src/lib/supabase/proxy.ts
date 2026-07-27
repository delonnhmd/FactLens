import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { refreshViaSingleFlight } from "@/lib/supabase/refresh-single-flight";
import { publicEnvironment } from "@/lib/validation/env";

type CookieToSet = {
  name: string;
  value: string;
  options?: Parameters<NextResponse["cookies"]["set"]>[2];
};

function isProtectedRoute(pathname: string): boolean {
  return (
    pathname === "/feed" ||
    pathname.startsWith("/feed/") ||
    pathname === "/create" ||
    pathname.startsWith("/create/") ||
    pathname === "/search" ||
    pathname.startsWith("/search/") ||
    pathname === "/leaderboard" ||
    pathname.startsWith("/leaderboard/") ||
    pathname === "/profile" ||
    pathname === "/profile/claims" ||
    pathname.startsWith("/profile/claims/") ||
    pathname === "/profile/saved" ||
    pathname.startsWith("/profile/saved/") ||
    pathname === "/my-activity" ||
    pathname.startsWith("/my-activity/") ||
    pathname === "/settings" ||
    pathname.startsWith("/settings/") ||
    pathname === "/notifications" ||
    pathname.startsWith("/notifications/") ||
    pathname === "/moderation" ||
    pathname.startsWith("/moderation/")
  );
}

function applyResponseState(
  request: NextRequest,
  cookiesToSet: readonly CookieToSet[],
  headersToSet: Readonly<Record<string, string>>,
): NextResponse {
  // Create the one response that is returned to the browser, then apply all
  // buffered auth state to it. Never replace this response after setting the
  // refreshed cookies, or the browser will miss the rotated cookie chunks.
  const response = NextResponse.next({ request });

  cookiesToSet.forEach(({ name, value, options }) => {
    response.cookies.set(name, value, options);
  });
  Object.entries(headersToSet).forEach(([name, value]) => {
    response.headers.set(name, value);
  });

  return response;
}

export async function updateSession(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const protectedRoute = isProtectedRoute(pathname);
  const initialCookies: CookieToSet[] = [];
  let refreshCookies: CookieToSet[] = [];
  const initialHeaders: Record<string, string> = {};
  let refreshHeaders: Record<string, string> = {};
  let inRefreshAttempt = false;

  const supabase = createServerClient(
    publicEnvironment.supabaseUrl,
    publicEnvironment.supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          const targetCookies = inRefreshAttempt ? refreshCookies : initialCookies;
          const targetHeaders = inRefreshAttempt ? refreshHeaders : initialHeaders;
          targetCookies.push(...cookiesToSet);
          Object.assign(targetHeaders, headers);

          // Keep the forwarded request in sync as well as the final response.
          // Server Components and downstream handlers then see the same
          // rotated session during this request.
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });
        },
      },
    },
  );

  let { data, error } = await supabase.auth.getClaims();
  const initialClaimsValid = !error && Boolean(data?.claims?.sub);
  let refreshClaimsValid = false;

  // A stale protected-route token can be recovered without treating one
  // failed getClaims() call as logout. Public claim/profile pages intentionally
  // do not refresh here: they can render public data without authentication,
  // and must not compete with a vote action or protected navigation for the
  // rotating refresh token.
  if (protectedRoute && !initialClaimsValid) {
    const { data: sessionData } = await supabase.auth.getSession();
    const currentRefreshToken = sessionData.session?.refresh_token;

    if (currentRefreshToken) {
      const grant = await refreshViaSingleFlight(currentRefreshToken);

      if (grant.ok) {
        inRefreshAttempt = true;
        const { error: setSessionError } = await supabase.auth.setSession({
          access_token: grant.accessToken,
          refresh_token: grant.refreshToken,
        });
        inRefreshAttempt = false;

        if (!setSessionError) {
          ({ data, error } = await supabase.auth.getClaims());
          refreshClaimsValid = !error && Boolean(data?.claims?.sub);
        }
      }

      if (!refreshClaimsValid) {
        // A failed refresh can emit cookie-removal instructions. They are not
        // proof that a session is invalid, so never send them to the browser.
        refreshCookies = [];
        refreshHeaders = {};
      }
    }
  }

  const cookiesToApply = initialClaimsValid
    ? initialCookies
    : refreshClaimsValid
      ? refreshCookies
      : [];
  const headersToApply = initialClaimsValid
    ? initialHeaders
    : refreshClaimsValid
      ? refreshHeaders
      : {};

  if (protectedRoute && (error || !data?.claims?.sub)) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = "";
    loginUrl.searchParams.set("next", `${pathname}${request.nextUrl.search}`);
    const redirectResponse = NextResponse.redirect(loginUrl);
    cookiesToApply.forEach(({ name, value, options }) => {
      redirectResponse.cookies.set(name, value, options);
    });
    Object.entries(headersToApply).forEach(([name, value]) => {
      redirectResponse.headers.set(name, value);
    });
    return redirectResponse;
  }

  return applyResponseState(request, cookiesToApply, headersToApply);
}
