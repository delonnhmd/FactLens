import type { NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    "/feed/:path*",
    "/create/:path*",
    "/claim/:path*",
    "/search/:path*",
    "/leaderboard/:path*",
    "/profile/:path*",
    "/my-activity/:path*",
    "/settings/:path*",
    "/notifications/:path*",
    "/moderation/:path*",
    "/login",
    "/signup",
    "/confirmed",
    "/forgot-password",
    "/reset-password",
    "/auth/:path*",
  ],
};
