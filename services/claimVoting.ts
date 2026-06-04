// PHASE 2 STEP 3
import type { Claim, ClaimStatus } from "../types/claim";
import { DEFAULT_VERIFICATION_MODE } from "../constants/verificationConfig";
import type { VerificationMode } from "../types/verification";
import {
  getScoreLockAt,
  getVoteAcceptUntil,
} from "../utils/verificationTiming";
import {
  calculateClaimVerificationResult,
  getVerdictPublishesAt,
  getVerificationPhase,
  getVerificationVerdictReason,
  getVotingClosesAt,
  isPhase4Locked,
  mapVerificationVerdictToStatus,
} from "./verificationEngine";

// PHASE 4 STEP 26
export type AutomaticVerdictStatus =
  | "FINALIZED_TRUE"
  | "FINALIZED_FAKE"
  | "INSUFFICIENT_DATA"
  | "NEEDS_MORE_EVIDENCE"
  | "COMMUNITY_TRUE"
  | "COMMUNITY_FAKE";

export interface AutomaticVerdict {
  status: AutomaticVerdictStatus;
  resultLabel: string;
  reason: string;
  // PHASE 3 VERIFICATION ENGINE
  finalScore?: number;
  weightedCommunityScore?: number;
}

export function getExpiresAt(createdAt: string, mode: VerificationMode = DEFAULT_VERIFICATION_MODE): string {
  return getVerdictPublishesAt(createdAt, mode);
}

// PHASE 3 VERIFICATION ENGINE
export function getVoteWindowClosesAt(createdAt: string, mode: VerificationMode = DEFAULT_VERIFICATION_MODE): string {
  return getVotingClosesAt(createdAt, mode);
}

export function isVotingOpen(
  // PHASE 3 STEP 22
  claim: Pick<Claim, "expiresAt"> &
    Partial<Pick<Claim, "createdAt" | "mode" | "voteAcceptUntil">>,
  now = new Date(),
  mode: VerificationMode = DEFAULT_VERIFICATION_MODE,
): boolean {
  return new Date(getVoteAcceptUntil({ ...claim, mode: claim.mode ?? mode })).getTime() > now.getTime();
}

export function getTimeRemaining(expiresAt: string, now = new Date()): string {
  const remainingMs = new Date(expiresAt).getTime() - now.getTime();

  if (!Number.isFinite(remainingMs) || remainingMs <= 0) {
    return "0m";
  }

  const totalMinutes = Math.ceil(remainingMs / (60 * 1000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours <= 0) {
    return `${minutes}m`;
  }

  return `${hours}h ${minutes}m`;
}

export function calculateAutomaticVerdict(
  claim: Pick<Claim, "id" | "createdAt" | "aiCheck" | "votesTrue" | "votesFake" | "votesUnsure">,
  mode: VerificationMode = DEFAULT_VERIFICATION_MODE,
  now = new Date(),
): AutomaticVerdict {
  const result = calculateClaimVerificationResult(claim, mode, now);
  const status =
    !result.min_votes_met && result.time_remaining_seconds === 0
      ? "INSUFFICIENT_DATA"
      : mapVerificationVerdictToStatus(result.verdict);
  const labels: Record<AutomaticVerdictStatus, string> = {
    FINALIZED_TRUE: "Finalized True",
    FINALIZED_FAKE: "Finalized Fake",
    INSUFFICIENT_DATA: "Insufficient Data",
    COMMUNITY_TRUE: "Community Says True",
    COMMUNITY_FAKE: "Community Says Fake",
    NEEDS_MORE_EVIDENCE: "Needs More Evidence",
  };

  return {
    status,
    resultLabel: labels[status],
    reason: getVerificationVerdictReason(result),
    finalScore: result.final_score,
    weightedCommunityScore: result.weighted_community_score,
  };
}

export function canUserVote(
  // PHASE 3 STEP 22
  claim: Pick<Claim, "expiresAt" | "userVote"> &
    Partial<Pick<Claim, "createdAt" | "mode" | "voteAcceptUntil">>,
  now = new Date(),
): boolean {
  return isVotingOpen(claim, now) && !claim.userVote;
}

export function getCurrentClaimStatus(claim: Claim, now = new Date()): ClaimStatus {
  // PHASE 3 STEP 10
  if (
    claim.status === "FINALIZED_TRUE" ||
    claim.status === "FINALIZED_FAKE" ||
    claim.status === "INSUFFICIENT_DATA" ||
    claim.status === "NEEDS_MORE_EVIDENCE" ||
    claim.status === "COMMUNITY_TRUE" ||
    claim.status === "COMMUNITY_FAKE"
  ) {
    return claim.status;
  }

  if (isVotingOpen(claim, now)) {
    return claim.earlyVerdictFired || claim.status === "EARLY_VERDICT" ? "EARLY_VERDICT" : "ACTIVE";
  }

  // PHASE 3 STEP 22
  if (new Date(getScoreLockAt(claim)).getTime() > now.getTime()) {
    return "LOCKED";
  }

  return calculateAutomaticVerdict(claim).status;
}

export function applyCurrentClaimStatus(claim: Claim, now = new Date()): Claim {
  return {
    ...claim,
    status: getCurrentClaimStatus(claim, now),
    currentPhase: getVerificationPhase(claim, now),
    phase4Locked: claim.phase4Locked || isPhase4Locked(claim.createdAt, claim.mode, now),
  };
}
