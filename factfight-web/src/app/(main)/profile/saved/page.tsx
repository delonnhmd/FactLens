import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { ClaimCard } from "@/components/claims/claim-card";
import { SavedClaimButton } from "@/components/claims/saved-claim-button";
import { EmptyState } from "@/components/ui/empty-state";
import { getVerifiedSession } from "@/lib/auth/verified-session";
import { getClaimsByIds } from "@/lib/api/claims";
import { getViewerVotesByClaimId } from "@/lib/api/viewer-votes";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Saved claims | FactFight" };

export default async function SavedClaimsPage() {
  const session = await getVerifiedSession();
  if (!session.ok) redirect("/login?next=/profile/saved");
  const supabase = await createClient();

  const { data: savedRows, error: savedError } = await supabase
    .from("saved_claims")
    .select("claim_id,created_at")
    .eq("user_id", session.userId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (savedError) throw new Error("Saved claims are temporarily unavailable.");
  const claims = await getClaimsByIds((savedRows ?? []).map((row) => row.claim_id));
  const viewerVotes = await getViewerVotesByClaimId(session.userId, claims.map((claim) => claim.id));

  return (
    <div className="mx-auto w-full max-w-[680px]">
      <header className="mb-6"><p className="text-sm font-medium text-[var(--ff-ai)]">Reading list</p><h1 className="mt-1 text-3xl font-medium text-[var(--ff-navy)]">Saved claims</h1><p className="mt-2 text-[var(--ff-text-secondary)]">Claims you saved for later review.</p></header>
      {claims.length ? <section className="space-y-5" aria-label="Saved claims">{claims.map((claim) => <div key={claim.id}><div className="mb-2 flex justify-end"><SavedClaimButton claimId={claim.id} /></div><ClaimCard claim={claim} viewerVote={viewerVotes[claim.id] ?? null} /></div>)}</section> : <EmptyState title="No saved claims" description="Use Save claim on a claim page to add it here." />}
    </div>
  );
}
