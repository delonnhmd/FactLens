// PHASE 3 STEP 4
// PHASE 3 STEP 20D
// PHASE 3 STEP 20E
// PHASE 3 STEP 24
// PHASE 3 STEP 29
// PHASE 3 STEP 32
import { supabase } from "../lib/supabase";
import { getBackendUrl } from "../constants/apiConfig";
import { fetchWithAuthRetry } from "../utils/authFetch";
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

// PHASE 4 STEP 24
const ALREADY_VOTED_MESSAGE = "You already voted on this claim.";
const TRIGGER_REFETCH_DELAY_MS = 300;

// SINGLE WRITE PATH (step 2): route votes through POST /api/claims/{id}/vote so
// the server (JWT auth, one-vote, suspension, finalized/deadline gates) is the
// single enforcement point — same pattern as USE_API_CREATE in claimService.
// Flip to false for an instant rollback to the direct supabase-js insert below;
// the direct-insert RLS policy is intentionally NOT locked yet (Phase-4 HOLD).
const USE_API_VOTE = true;

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

  // PHASE 5 STEP 1
  return 0.5;
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
  return "Could not save vote right now.";
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

// SINGLE WRITE PATH (step 2): cast the vote through the server endpoint. The
// endpoint is the authoritative gate; on success we refetch the full (author-
// joined) claim via fetchClaimById so the returned shape is byte-identical to
// the direct path and the optimistic-update UX is unchanged. Network failures
// surface a retry error — we NEVER fall back to a direct insert (that would
// bypass server enforcement).
export async function voteOnClaimViaApi(
  claimId: string,
  userId: string,
  voteType: VoteTypeInput,
): Promise<ClaimVoteResult> {
  const backendUrl = getBackendUrl();

  if (!backendUrl) {
    return { claim: null, error: "Verifact is temporarily unavailable. Please try again." };
  }

  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;

  if (!accessToken) {
    return { claim: null, error: "Please log in to vote." };
  }

  const normalizedVoteType = normalizeVoteType(voteType);
  const appVoteOption = toAppVoteOption(normalizedVoteType);

  let response: Response;
  let data: Record<string, unknown> = {};

  try {
    response = await fetchWithAuthRetry(
      `${backendUrl}/api/claims/${encodeURIComponent(claimId)}/vote`,
      (token) => ({
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ vote_type: normalizedVoteType }),
      }),
      accessToken,
    );

    try {
      data = (await response.json()) as Record<string, unknown>;
    } catch {
      data = {};
    }
  } catch (error) {
    console.log("[vote api] network error:", error);
    return { claim: null, error: "Unable to reach Verifact. Check your connection and try again." };
  }

  if (!response.ok) {
    const detail = typeof data.detail === "string" ? data.detail : "";
    const alreadyVoted = data.already_voted === true;

    if (response.status === 409 && alreadyVoted) {
      // The app usually catches "already voted" before this call, so this is a
      // race. Reconcile the UI with the server's truth (fresh counts + vote).
      const voteRow = (data.vote as VoteRow | undefined) ?? null;
      const existingOption =
        toAppVoteOption(voteRow?.vote_type) ??
        (await fetchUserVoteForClaim(claimId, userId)).vote ??
        appVoteOption;
      const updated = await fetchClaimById(claimId);

      return {
        ok: false,
        alreadyVoted: true,
        vote: voteRow,
        claim: updated.claim ? { ...updated.claim, userVote: existingOption } : null,
        updatedClaim: updated.claim ? { ...updated.claim, userVote: existingOption } : null,
        error: ALREADY_VOTED_MESSAGE,
        message: ALREADY_VOTED_MESSAGE,
      };
    }

    if (response.status === 401) {
      return { claim: null, error: "Please log in to vote." };
    }

    if (response.status === 403) {
      return { claim: null, error: detail || "This account cannot vote right now." };
    }

    if (response.status === 404) {
      return { claim: null, error: detail || "This claim is no longer available." };
    }

    if (response.status === 409) {
      return { claim: null, error: detail || "Voting is closed. Final score is being locked." };
    }

    if (response.status === 422) {
      return { claim: null, error: detail || "Could not record your vote. Please try again." };
    }

    if (response.status === 429) {
      return { claim: null, error: detail || "Too many votes right now. Please try again shortly." };
    }

    return { claim: null, error: detail || "Could not save vote right now." };
  }

  // Success — the endpoint already recalculated scores; refetch the joined claim.
  const updated = await fetchClaimById(claimId);

  if (!updated.claim) {
    return {
      ok: true,
      claim: null,
      updatedClaim: null,
      message: "Vote saved, but count refresh failed.",
      countRefreshFailed: true,
    };
  }

  return {
    ok: true,
    claim: { ...updated.claim, userVote: appVoteOption },
    updatedClaim: { ...updated.claim, userVote: appVoteOption },
    message: "Vote saved.",
  };
}

export async function voteOnClaim(
  claimId: string,
  userId: string,
  voteType: VoteTypeInput,
  profile?: Profile | null,
): Promise<ClaimVoteResult> {
  if (profile?.is_suspended) {
    return {
      claim: null,
      error: profile.suspension_reason || "This account is suspended from voting.",
    };
  }

  // SINGLE WRITE PATH (step 2): flag on → server endpoint; flag off → the
  // untouched direct-insert path below (instant rollback).
  if (USE_API_VOTE) {
    return voteOnClaimViaApi(claimId, userId, voteType);
  }

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
    claimResult.claim.status === "FINALIZED_TRUE" ||
    claimResult.claim.status === "FINALIZED_FAKE" ||
    claimResult.claim.status === "INSUFFICIENT_DATA" ||
    claimResult.claim.status === "COMMUNITY_TRUE" ||
    claimResult.claim.status === "COMMUNITY_FAKE" ||
    claimResult.claim.status === "NEEDS_MORE_EVIDENCE"
  ) {
    return {
      claim: claimResult.claim,
      error: "This claim is read-only.",
    };
  }

  if (claimResult.claim.phase4Locked || claimResult.claim.status === "VOTING_CLOSED" || claimResult.claim.status === "LOCKED") {
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

// PHASE 5 PRE-LAUNCH: aggregate a user's votes into True / Fake / Not sure counts for the profile.
export interface UserVotingActivity {
  totalVotes: number;
  trueVotes: number;
  fakeVotes: number;
  notSureVotes: number;
}

const EMPTY_VOTING_ACTIVITY: UserVotingActivity = {
  totalVotes: 0,
  trueVotes: 0,
  fakeVotes: 0,
  notSureVotes: 0,
};

export async function fetchUserVotingActivity(userId: string): Promise<UserVotingActivity> {
  if (!userId) {
    return { ...EMPTY_VOTING_ACTIVITY };
  }

  try {
    const { data, error } = await supabase
      .from("votes")
      .select("vote_type")
      .eq("user_id", userId)
      .limit(1000);

    if (error || !Array.isArray(data)) {
      // Never surface an error here — show zeros instead.
      return { ...EMPTY_VOTING_ACTIVITY };
    }

    let trueVotes = 0;
    let fakeVotes = 0;
    let notSureVotes = 0;

    for (const row of data) {
      const option = toAppVoteOption(row?.vote_type);

      if (option === "TRUE") {
        trueVotes += 1;
      } else if (option === "FAKE") {
        fakeVotes += 1;
      } else if (option === "NOT_SURE") {
        notSureVotes += 1;
      }
    }

    return {
      totalVotes: data.length,
      trueVotes,
      fakeVotes,
      notSureVotes,
    };
  } catch {
    return { ...EMPTY_VOTING_ACTIVITY };
  }
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
