// PHASE 1 STEP 1
// PHASE 4 STEP 7
import type { User } from "./user";
import type { SourceQuality, VerificationMode } from "./verification";

// PHASE 2 STEP 3
export type ClaimStatus =
  | "OPEN"
  | "VOTING_CLOSED"
  | "COMMUNITY_TRUE"
  | "COMMUNITY_FAKE"
  | "NEEDS_MORE_EVIDENCE";

export type VoteOption = "TRUE" | "FAKE" | "NOT_SURE";

// PHASE 4 STEP 7
export type ClaimType = "FACTUAL" | "OPINION" | "SATIRE" | "QUESTION" | "PROMOTION" | "UNCLEAR";

// PHASE 3 STEP 17
export interface ClaimVote {
  id: string;
  claimId: string;
  userId: string;
  vote: VoteOption;
  voteValue: number | null;
  trustWeight: number;
  accepted: boolean;
  suspicious: boolean;
  rejectedReason: string | null;
  createdAt: string;
  updatedAt?: string;
}

// PHASE 2 STEP 4
export type EvidenceType = "SUPPORTS_TRUE" | "SUPPORTS_FAKE" | "ADDS_CONTEXT" | "UNCLEAR";

export interface Evidence {
  id: string;
  url: string;
  note: string;
  type: EvidenceType;
  createdAt: string;
  // PHASE 3 STEP 5
  userId?: string;
  sourceQualityLabel?: string | null;
  sourceQualityScore?: number | null;
  sourceQualityReason?: string | null;
}

// PHASE 2 STEP 6
export type ReportReason =
  | "Spam"
  | "Fake source"
  | "Duplicate claim"
  | "Harmful content"
  | "Misleading title"
  | "Harassment or abuse"
  | "Other";

export interface Report {
  id: string;
  claimId: string;
  // PHASE 3 STEP 6
  userId?: string;
  reason: ReportReason;
  note: string;
  createdAt: string;
  updatedAt?: string;
}

// PHASE 2 STEP 8
export interface ClaimMedia {
  imageUrl?: string | null;
  videoUrl?: string | null;
  youtubeUrl?: string | null;
  // PHASE 3 STEP 8
  videoPlatform?: string | null;
  youtubeThumbnailUrl?: string | null;
}

export interface AiCheck {
  // PHASE 4 STEP 1
  status:
    | "PENDING"
    | "LOW_RISK"
    | "MEDIUM_RISK"
    // PHASE 4 STEP 4
    | "HIGH_RISK"
    | "LIKELY_TRUE"
    | "LIKELY_FAKE"
    | "NEEDS_MORE_EVIDENCE"
    | "NOT_FACT_CHECKABLE"
    // PHASE 4 STEP 3
    | "ERROR";
  confidence: number | null;
  reason: string | null;
  // PHASE 3 STEP 25
  riskLabel: string | null;
  flags: string[];
  missingEvidence: string[];
  sourceNotes: string | null;
  checkedAt: string | null;
}

export interface Claim {
  id: string;
  slug: string;
  shareUrl: string;
  title: string;
  description: string;
  sourceUrl: string;
  media: ClaimMedia;
  aiCheck: AiCheck;
  // PHASE 4 STEP 6
  aiStatus: AiCheck["status"];
  aiConfidence: number | null;
  // PHASE 4 STEP 7
  claimType: ClaimType;
  // PHASE 2 STEP 2
  category?: string;
  votesTrue: number;
  votesFake: number;
  votesUnsure: number;
  // PHASE 3 STEP 10
  totalVotes: number;
  verdictReason: string | null;
  verdictCalculatedAt: string | null;
  // PHASE 3 STEP 17
  mode: VerificationMode;
  currentPhase: number;
  voteAcceptUntil: string;
  scoreLockAt: string;
  publishedAt: string | null;
  phase4Locked: boolean;
  earlyVerdictFired: boolean;
  suspiciousActivity: boolean;
  weightedCommunityScore: number;
  finalScore: number;
  minVotesRequired: number;
  expectedParticipation: number;
  sourceCount: number;
  sourceQuality: SourceQuality;
  // PHASE 4 STEP 9
  sourceDomain: string | null;
  sourceScore: number | null;
  sourceReason: string | null;
  redFlags: string[];
  aiSummary: string | null;
  status: ClaimStatus;
  createdAt: string;
  expiresAt: string;
  userVote: VoteOption | null;
  evidence: Evidence[];
  // PHASE 3 STEP 5
  evidenceCount: number;
  reports: Report[];
  reportCount: number;
  isFlagged: boolean;
  // PHASE 2 STEP 9
  authorId: string;
  authorUsername: string;
  authorDisplayName: string;
  authorVerified: boolean;
  author: User;
}
