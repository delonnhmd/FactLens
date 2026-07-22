import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { publicEnvironment } from "@/lib/validation/env";

type CookieToSet = {
  name: string;
  value: string;
  options?: Parameters<NextResponse["cookies"]["set"]>[2];
};

type RefreshGrantResult =
  | { ok: true; accessToken: string; refreshToken: string }
  | { ok: false };

// Two different requests (e.g. a vote Server Action and a parallel page
// prefetch) can each hold the same stale refresh token and race to rotate it.
// Supabase revokes the whole token family when a refresh token is reused
// concurrently, which is what previously turned into "logged out after
// voting" even for sessions that had been valid for days. Coalescing
// concurrent refreshes for the same token into a single network call removes
// the race instead of just hiding its symptom. This map is process-local
// (module scope survives across requests on a warm instance, not across
// isolates), so it reduces the race without requiring cross-instance state.
const inFlightRefreshes = new Map<string, Promise<RefreshGrantResult>>();

function refreshViaSingleFlight(refreshToken: string): Promise<RefreshGrantResult> {
  const existing = inFlightRefreshes.get(refreshToken);
  if (existing) {
    return existing;
  }

  const attempt = fetch(
    `${publicEnvironment.supabaseUrl}/auth/v1/token?grant_type=refresh_token`,
    {
      method: "POST",
      headers: {
        apikey: publicEnvironment.supabaseAnonKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ refresh_token: refreshToken }),
    },
  )
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

  // See getVerifiedSession() for why a bare getClaims() failure isn't treated
  // as "logged out" outright: it can reflect a token that only looks stale
  // (a prior refresh rotated it at GoTrue but a Server Component couldn't
  // persist the cookie), not an actually-dead session. Retry with an
  // explicit refresh — middleware can always persist the cookie via setAll
  // above — before deciding to redirect to /login.
  // This runs for every route, including public claim/profile pages: those
  // pages read getClaims() directly to decide what to render (e.g. whether
  // to show vote buttons or a login prompt) and have no retry of their own,
  // so skipping recovery here previously made a merely-stale access token
  // render as "logged out" on any public page. Refreshing is safe here
  // because refreshViaSingleFlight coalesces concurrent refreshes of the same
  // token into one network call — that's what actually caused the original
  // "logged out after voting" bug (two requests racing to rotate the same
  // refresh token), not the act of refreshing on a public route per se.
  if (!initialClaimsValid) {
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
        // A failed grant, a losing single-flight race, or a setSession error
        // can emit or imply cookie-removal instructions. Do not send those to
        // the browser: none of those outcomes are proof the user's session is
        // invalid, and automatic clearing is the logout symptom this proxy
        // must prevent.
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
