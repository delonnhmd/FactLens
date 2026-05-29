// PHASE 3 STEP 4
// PHASE 3 STEP 20D
// PHASE 3 STEP 20E
import { supabase } from "../lib/supabase";
import { fetchClaimById, finalizeExpiredClaim } from "./claimService";
import { getUserTrustWeight } from "./verificationEngine";
import { getScoreLockAt, getVoteAcceptUntil } from "../utils/verificationTiming";
import type { Claim, VoteOption } from "../types/claim";
import type { Profile } from "./profileService";

export type VoteType = "TRUE" | "FAKE" | "UNSURE";
type VoteTypeInput = VoteOption | VoteType | string;

export interface VoteRow {
  id?: string;
  claim_id?: string;
  user_id: string;
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
  vote?: VoteRow | null;
  error?: string;
  message?: string;
  ok?: boolean;
  alreadyVoted?: boolean;
  countRefreshFailed?: boolean;
}

interface VoteTotals {
  votesTrue: number;
  votesFake: number;
  votesUnsure: number;
  totalVotes: number;
  weightedCommunityScore: number;
  finalScore: number;
}

const ALREADY_VOTED_MESSAGE = "You already voted on this post.";

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

function parseNumber(value: number | string | null | undefined, fallback: number): number {
  if (value === null || value === undefined) {
    return fallback;
  }

  const parsedValue = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsedValue) ? parsedValue : fallback;
}

function normalizeAiConfidence(aiConfidence: number | null | undefined): number {
  const parsedConfidence = parseNumber(aiConfidence, 0.5);
  const normalizedConfidence = parsedConfidence > 1 ? parsedConfidence / 100 : parsedConfidence;

  return Math.min(1, Math.max(0, normalizedConfidence));
}

function roundScore(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function getEffectiveVoteValue(vote: VoteRow): number | null {
  const normalizedVoteType = normalizeVoteType(vote.vote_type);

  if (vote.vote_value !== null && vote.vote_value !== undefined) {
    return parseNumber(vote.vote_value, getVoteValue(normalizedVoteType) ?? 0);
  }

  return getVoteValue(normalizedVoteType);
}

function getEffectiveTrustWeight(vote: Pick<VoteRow, "trust_weight">): number {
  const trustWeight = parseNumber(vote.trust_weight, 1);
  return trustWeight > 0 ? trustWeight : 1;
}

function getProfileTrustWeight(profile: Profile | null | undefined, mode: Claim["mode"]): number {
  if (mode === "test") {
    return 1.0;
  }

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

function applyVoteTotalsToClaim(claim: Claim, totals: VoteTotals): Claim {
  return {
    ...claim,
    votesTrue: totals.votesTrue,
    votesFake: totals.votesFake,
    votesUnsure: totals.votesUnsure,
    totalVotes: totals.totalVotes,
    weightedCommunityScore: totals.weightedCommunityScore,
    finalScore: totals.finalScore,
  };
}

function calculateVoteTotals(claim: Claim, votes: VoteRow[]): VoteTotals {
  let votesTrue = 0;
  let votesFake = 0;
  let votesUnsure = 0;
  let weightedNumerator = 0;
  let weightedDenominator = 0;

  votes.forEach((vote) => {
    const normalizedVoteType = normalizeVoteType(vote.vote_type);

    if (normalizedVoteType === "TRUE") {
      votesTrue += 1;
    }

    if (normalizedVoteType === "FAKE") {
      votesFake += 1;
    }

    if (normalizedVoteType === "UNSURE") {
      votesUnsure += 1;
      return;
    }

    const voteValue = getEffectiveVoteValue(vote);

    if (voteValue === null) {
      return;
    }

    const trustWeight = getEffectiveTrustWeight(vote);
    weightedNumerator += voteValue * trustWeight;
    weightedDenominator += trustWeight;
  });

  const totalVotes = votesTrue + votesFake + votesUnsure;
  const weightedCommunityScore =
    weightedDenominator > 0 ? weightedNumerator / weightedDenominator : 0.5;
  const aiConfidence = normalizeAiConfidence(claim.aiCheck.confidence);
  const finalScore = aiConfidence * 0.4 + weightedCommunityScore * 0.6;

  return {
    votesTrue,
    votesFake,
    votesUnsure,
    totalVotes,
    weightedCommunityScore: roundScore(weightedCommunityScore),
    finalScore: roundScore(finalScore),
  };
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

async function fetchAcceptedVotesForClaim(claimId: string): Promise<VoteRowsResult> {
  const { data, error } = await supabase
    .from("votes")
    .select("id,claim_id,user_id,vote_type,vote_value,trust_weight,accepted,suspicious,rejected_reason,created_at,updated_at")
    .eq("claim_id", claimId)
    .eq("accepted", true);

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

async function persistClaimVoteTotals(
  claimId: string,
  totals: VoteTotals,
): Promise<{ claim: Claim | null; error?: string }> {
  const rpcResult = await supabase.rpc("recalculate_claim_vote_scores", {
    target_claim_id: claimId,
  });

  if (!rpcResult.error) {
    const refreshedClaim = await fetchClaimById(claimId);
    return {
      claim: refreshedClaim.claim,
      error: refreshedClaim.error,
    };
  }

  console.log("[vote] Vote score RPC failed; falling back to direct claim update", {
    claimId,
    code: rpcResult.error.code,
    message: rpcResult.error.message,
    details: rpcResult.error.details,
  });

  const { error } = await supabase
    .from("claims")
    .update({
      votes_true: totals.votesTrue,
      votes_fake: totals.votesFake,
      votes_unsure: totals.votesUnsure,
      total_votes: totals.totalVotes,
      weighted_community_score: totals.weightedCommunityScore,
      final_score: totals.finalScore,
      updated_at: new Date().toISOString(),
    })
    .eq("id", claimId);

  if (error) {
    console.log("[vote] Claim vote count update failed", {
      claimId,
      code: error.code,
      message: error.message,
      details: error.details,
    });

    return {
      claim: null,
      error: "Vote saved, but count refresh failed.",
    };
  }

  const refreshedClaim = await fetchClaimById(claimId);
  return {
    claim: refreshedClaim.claim,
    error: refreshedClaim.error,
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

  const votesResult = await fetchAcceptedVotesForClaim(claimId);

  if (votesResult.error) {
    return {
      claim: claimResult.claim,
      error: votesResult.error,
    };
  }

  const totals = calculateVoteTotals(claimResult.claim, votesResult.votes);
  console.log("[vote] recalculated counts:", totals);

  const localClaim = applyVoteTotalsToClaim(claimResult.claim, totals);
  const persistResult = await persistClaimVoteTotals(claimId, totals);

  if (persistResult.error || !persistResult.claim) {
    return {
      claim: localClaim,
      message: "Vote saved, but count refresh failed.",
      countRefreshFailed: true,
    };
  }

  return {
    claim: applyVoteTotalsToClaim(persistResult.claim, totals),
    message: "Vote saved.",
  };
}

export async function voteOnClaim(
  claimId: string,
  userId: string,
  voteType: VoteTypeInput,
  profile?: Profile | null,
): Promise<ClaimVoteResult> {
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
  const trustWeight = getProfileTrustWeight(profile, claimResult.claim.mode);
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
    const updatedClaim = await recalculateVoteCounts(claimId);

    return {
      ok: false,
      alreadyVoted: true,
      vote: existingVote.vote,
      claim: updatedClaim.claim
        ? {
            ...updatedClaim.claim,
            userVote: toAppVoteOption(existingVote.vote.vote_type),
          }
        : {
            ...claimResult.claim,
            userVote: toAppVoteOption(existingVote.vote.vote_type),
          },
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
      const updatedClaim = await recalculateVoteCounts(claimId);

      console.log("[vote] user already voted:", duplicateVoteType);

      return {
        ok: false,
        alreadyVoted: true,
        vote: duplicateVote.vote,
        claim: updatedClaim.claim
          ? {
              ...updatedClaim.claim,
              userVote: toAppVoteOption(duplicateVoteType),
            }
          : {
              ...claimResult.claim,
              userVote: toAppVoteOption(duplicateVoteType),
            },
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

  const updatedClaim = await recalculateVoteCounts(claimId);

  if (!updatedClaim.claim) {
    console.log("[vote] Vote was inserted but recalculation failed", {
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
    message: updatedClaim.message ?? "Vote saved.",
    countRefreshFailed: updatedClaim.countRefreshFailed,
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
