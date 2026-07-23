import "server-only";

import type { VoteType } from "@/lib/validation/claim-actions";
import { createClient } from "@/lib/supabase/server";

const voteTypeValues = new Set(["TRUE", "FAKE", "UNSURE"]);

// The signed-in viewer's own votes for a set of claims, keyed by claim id.
// Read through the session-scoped Supabase client (RLS), same as mobile's
// fetchUserVoteForClaim. Errors degrade to an empty map — the vote panel then
// shows the buttons and the backend's one-vote gate still rejects repeats.
export async function getViewerVotesByClaimId(
  userId: string,
  claimIds: readonly string[],
): Promise<Record<string, VoteType>> {
  if (!userId || claimIds.length === 0) {
    return {};
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("votes")
    .select("claim_id,vote_type")
    .eq("user_id", userId)
    .in("claim_id", [...claimIds]);

  if (error || !data) {
    return {};
  }

  const votes: Record<string, VoteType> = {};

  for (const row of data) {
    const claimId = typeof row.claim_id === "string" ? row.claim_id : "";
    const voteType = typeof row.vote_type === "string" ? row.vote_type.toUpperCase() : "";

    if (claimId && voteTypeValues.has(voteType)) {
      votes[claimId] = voteType as VoteType;
    }
  }

  return votes;
}

export async function getViewerVoteForClaim(
  userId: string | null,
  claimId: string,
): Promise<VoteType | null> {
  if (!userId) {
    return null;
  }

  const votes = await getViewerVotesByClaimId(userId, [claimId]);
  return votes[claimId] ?? null;
}
