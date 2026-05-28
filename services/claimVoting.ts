// PHASE 2 STEP 3
import type { Claim, ClaimStatus } from "../types/claim";
import type { VerificationMode } from "../types/verification";
import {
  calculateClaimVerificationResult,
  canAcceptVerificationVote,
  getVerdictPublishesAt,
  getVerificationVerdictReason,
  getVotingClosesAt,
  mapVerificationVerdictToStatus,
} from "./verificationEngine";

const DEFAULT_VERIFICATION_MODE: VerificationMode = "test";

export type AutomaticVerdictStatus = "COMMUNITY_TRUE" | "COMMUNITY_FAKE" | "NEEDS_MORE_EVIDENCE";

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
  claim: Pick<Claim, "expiresAt"> & Partial<Pick<Claim, "createdAt">>,
  now = new Date(),
  mode: VerificationMode = DEFAULT_VERIFICATION_MODE,
): boolean {
  if (claim.createdAt) {
    return canAcceptVerificationVote(claim.createdAt, mode, now);
  }

  return new Date(claim.expiresAt).getTime() > now.getTime();
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
  const status = mapVerificationVerdictToStatus(result.verdict);
  const labels: Record<AutomaticVerdictStatus, string> = {
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
  claim: Pick<Claim, "expiresAt" | "userVote"> & Partial<Pick<Claim, "createdAt">>,
  now = new Date(),
): boolean {
  return isVotingOpen(claim, now) && !claim.userVote;
}

export function getCurrentClaimStatus(claim: Claim, now = new Date()): ClaimStatus {
  // PHASE 3 STEP 10
  if (claim.status === "COMMUNITY_TRUE" || claim.status === "COMMUNITY_FAKE" || claim.status === "NEEDS_MORE_EVIDENCE") {
    return claim.status;
  }

  if (isVotingOpen(claim, now)) {
    return "OPEN";
  }

  if (new Date(claim.expiresAt).getTime() > now.getTime()) {
    return "VOTING_CLOSED";
  }

  return calculateAutomaticVerdict(claim).status;
}

export function applyCurrentClaimStatus(claim: Claim, now = new Date()): Claim {
  return {
    ...claim,
    status: getCurrentClaimStatus(claim, now),
  };
}
