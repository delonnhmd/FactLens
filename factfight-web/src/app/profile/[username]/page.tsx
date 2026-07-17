import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ClaimCard } from "@/components/claims/claim-card";
import { PublicSiteFooter } from "@/components/navigation/public-site-footer";
import { PublicSiteHeader } from "@/components/navigation/public-site-header";
import { Avatar } from "@/components/ui/avatar";
import { BlockUserForm } from "@/components/profile/block-user-form";
import { EmptyState } from "@/components/ui/empty-state";
import { getClaimsByAuthorId } from "@/lib/api/claims";
import { getPublicProfile } from "@/lib/api/discovery";
import { formatAbsoluteDate } from "@/lib/utils/dates";
import { createClient } from "@/lib/supabase/server";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Contributor profile | FactFight",
  description: "View a FactFight contributor and their public claims.",
};

export default async function PublicProfilePage({ params }: { readonly params: Promise<{ username: string }> }) {
  const { username } = await params;
  const profile = await getPublicProfile(username);
  if (!profile || profile.isDeleted) notFound();
  const claims = await getClaimsByAuthorId(profile.id);
  const supabase = await createClient();
  const { data: viewerData } = await supabase.auth.getClaims();
  const viewerId = typeof viewerData?.claims?.sub === "string" ? viewerData.claims.sub : null;

  return (
    <div className="min-h-screen bg-[var(--ff-surface)]">
      <PublicSiteHeader />
      <main className="mx-auto w-full max-w-3xl px-4 py-7 sm:px-7 sm:py-10">
        <header className="rounded-[var(--ff-radius-card)] border border-[var(--ff-border)] bg-white p-6 sm:p-8">
          <div className="flex items-center gap-4"><Avatar avatarUrl={profile.avatarUrl} displayName={profile.displayName} /><div className="min-w-0"><h1 className="truncate text-3xl font-medium text-[var(--ff-navy)]">{profile.displayName}</h1><p className="truncate text-[var(--ff-text-muted)]">@{profile.username}</p></div></div>
          {profile.profileVisibility === "private" ? <p className="mt-5 text-sm text-[var(--ff-text-secondary)]">This contributor keeps profile details private.</p> : (
            <>
              {profile.bio ? <p className="mt-5 leading-7 text-[var(--ff-text-secondary)]">{profile.bio}</p> : null}
              <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-[var(--ff-radius-card)] bg-[var(--ff-surface)] p-3"><dt className="text-xs text-[var(--ff-text-muted)]">Rank</dt><dd className="mt-1 text-sm font-medium">{profile.rankTitle}</dd></div>
                <div className="rounded-[var(--ff-radius-card)] bg-[var(--ff-surface)] p-3"><dt className="text-xs text-[var(--ff-text-muted)]">Points</dt><dd className="mt-1 text-sm font-medium">{profile.reputationPoints.toLocaleString()}</dd></div>
                <div className="rounded-[var(--ff-radius-card)] bg-[var(--ff-surface)] p-3"><dt className="text-xs text-[var(--ff-text-muted)]">Evidence</dt><dd className="mt-1 text-sm font-medium">{profile.evidenceCount.toLocaleString()}</dd></div>
                <div className="rounded-[var(--ff-radius-card)] bg-[var(--ff-surface)] p-3"><dt className="text-xs text-[var(--ff-text-muted)]">Correct votes</dt><dd className="mt-1 text-sm font-medium">{profile.correctVotes.toLocaleString()}</dd></div>
              </dl>
              {profile.createdAt ? <p className="mt-4 text-xs text-[var(--ff-text-muted)]">Member since {formatAbsoluteDate(profile.createdAt)}</p> : null}
            </>
          )}
          {viewerId && viewerId !== profile.id ? <BlockUserForm userId={profile.id} /> : null}
        </header>

        <section className="mt-7" aria-labelledby="contributor-claims"><div className="mb-4 flex items-end justify-between gap-3"><h2 className="text-xl font-medium text-[var(--ff-navy)]" id="contributor-claims">Public claims</h2><span className="text-sm text-[var(--ff-text-muted)]">{claims.length}</span></div>{claims.length ? <div className="space-y-5">{claims.map((claim) => <ClaimCard claim={claim} key={claim.id} />)}</div> : <EmptyState title="No public claims" description="This contributor has not published a visible claim yet." />}</section>
      </main>
      <PublicSiteFooter />
    </div>
  );
}
