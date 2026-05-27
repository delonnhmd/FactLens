// PHASE 3 STEP 4
import { supabase } from "../lib/supabase";
import { fetchClaimById } from "./claimService";
import type { Claim, VoteOption } from "../types/claim";

export type VoteType = "TRUE" | "FAKE" | "UNSURE";

export interface VoteRow {
  id: string;
  claim_id: string;
  user_id: string;
  vote_type: VoteType;
  created_at: string;
  updated_at: string;
}

interface VoteRowsResult {
  votes: VoteRow[];
  error?: string;
}

interface UserVoteResult {
  vote: VoteOption | null;
  error?: string;
}

interface ClaimVoteResult {
  claim: Claim | null;
  error?: string;
}

function toDbVoteType(vote: VoteOption): VoteType {
  return vote === "NOT_SURE" ? "UNSURE" : vote;
}

function toAppVoteOption(vote: VoteType | string | null): VoteOption | null {
  if (vote === "TRUE" || vote === "FAKE") {
    return vote;
  }

  if (vote === "UNSURE") {
    return "NOT_SURE";
  }

  return null;
}

function getVoteErrorMessage(message: string): string {
  const normalizedMessage = message.toLowerCase();

  if (normalizedMessage.includes("row-level security")) {
    return "You are not allowed to vote on this claim.";
  }

  if (normalizedMessage.includes("duplicate")) {
    return "You have already voted on this claim.";
  }

  return "We could not save your vote. Please try again.";
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
      error: result.error,
    };
  }

  return {
    vote: toAppVoteOption(result.vote?.vote_type ?? null),
  };
}

export async function recalculateVoteCounts(claimId: string): Promise<ClaimVoteResult> {
  const { error } = await supabase.rpc("recalculate_claim_vote_counts", {
    target_claim_id: claimId,
  });

  if (error) {
    return {
      claim: null,
      error: getVoteErrorMessage(error.message),
    };
  }

  const result = await fetchClaimById(claimId);

  if (result.error || !result.claim) {
    return {
      claim: null,
      error: result.error ?? "We could not refresh this claim after voting.",
    };
  }

  return {
    claim: result.claim,
  };
}

export async function voteOnClaim(
  claimId: string,
  userId: string,
  voteType: VoteOption,
): Promise<ClaimVoteResult> {
  const claimResult = await fetchClaimById(claimId);

  if (claimResult.error || !claimResult.claim) {
    return {
      claim: null,
      error: claimResult.error ?? "Claim not found.",
    };
  }

  if (new Date(claimResult.claim.expiresAt).getTime() <= Date.now()) {
    return {
      claim: claimResult.claim,
      error: "Voting is closed for this claim.",
    };
  }

  const dbVoteType = toDbVoteType(voteType);
  const existingVote = await fetchVoteRowForClaim(claimId, userId);

  if (existingVote.error) {
    return {
      claim: claimResult.claim,
      error: existingVote.error,
    };
  }

  if (existingVote.vote) {
    const { error } = await supabase
      .from("votes")
      .update({ vote_type: dbVoteType })
      .eq("claim_id", claimId)
      .eq("user_id", userId);

    if (error) {
      return {
        claim: claimResult.claim,
        error: getVoteErrorMessage(error.message),
      };
    }
  } else {
    const { error } = await supabase.from("votes").insert({
      claim_id: claimId,
      user_id: userId,
      vote_type: dbVoteType,
    });

    if (error) {
      return {
        claim: claimResult.claim,
        error: getVoteErrorMessage(error.message),
      };
    }
  }

  const updatedClaim = await recalculateVoteCounts(claimId);

  if (updatedClaim.error || !updatedClaim.claim) {
    return updatedClaim;
  }

  return {
    claim: {
      ...updatedClaim.claim,
      userVote: voteType,
    },
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

  if (updatedClaim.error || !updatedClaim.claim) {
    return updatedClaim;
  }

  return {
    claim: {
      ...updatedClaim.claim,
      userVote: null,
    },
  };
}
