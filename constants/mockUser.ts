// PHASE 2 STEP 9
import type { User } from "../types/user";

export const mockUser: User = {
  id: "demo-user-1",
  username: "factlens_user",
  displayName: "Demo User",
  avatar: null,
  verified: true,
  reputationScore: 100,
  joinedAt: "2026-05-26T00:00:00.000Z",
  // PHASE 3 STEP 17
  votesCast: 0,
  accuracyRate: null,
  // PHASE 5 STEP 1
  trustTier: "BASIC",
  trustWeightOverride: null,
  trustScore: 50,
  rankTitle: "Claim Checker",
  highestRankAchieved: "Claim Checker",
  reputationPoints: 100,
  monthlyReputationPoints: 0,
  correctVotes: 0,
  incorrectVotes: 0,
  evidenceCount: 0,
  helpfulEvidenceCount: 0,
  suspiciousFlags: 0,
  badgeList: [],
  lastActiveAt: null,
};
