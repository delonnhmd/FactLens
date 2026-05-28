// PHASE 3 VERIFICATION ENGINE
import type { VoteOption } from "./claim";

export type VerificationMode = "test" | "production";
export type VerificationVerdict = "true" | "fake" | "unsure" | "pending";
export type SourceQuality = "official" | "mainstream" | "blog" | "unknown";
export type VerificationUserRole = "new" | "regular" | "verified" | "high_accuracy" | "expert";

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
  vote: Exclude<VoteOption, "NOT_SURE">;
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
