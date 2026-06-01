// PHASE 3 VERIFICATION ENGINE
// PHASE 3 STEP 29
import type { VoteOption } from "./claim";

export type VerificationMode = "test" | "production";
export type VerificationVerdict = "true" | "fake" | "unsure" | "pending";
// PHASE 4 STEP 9
export type SourceQuality = "official" | "mainstream" | "specialized" | "social" | "blog" | "unknown";
export type VerificationUserRole = "new_user" | "new" | "regular" | "verified" | "high_accuracy" | "expert";

// PHASE 3 STEP 17
export interface VerificationTrustProfile {
  verified?: boolean;
  emailConfirmed?: boolean;
  votesCast?: number;
  accuracyRate?: number | null;
  trustTier?: VerificationUserRole | null;
  trustWeightOverride?: number | null;
}

export interface AiScanOutput {
  ai_confidence: number;
  source_count: number;
  source_quality: SourceQuality;
  red_flags: string[];
  summary: string;
}

export interface VerificationVote {
  id?: string;
  userId: string;
  vote: VoteOption;
  createdAt: string;
  userCreatedAt?: string | null;
  userRole?: VerificationUserRole;
  votesCast?: number;
  emailConfirmed?: boolean;
  accuracyRate?: number | null;
  manualTrustWeight?: number | null;
  ipAddress?: string | null;
  sessionId?: string | null;
  sameDirectionStreak?: number;
  // PHASE 3 STEP 17
  voteValue?: number | null;
  trustWeight?: number | null;
  accepted?: boolean;
  suspicious?: boolean;
  rejectedReason?: string | null;
}

export interface VerificationInput {
  articleId: string;
  mode: VerificationMode;
  submittedAt: string;
  now?: Date;
  aiScan?: AiScanOutput | null;
  votes: VerificationVote[];
  expectedParticipation?: number;
}

export interface VerificationEngineResult {
  article_id: string;
  mode: VerificationMode;
  current_phase: number;
  time_remaining_seconds: number;
  vote_count: number;
  min_votes_met: boolean;
  ai_confidence: number;
  weighted_community_score: number;
  final_score: number;
  verdict: VerificationVerdict;
  early_verdict_fired: boolean;
  suspicious_activity: boolean;
  phase4_locked: boolean;
}
