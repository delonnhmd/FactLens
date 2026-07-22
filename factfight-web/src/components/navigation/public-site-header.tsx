import Link from "next/link";

import { logoutAction } from "@/app/(auth)/actions";
import { AppStoreLink } from "@/components/ui/app-store-link";
import { createClient } from "@/lib/supabase/server";

// This header is shared by every top-level public page (claim/topic/profile
// detail pages, the marketing home page, legal pages) as well as pages a
// signed-in user reaches directly from their feed. It used to render a
// static "Log in" link with no auth check at all, so a signed-in user
// clicking from the authenticated (main) layout (which has a real sidebar
// and "Log out" button) into e.g. a claim page would see what looked like a
// logged-out header despite having a perfectly valid session underneath -
// voting and other Server Actions kept working because they check the
// session independently of this header. Checking getClaims() here (cheap:
// the root proxy already refreshed the session for this request if needed)
// makes the header agree with reality instead of always assuming logged out.
export async function PublicSiteHeader() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const isAuthenticated = typeof data?.claims?.sub === "string";

  return (
    <header className="border-b border-white/10 bg-[var(--ff-navy)] text-white">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-7">
        <Link className="rounded-sm text-xl font-medium tracking-[-0.02em]" href="/">
          FactFight
        </Link>
        <nav aria-label="Public navigation" className="flex items-center gap-3">
          <Link className="hidden rounded-sm text-sm text-slate-200 hover:text-white sm:inline" href="/#recent-claims">
            Recent claims
          </Link>
          <Link className="rounded-sm text-sm text-slate-200 hover:text-white" href="/feed">Web app</Link>
          {isAuthenticated ? (
            <form action={logoutAction}>
              <button
                className="hidden rounded-[10px] border border-white/35 px-3 py-2 text-sm font-medium text-white sm:inline"
                type="submit"
              >
                Log out
              </button>
            </form>
          ) : (
            <Link className="hidden rounded-[10px] border border-white/35 px-3 py-2 text-sm font-medium text-white sm:inline" href="/login">Log in</Link>
          )}
          <AppStoreLink compact />
        </nav>
      </div>
    </header>
  );
}
