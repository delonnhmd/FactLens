// PHASE 1 STEP 1
import type { VerificationUserRole } from "./verification";

export interface User {
  // PHASE 2 STEP 9
  id: string;
  username: string;
  displayName: string;
  avatar: string | null;
  verified: boolean;
  reputationScore: number;
  joinedAt: string;
  // PHASE 3 STEP 17
  votesCast: number;
  accuracyRate: number | null;
  trustTier: VerificationUserRole;
  trustWeightOverride: number | null;
}
