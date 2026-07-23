import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { ClaimCard } from "@/components/claims/claim-card";
import { EmptyState } from "@/components/ui/empty-state";
import { getVerifiedSession } from "@/lib/auth/verified-session";
import { getClaimsByAuthorId } from "@/lib/api/claims";
import { getViewerVotesByClaimId } from "@/lib/api/viewer-votes";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "My claims | FactFight" };

export default async function MyClaimsPage() {
  const session = await getVerifiedSession();
  if (!session.ok) redirect("/login?next=/profile/claims");
  const claims = await getClaimsByAuthorId(session.userId);
  const viewerVotes = await getViewerVotesByClaimId(session.userId, claims.map((claim) => claim.id));

  return (
    <div className="mx-auto w-full max-w-[680px]">
      <header className="mb-6"><p className="text-sm font-medium text-[var(--ff-ai)]">Your contributions</p><h1 className="mt-1 text-3xl font-medium text-[var(--ff-navy)]">My claims</h1><p className="mt-2 text-[var(--ff-text-secondary)]">Visible claims you have submitted for community verification.</p></header>
      {claims.length ? <section className="space-y-5" aria-label="Your claims">{claims.map((claim) => <ClaimCard claim={claim} key={claim.id} viewerVote={viewerVotes[claim.id] ?? null} />)}</section> : <EmptyState title="No claims yet" description="Create your first source-backed claim to begin participating." />}
    </div>
  );
}
