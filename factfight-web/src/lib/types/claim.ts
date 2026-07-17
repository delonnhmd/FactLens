import type { PublicClaimAuthor } from "./profile";

export const claimStatusValues = [
  "PENDING",
  "ACTIVE",
  "EARLY_VERDICT",
  "FINALIZED_TRUE",
  "FINALIZED_FAKE",
  "INSUFFICIENT_DATA",
  "LOCKED",
  "OPEN",
  "VOTING_CLOSED",
  "COMMUNITY_TRUE",
  "COMMUNITY_FAKE",
  "NEEDS_MORE_EVIDENCE",
] as const;

export type ClaimStatus = (typeof claimStatusValues)[number];

export const claimTypeValues = [
  "FACTUAL",
  "OPINION",
  "SATIRE",
  "QUESTION",
  "PROMOTION",
  "UNCLEAR",
] as const;

export type ClaimType = (typeof claimTypeValues)[number];

export const aiStatusValues = [
  "PENDING",
  "LOW_RISK",
  "MEDIUM_RISK",
  "HIGH_RISK",
  "LIKELY_TRUE",
  "LIKELY_FAKE",
  "NEEDS_MORE_EVIDENCE",
  "NOT_FACT_CHECKABLE",
  "ERROR",
] as const;

export type AiStatus = (typeof aiStatusValues)[number];

export interface ClaimVoteCounts {
  readonly true: number;
  readonly fake: number;
  readonly unsure: number;
  readonly total: number;
}

export interface PublicClaim {
  readonly id: string;
  readonly authorId: string | null;
  readonly author: PublicClaimAuthor;
  readonly title: string;
  readonly description: string;
  readonly sourceUrl: string | null;
  readonly videoUrl: string | null;
  readonly imageUrl: string | null;
  readonly thumbnailUrl: string | null;
  readonly category: string | null;
  readonly subCategory: string | null;
  readonly politicianTag: string | null;
  readonly createdAt: string | null;
  readonly claimType: ClaimType | null;
  readonly status: ClaimStatus | null;
  readonly currentPhase: number | null;
  readonly mode: string | null;
  readonly expiresAt: string | null;
  readonly voteAcceptUntil: string | null;
  readonly scoreLockAt: string | null;
  readonly votes: ClaimVoteCounts;
  readonly finalScore: number | null;
  readonly minimumVotesRequired: number | null;
  readonly aiStatus: AiStatus | null;
  readonly aiConfidence: number | null;
  readonly aiSummary: string | null;
  readonly sourceQuality: string | null;
  readonly sourceScore: number | null;
  readonly sourceDomain: string | null;
  readonly sourceCount: number;
  readonly sourceSupportsClaim: boolean | null;
  readonly sourceSupportSummary: string | null;
  readonly evidenceCount: number;
  readonly topicClusterId: string | null;
}
