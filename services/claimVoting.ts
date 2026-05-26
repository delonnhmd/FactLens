// PHASE 2 STEP 3
import type { Claim, ClaimStatus } from "../types/claim";

const VOTING_WINDOW_MS = 24 * 60 * 60 * 1000;
const MIN_VERDICT_VOTES = 5;
const CLEAR_MAJORITY_PERCENT = 0.6;

export type AutomaticVerdictStatus = "COMMUNITY_TRUE" | "COMMUNITY_FAKE" | "NEEDS_MORE_EVIDENCE";

export interface AutomaticVerdict {
  status: AutomaticVerdictStatus;
  resultLabel: string;
  reason: string;
}

export function getExpiresAt(createdAt: string): string {
  return new Date(new Date(createdAt).getTime() + VOTING_WINDOW_MS).toISOString();
}

export function isVotingOpen(claim: Pick<Claim, "expiresAt">, now = new Date()): boolean {
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
  claim: Pick<Claim, "votesTrue" | "votesFake" | "votesUnsure">,
): AutomaticVerdict {
  const trueVotes = claim.votesTrue;
  const fakeVotes = claim.votesFake;
  const unsureVotes = claim.votesUnsure;
  const totalVotes = trueVotes + fakeVotes + unsureVotes;

  if (totalVotes < MIN_VERDICT_VOTES) {
    return {
      status: "NEEDS_MORE_EVIDENCE",
      resultLabel: "Needs More Evidence",
      reason: "Not enough community votes.",
    };
  }

  if (unsureVotes > trueVotes && unsureVotes > fakeVotes) {
    return {
      status: "NEEDS_MORE_EVIDENCE",
      resultLabel: "Needs More Evidence",
      reason: "Most voters were unsure.",
    };
  }

  if (trueVotes > fakeVotes && trueVotes / totalVotes >= CLEAR_MAJORITY_PERCENT) {
    return {
      status: "COMMUNITY_TRUE",
      resultLabel: "Community Says True",
      reason: "True received at least 60% of total votes.",
    };
  }

  if (fakeVotes > trueVotes && fakeVotes / totalVotes >= CLEAR_MAJORITY_PERCENT) {
    return {
      status: "COMMUNITY_FAKE",
      resultLabel: "Community Says Fake",
      reason: "Fake received at least 60% of total votes.",
    };
  }

  return {
    status: "NEEDS_MORE_EVIDENCE",
    resultLabel: "Needs More Evidence",
    reason: "Vote result was too close.",
  };
}

export function canUserVote(claim: Pick<Claim, "expiresAt" | "userVote">, now = new Date()): boolean {
  return isVotingOpen(claim, now) && !claim.userVote;
}

export function getCurrentClaimStatus(claim: Claim, now = new Date()): ClaimStatus {
  if (isVotingOpen(claim, now)) {
    return "OPEN";
  }

  return calculateAutomaticVerdict(claim).status;
}

export function applyCurrentClaimStatus(claim: Claim, now = new Date()): Claim {
  return {
    ...claim,
    status: getCurrentClaimStatus(claim, now),
  };
}
