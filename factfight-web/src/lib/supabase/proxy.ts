import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { publicEnvironment } from "@/lib/validation/env";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    publicEnvironment.supabaseUrl,
    publicEnvironment.supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });

          response = NextResponse.next({ request });

          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });

          Object.entries(headers).forEach(([name, value]) => {
            response.headers.set(name, value);
          });
        },
      },
    },
  );

  const { data, error } = await supabase.auth.getClaims();
  const pathname = request.nextUrl.pathname;
  const protectedRoute =
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
    pathname === "/settings" ||
    pathname.startsWith("/settings/") ||
    pathname === "/notifications" ||
    pathname.startsWith("/notifications/") ||
    pathname === "/moderation" ||
    pathname.startsWith("/moderation/");

  if (protectedRoute && (error || !data?.claims?.sub)) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = "";
    loginUrl.searchParams.set("next", `${pathname}${request.nextUrl.search}`);
    const redirectResponse = NextResponse.redirect(loginUrl);
    response.cookies.getAll().forEach((cookie) => redirectResponse.cookies.set(cookie));
    return redirectResponse;
  }

  return response;
}
