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
