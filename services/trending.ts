// PHASE 2 STEP 7
// PHASE 3 STEP 32
import type { Claim } from "../types/claim";
import { isVotingOpen } from "./claimVoting";

function getRecencyBonus(createdAt: string, now = new Date()): number {
  const createdTime = new Date(createdAt).getTime();
  const ageMs = now.getTime() - createdTime;

  if (!Number.isFinite(ageMs) || ageMs < 0) {
    return 20;
  }

  const ageHours = ageMs / (60 * 60 * 1000);

  if (ageHours <= 6) {
    return 20;
  }

  if (ageHours <= 12) {
    return 10;
  }

  if (ageHours <= 24) {
    return 5;
  }

  return 0;
}

export function calculateTrendingScore(claim: Claim, now = new Date()): number {
  const totalVotes = claim.totalVotes;
  // PHASE 3 STEP 5
  const evidenceCount = claim.evidenceCount ?? claim.evidence.length;
  const openVotingBonus = isVotingOpen(claim, now) ? 10 : 0;

  return totalVotes * 3 + evidenceCount * 5 + claim.reportCount * 2 + getRecencyBonus(claim.createdAt, now) + openVotingBonus;
}
