import type { ClaimStatus, PublicClaim } from "@/lib/types/claim";

const closedStatuses = new Set<ClaimStatus>([
  "FINALIZED_TRUE",
  "FINALIZED_FAKE",
  "INSUFFICIENT_DATA",
  "LOCKED",
  "VOTING_CLOSED",
  "COMMUNITY_TRUE",
  "COMMUNITY_FAKE",
  "NEEDS_MORE_EVIDENCE",
]);

const finalStatuses = new Set<ClaimStatus>([
  "FINALIZED_TRUE",
  "FINALIZED_FAKE",
  "INSUFFICIENT_DATA",
  "COMMUNITY_TRUE",
  "COMMUNITY_FAKE",
  "NEEDS_MORE_EVIDENCE",
]);

export function isVotingOpen(claim: Pick<PublicClaim, "status" | "voteAcceptUntil">): boolean {
  if (claim.status && closedStatuses.has(claim.status)) {
    return false;
  }

  if (claim.voteAcceptUntil) {
    const deadline = new Date(claim.voteAcceptUntil).getTime();
    if (!Number.isNaN(deadline) && deadline <= Date.now()) {
      return false;
    }
  }

  return true;
}

// The claim has a server-published verdict.
export function getFinalStatus(claim: Pick<PublicClaim, "status">): ClaimStatus | null {
  return claim.status && finalStatuses.has(claim.status) ? claim.status : null;
}

// 24H MODEL: voting ends and finalization becomes due at the same 24-hour
// mark; the scheduled server sweep publishes the verdict within minutes.
// This covers that brief in-between window.
export function isAwaitingFinalization(claim: Pick<PublicClaim, "status" | "voteAcceptUntil">): boolean {
  return !getFinalStatus(claim) && !isVotingOpen(claim);
}
