import type { ReactNode } from "react";

import { AuthenticatedAppShell } from "@/components/navigation/authenticated-app-shell";
import { PublicSiteFooter } from "@/components/navigation/public-site-footer";
import { PublicSiteHeader } from "@/components/navigation/public-site-header";
import { getViewerProfileSummary } from "@/lib/api/discovery";
import { createClient } from "@/lib/supabase/server";

// Shared chrome for standalone public pages (/about, /terms, /privacy).
// Signed-in viewers get the full app shell with the primary navigation -
// the same treatment claim/topic/profile detail pages give them - so no
// page strands them in the bare marketing header. Signed-out visitors get
// the marketing header and footer. Falls back to placeholder profile text
// (like the (main) layout) if the viewer's profile fetch fails, so a
// transient backend error never hides the navigation.
export async function PublicPageShell({ children }: { readonly children: ReactNode }) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const viewerId = typeof data?.claims?.sub === "string" ? data.claims.sub : null;

  if (viewerId) {
    const profile = await getViewerProfileSummary(viewerId);
    return (
      <AuthenticatedAppShell
        profile={{
          displayName: profile?.displayName ?? "FactFight",
          username: profile?.username ?? "",
          avatarUrl: profile?.avatarUrl ?? null,
        }}
      >
        <div className="mx-auto w-full max-w-3xl">{children}</div>
      </AuthenticatedAppShell>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--ff-surface)] text-[var(--ff-text)]">
      <PublicSiteHeader />
      <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-7 sm:py-12">{children}</main>
      <PublicSiteFooter />
    </div>
  );
}
