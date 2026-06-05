// PHASE 1 STEP 1
import type { VerificationUserRole } from "./verification";
import type { ReputationBadge } from "../utils/reputation";

export interface User {
  // PHASE 2 STEP 9
  id: string;
  username: string;
  displayName: string;
  avatar: string | null;
  // PHASE 5 STEP 1E
  bio?: string | null;
  publicProfileSlug?: string | null;
  profileVisibility?: "public" | "private";
  verified: boolean;
  reputationScore: number;
  joinedAt: string;
  // PHASE 3 STEP 17
  votesCast: number;
  accuracyRate: number | null;
  trustTier: VerificationUserRole;
  trustWeightOverride: number | null;
  // PHASE 5 STEP 1
  trustScore: number;
  rankTitle: string;
  highestRankAchieved: string;
  reputationPoints: number;
  monthlyReputationPoints: number;
  correctVotes: number;
  incorrectVotes: number;
  evidenceCount: number;
  helpfulEvidenceCount: number;
  suspiciousFlags: number;
  badgeList: ReputationBadge[];
  lastActiveAt: string | null;
}
