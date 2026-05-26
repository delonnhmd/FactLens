// PHASE 2 STEP 1
import type { Claim, ClaimStatus } from "../types/claim";

const VOTING_WINDOW_MS = 24 * 60 * 60 * 1000;
const CLOSE_RESULT_PERCENT = 0.1;
const MIN_CLEAR_LEAD = 3;

type CommunityResultStatus = "COMMUNITY_TRUE" | "COMMUNITY_FAKE" | "NEEDS_MORE_EVIDENCE";

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

export function calculateCommunityResult(claim: Pick<Claim, "votesTrue" | "votesFake" | "votesUnsure">): CommunityResultStatus {
  const totalVotes = claim.votesTrue + claim.votesFake + claim.votesUnsure;

  if (totalVotes <= 0) {
    return "NEEDS_MORE_EVIDENCE";
  }

  const voteGroups = [
    { status: "COMMUNITY_TRUE" as const, count: claim.votesTrue },
    { status: "COMMUNITY_FAKE" as const, count: claim.votesFake },
    { status: "NEEDS_MORE_EVIDENCE" as const, count: claim.votesUnsure },
  ].sort((a, b) => b.count - a.count);

  const [top, second] = voteGroups;
  const clearLeadNeeded = Math.max(MIN_CLEAR_LEAD, Math.ceil(totalVotes * CLOSE_RESULT_PERCENT));
  const lead = top.count - second.count;

  if (top.status === "NEEDS_MORE_EVIDENCE" || lead < clearLeadNeeded) {
    return "NEEDS_MORE_EVIDENCE";
  }

  return top.status;
}

export function canUserVote(claim: Pick<Claim, "expiresAt" | "userVote">, now = new Date()): boolean {
  return isVotingOpen(claim, now) && !claim.userVote;
}

export function getCurrentClaimStatus(claim: Claim, now = new Date()): ClaimStatus {
  if (claim.status === "FINAL_TRUE" || claim.status === "FINAL_FAKE" || claim.status === "MIXED") {
    return claim.status;
  }

  if (isVotingOpen(claim, now)) {
    return "OPEN";
  }

  return calculateCommunityResult(claim);
}

export function applyCurrentClaimStatus(claim: Claim, now = new Date()): Claim {
  return {
    ...claim,
    status: getCurrentClaimStatus(claim, now),
  };
}

