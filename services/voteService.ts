// PHASE 3 STEP 4
// PHASE 3 STEP 20D
// PHASE 3 STEP 20E
// PHASE 3 STEP 24
// PHASE 3 STEP 29
// PHASE 3 STEP 32
import { supabase } from "../lib/supabase";
import { fetchClaimById, finalizeExpiredClaim } from "./claimService";
import { getScoreLockAt, getVoteAcceptUntil } from "../utils/verificationTiming";
import type { Claim, VoteOption } from "../types/claim";
import type { Profile } from "./profileService";

export type VoteType = "TRUE" | "FAKE" | "UNSURE";
type VoteTypeInput = VoteOption | VoteType | string;

export interface VoteRow {
  id?: string;
  claim_id?: string;
  user_id?: string;
  vote_type: VoteType | string;
  vote_value: number | null;
  trust_weight: number | null;
  accepted: boolean | null;
  suspicious: boolean | null;
  rejected_reason: string | null;
  created_at?: string;
  updated_at?: string;
}

interface VoteRowsResult {
  votes: VoteRow[];
  error?: string;
}

interface UserVoteResult {
  vote: VoteOption | null;
  voteRow: VoteRow | null;
  error?: string;
}

interface ClaimVoteResult {
  claim: Claim | null;
  updatedClaim?: Claim | null;
  vote?: VoteRow | null;
  error?: string;
  message?: string;
  ok?: boolean;
  alreadyVoted?: boolean;
  countRefreshFailed?: boolean;
}

const ALREADY_VOTED_MESSAGE = "You already voted on this post.";
const TRIGGER_REFETCH_DELAY_MS = 300;

function waitForClaimTrigger() {
  return new Promise((resolve) => setTimeout(resolve, TRIGGER_REFETCH_DELAY_MS));
}

function logUpdatedClaimFromSupabase(updatedClaim: Claim | null | undefined) {
  if (!updatedClaim) {
    return;
  }

  console.log("[vote] updated claim from Supabase:", {
    id: updatedClaim.id,
    votes_true: updatedClaim.votesTrue,
    votes_fake: updatedClaim.votesFake,
    votes_unsure: updatedClaim.votesUnsure,
    total_votes: updatedClaim.totalVotes,
    weighted_community_score: updatedClaim.weightedCommunityScore,
    final_score: updatedClaim.finalScore,
  });
  console.log("[vote] updated counts:", {
    votesTrue: updatedClaim.votesTrue,
    votesFake: updatedClaim.votesFake,
    votesUnsure: updatedClaim.votesUnsure,
    totalVotes: updatedClaim.totalVotes,
    weightedCommunityScore: updatedClaim.weightedCommunityScore,
    finalScore: updatedClaim.finalScore,
  });
}

async function fetchClaimAfterVoteTrigger(claimId: string, waitForTrigger = false): Promise<ClaimResultLike> {
  if (waitForTrigger) {
    await waitForClaimTrigger();
  }

  const result = await fetchClaimById(claimId);
  logUpdatedClaimFromSupabase(result.claim);
  return result;
}

type ClaimResultLike = {
  claim: Claim | null;
  error?: string;
};

export function normalizeVoteType(voteType: VoteTypeInput): VoteType {
  const normalized = String(voteType)
    .trim()
    .replace(/[\s-]+/g, "_")
    .toUpperCase();

  if (normalized === "TRUE") {
    return "TRUE";
  }

  if (normalized === "FAKE") {
    return "FAKE";
  }

  if (normalized === "UNSURE" || normalized === "NOT_SURE") {
    return "UNSURE";
  }

  throw new Error("Invalid vote type.");
}

function toAppVoteOption(voteType: VoteTypeInput | null | undefined): VoteOption | null {
  if (!voteType) {
    return null;
  }

  try {
    const normalizedVoteType = normalizeVoteType(voteType);
    return normalizedVoteType === "UNSURE" ? "NOT_SURE" : normalizedVoteType;
  } catch {
    return null;
  }
}

export function getVoteValue(normalizedVoteType: VoteType): number | null {
  if (normalizedVoteType === "TRUE") {
    return 1.0;
  }

  if (normalizedVoteType === "FAKE") {
    return 0.0;
  }

  return null;
}

function getVoteErrorMessage(message: string): string {
  const normalizedMessage = message.toLowerCase();

  if (normalizedMessage.includes("row-level security")) {
    return "You are not allowed to vote on this claim.";
  }

  if (normalizedMessage.includes("duplicate")) {
    return ALREADY_VOTED_MESSAGE;
  }

  // PHASE 3 STEP 22
  return message || "We could not save your vote. Please try again.";
}

function logVoteSupabaseError({
  claimId,
  userId,
  voteType,
  action,
  error,
}: {
  claimId: string;
  userId: string;
  voteType?: VoteType;
  action: string;
  error: { code?: string; message?: string; details?: string | null } | null;
}) {
  console.log("[vote] Supabase vote error", {
    action,
    claimId,
    userId,
    voteType,
    code: error?.code,
    message: error?.message,
    details: error?.details,
  });
}

function hasVoteWindowClosed(claim: Claim): boolean {
  // PHASE 3 STEP 22
  return new Date(getVoteAcceptUntil(claim)).getTime() <= Date.now();
}

async function fetchVoteRowForClaim(claimId: string, userId: string): Promise<{ vote: VoteRow | null; error?: string }> {
  const { data, error } = await supabase
    .from("votes")
    .select("*")
    .eq("claim_id", claimId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    return {
      vote: null,
      error: getVoteErrorMessage(error.message),
    };
  }

  return {
    vote: (data as VoteRow | null) ?? null,
  };
}

export async function fetchVotesForClaim(claimId: string): Promise<VoteRowsResult> {
  const { data, error } = await supabase.from("votes").select("*").eq("claim_id", claimId);

  if (error) {
    return {
      votes: [],
      error: getVoteErrorMessage(error.message),
    };
  }

  return {
    votes: (data as VoteRow[]) ?? [],
  };
}

export async function fetchUserVoteForClaim(claimId: string, userId: string): Promise<UserVoteResult> {
  const result = await fetchVoteRowForClaim(claimId, userId);

  if (result.error) {
    return {
      vote: null,
      voteRow: null,
      error: result.error,
    };
  }

  return {
    vote: toAppVoteOption(result.vote?.vote_type ?? null),
    voteRow: result.vote,
  };
}

export async function recalculateVoteCounts(claimId: string): Promise<ClaimVoteResult> {
  // PHASE 3 STEP 32
  // Supabase triggers own vote totals; this legacy-named helper now refetches
  // the claims row instead of recalculating totals on the client.
  const claimResult = await fetchClaimAfterVoteTrigger(claimId);

  if (claimResult.error || !claimResult.claim) {
    return {
      claim: null,
      updatedClaim: null,
      error: claimResult.error ?? "Claim not found.",
    };
  }

  return {
    claim: claimResult.claim,
    updatedClaim: claimResult.claim,
  };
}

export async function voteOnClaim(
  claimId: string,
  userId: string,
  voteType: VoteTypeInput,
  profile?: Profile | null,
): Promise<ClaimVoteResult> {
  void profile;
  const claimResult = await fetchClaimById(claimId);

  if (claimResult.error || !claimResult.claim) {
    return {
      claim: null,
      error: claimResult.error ?? "Claim not found.",
    };
  }

  // PHASE 3 STEP 22
  const voteAcceptUntil = getVoteAcceptUntil(claimResult.claim);
  const scoreLockAt = getScoreLockAt(claimResult.claim);
  const canAcceptVote = new Date(voteAcceptUntil).getTime() > Date.now();
  console.log("[vote] voteAcceptUntil:", voteAcceptUntil);
  console.log("[vote] canAcceptVote:", canAcceptVote);

  if (
    claimResult.claim.publishedAt ||
    claimResult.claim.phase4Locked ||
    claimResult.claim.status === "COMMUNITY_TRUE" ||
    claimResult.claim.status === "COMMUNITY_FAKE" ||
    claimResult.claim.status === "NEEDS_MORE_EVIDENCE"
  ) {
    return {
      claim: claimResult.claim,
      error: "This claim is read-only.",
    };
  }

  if (claimResult.claim.status === "VOTING_CLOSED") {
    return {
      claim: claimResult.claim,
      error: "Voting is closed. Final score is being locked.",
    };
  }

  if (hasVoteWindowClosed(claimResult.claim)) {
    const finalizedClaim =
      new Date(scoreLockAt).getTime() <= Date.now()
        ? await finalizeExpiredClaim(claimId)
        : { claim: claimResult.claim };

    return {
      claim: finalizedClaim.claim ?? claimResult.claim,
      error:
        new Date(scoreLockAt).getTime() <= Date.now()
          ? "This claim is read-only."
          : "Voting is closed. Final score is being locked.",
    };
  }

  const normalizedVoteType = normalizeVoteType(voteType);
  const appVoteOption = toAppVoteOption(normalizedVoteType);
  const voteValue = getVoteValue(normalizedVoteType);
  const trustWeight = 1.0;
  console.log("[vote] normalizedVoteType:", normalizedVoteType);
  console.log("[vote] voteValue:", voteValue);

  const existingVote = await fetchVoteRowForClaim(claimId, userId);

  if (existingVote.error) {
    logVoteSupabaseError({
      action: "existing-vote-check",
      claimId,
      userId,
      voteType: normalizedVoteType,
      error: { message: existingVote.error },
    });

    return {
      claim: claimResult.claim,
      error: existingVote.error,
    };
  }

  if (existingVote.vote) {
    console.log("[vote] user already voted:", existingVote.vote.vote_type);
    const updatedClaim = await fetchClaimAfterVoteTrigger(claimId);
    const existingVoteOption = toAppVoteOption(existingVote.vote.vote_type);

    return {
      ok: false,
      alreadyVoted: true,
      vote: existingVote.vote,
      claim: updatedClaim.claim
        ? {
            ...updatedClaim.claim,
            userVote: existingVoteOption,
          }
        : {
            ...claimResult.claim,
            userVote: existingVoteOption,
          },
      updatedClaim: updatedClaim.claim
        ? {
            ...updatedClaim.claim,
            userVote: existingVoteOption,
          }
        : null,
      error: ALREADY_VOTED_MESSAGE,
      message: ALREADY_VOTED_MESSAGE,
    };
  }

  const payload = {
    claim_id: claimId,
    user_id: userId,
    vote_type: normalizedVoteType,
    vote_value: voteValue,
    trust_weight: trustWeight,
    accepted: true,
    suspicious: false,
    rejected_reason: null,
  };
  console.log("[vote] insert payload:", payload);

  const { error } = await supabase.from("votes").insert(payload);

  if (error) {
    logVoteSupabaseError({
      action: "insert",
      claimId,
      userId,
      voteType: normalizedVoteType,
      error,
    });

    if (error.code === "23505") {
      const duplicateVote = await fetchVoteRowForClaim(claimId, userId);
      const duplicateVoteType = duplicateVote.vote?.vote_type ?? normalizedVoteType;
      const duplicateVoteOption = toAppVoteOption(duplicateVoteType);
      const updatedClaim = await fetchClaimAfterVoteTrigger(claimId, true);

      console.log("[vote] user already voted:", duplicateVoteType);

      return {
        ok: false,
        alreadyVoted: true,
        vote: duplicateVote.vote,
        claim: updatedClaim.claim
          ? {
              ...updatedClaim.claim,
              userVote: duplicateVoteOption,
            }
          : {
              ...claimResult.claim,
              userVote: duplicateVoteOption,
            },
        updatedClaim: updatedClaim.claim
          ? {
              ...updatedClaim.claim,
              userVote: duplicateVoteOption,
            }
          : null,
        error: ALREADY_VOTED_MESSAGE,
        message: ALREADY_VOTED_MESSAGE,
      };
    }

    return {
      claim: claimResult.claim,
      error: getVoteErrorMessage(error.message),
    };
  }

  if (profile) {
    const { error: profileUpdateError } = await supabase
      .from("profiles")
      .update({
        votes_cast: (profile.votes_cast ?? 0) + 1,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId);

    if (profileUpdateError) {
      console.log("[vote] Profile votes_cast update failed", {
        userId,
        code: profileUpdateError.code,
        message: profileUpdateError.message,
        details: profileUpdateError.details,
      });
    }
  }

  console.log("[vote] inserted vote, refetching claim:", claimId);
  const updatedClaim = await fetchClaimAfterVoteTrigger(claimId, true);

  if (!updatedClaim.claim) {
    console.log("[vote] Vote was inserted but claim refetch failed", {
      claimId,
      userId,
      voteType: normalizedVoteType,
      error: updatedClaim.error,
    });

    return {
      claim: {
        ...claimResult.claim,
        userVote: appVoteOption,
      },
      updatedClaim: null,
      message: "Vote saved, but count refresh failed.",
      countRefreshFailed: true,
    };
  }

  return {
    ok: true,
    claim: {
      ...updatedClaim.claim,
      userVote: appVoteOption,
    },
    updatedClaim: {
      ...updatedClaim.claim,
      userVote: appVoteOption,
    },
    message: "Vote saved.",
  };
}

export async function removeVote(claimId: string, userId: string): Promise<ClaimVoteResult> {
  const { error } = await supabase.from("votes").delete().eq("claim_id", claimId).eq("user_id", userId);

  if (error) {
    return {
      claim: null,
      error: getVoteErrorMessage(error.message),
    };
  }

  const updatedClaim = await recalculateVoteCounts(claimId);

  if (!updatedClaim.claim) {
    return updatedClaim;
  }

  return {
    claim: {
      ...updatedClaim.claim,
      userVote: null,
    },
  };
}
