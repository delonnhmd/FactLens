import type { NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    "/feed/:path*",
    "/login",
    "/signup",
    "/confirmed",
    "/auth/:path*",
  ],
};
