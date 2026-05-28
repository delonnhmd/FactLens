// PHASE 3 STEP 4
import { supabase } from "../lib/supabase";
import { fetchClaimById, finalizeExpiredClaim } from "./claimService";
import { isVotingOpen } from "./claimVoting";
import {
  buildVerificationResponse,
  getUserTrustWeight,
  getVerificationVerdictReason,
  mapVerificationVerdictToStatus,
} from "./verificationEngine";
import type { Claim, VoteOption } from "../types/claim";
import type { VerificationVote } from "../types/verification";
import type { Profile } from "./profileService";

export type VoteType = "TRUE" | "FAKE" | "UNSURE";

export interface VoteRow {
  id: string;
  claim_id: string;
  user_id: string;
  vote_type: VoteType;
  // PHASE 3 STEP 17
  vote_value: number | null;
  trust_weight: number | null;
  accepted: boolean | null;
  suspicious: boolean | null;
  rejected_reason: string | null;
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

// PHASE 3 STEP 17
function getVoteValue(vote: VoteOption): number | null {
  if (vote === "TRUE") {
    return 1;
  }

  if (vote === "FAKE") {
    return 0;
  }

  return null;
}

function mapVoteRowToVerificationVote(row: VoteRow): VerificationVote {
  return {
    id: row.id,
    userId: row.user_id,
    vote: toAppVoteOption(row.vote_type) ?? "NOT_SURE",
    createdAt: row.created_at,
    voteValue: row.vote_value,
    trustWeight: row.trust_weight ?? 1,
    manualTrustWeight: row.trust_weight ?? 1,
    accepted: row.accepted ?? true,
    suspicious: row.suspicious ?? false,
    rejectedReason: row.rejected_reason,
  };
}

function getProfileTrustWeight(profile: Profile | null | undefined, mode: Claim["mode"]): number {
  return getUserTrustWeight(
    {
      verified: profile?.verified ?? false,
      votesCast: profile?.votes_cast ?? 0,
      accuracyRate: profile?.accuracy_rate ?? null,
      trustTier: profile?.trust_tier ?? "new",
      trustWeightOverride: profile?.trust_weight_override ?? null,
    },
    mode,
  );
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
  const claimResult = await fetchClaimById(claimId);

  if (claimResult.error || !claimResult.claim) {
    return {
      claim: null,
      error: claimResult.error ?? "Claim not found.",
    };
  }

  const votesResult = await fetchVotesForClaim(claimId);

  if (votesResult.error) {
    return {
      claim: claimResult.claim,
      error: votesResult.error,
    };
  }

  const acceptedVotes = votesResult.votes.filter((vote) => vote.accepted ?? true);
  const votesTrue = acceptedVotes.filter((vote) => vote.vote_type === "TRUE").length;
  const votesFake = acceptedVotes.filter((vote) => vote.vote_type === "FAKE").length;
  const votesUnsure = acceptedVotes.filter((vote) => vote.vote_type === "UNSURE").length;
  const totalVotes = votesTrue + votesFake + votesUnsure;
  const verificationVotes = acceptedVotes.map(mapVoteRowToVerificationVote);
  const verificationResponse = buildVerificationResponse(claimResult.claim, verificationVotes);
  const earlyStatus = verificationResponse.early_verdict_fired
    ? mapVerificationVerdictToStatus(verificationResponse.verdict)
    : undefined;
  const updateRow = {
    votes_true: votesTrue,
    votes_fake: votesFake,
    votes_unsure: votesUnsure,
    total_votes: totalVotes,
    current_phase: verificationResponse.current_phase,
    weighted_community_score: verificationResponse.weighted_community_score,
    final_score: verificationResponse.final_score,
    phase4_locked: verificationResponse.phase4_locked,
    early_verdict_fired: verificationResponse.early_verdict_fired,
    suspicious_activity: verificationResponse.suspicious_activity,
    ...(earlyStatus
      ? {
          status: earlyStatus,
          verdict_reason: getVerificationVerdictReason(verificationResponse),
          verdict_calculated_at: new Date().toISOString(),
          published_at: new Date().toISOString(),
        }
      : {}),
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase.from("claims").update(updateRow).eq("id", claimId);

  if (error) {
    return {
      claim: claimResult.claim,
      error: getVoteErrorMessage(error.message),
    };
  }

  const result = await fetchClaimById(claimId);

  if (result.error || !result.claim) {
    return {
      claim: claimResult.claim,
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
  profile?: Profile | null,
): Promise<ClaimVoteResult> {
  const claimResult = await fetchClaimById(claimId);

  if (claimResult.error || !claimResult.claim) {
    return {
      claim: null,
      error: claimResult.error ?? "Claim not found.",
    };
  }

  if (
    claimResult.claim.publishedAt ||
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

  if (!isVotingOpen(claimResult.claim)) {
    // PHASE 3 STEP 10
    const finalizedClaim =
      new Date(claimResult.claim.scoreLockAt).getTime() <= Date.now()
        ? await finalizeExpiredClaim(claimId)
        : { claim: claimResult.claim };

    return {
      claim: finalizedClaim.claim ?? claimResult.claim,
      error:
        new Date(claimResult.claim.scoreLockAt).getTime() <= Date.now()
          ? "This claim is read-only."
          : "Voting is closed. Final score is being locked.",
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
    return {
      claim: {
        ...claimResult.claim,
        userVote: toAppVoteOption(existingVote.vote.vote_type),
      },
      error: "You have already voted on this claim.",
    };
  } else {
    const voteValue = getVoteValue(voteType);
    const trustWeight = getProfileTrustWeight(profile, claimResult.claim.mode);
    const { error } = await supabase.from("votes").insert({
      claim_id: claimId,
      user_id: userId,
      vote_type: dbVoteType,
      vote_value: voteValue,
      trust_weight: trustWeight,
      accepted: true,
      suspicious: false,
      rejected_reason: null,
    });

    if (error) {
      return {
        claim: claimResult.claim,
        error: getVoteErrorMessage(error.message),
      };
    }

    if (profile) {
      await supabase
        .from("profiles")
        .update({
          votes_cast: (profile.votes_cast ?? 0) + 1,
          updated_at: new Date().toISOString(),
        })
        .eq("id", userId);
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
