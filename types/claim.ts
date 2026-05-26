// PHASE 1 STEP 1
import type { User } from "./user";

// PHASE 2 STEP 3
export type ClaimStatus =
  | "OPEN"
  | "VOTING_CLOSED"
  | "COMMUNITY_TRUE"
  | "COMMUNITY_FAKE"
  | "NEEDS_MORE_EVIDENCE";

export type VoteOption = "TRUE" | "FAKE" | "NOT_SURE";

// PHASE 2 STEP 4
export type EvidenceType = "SUPPORTS_TRUE" | "SUPPORTS_FAKE" | "ADDS_CONTEXT" | "UNCLEAR";

export interface Evidence {
  id: string;
  url: string;
  note: string;
  type: EvidenceType;
  createdAt: string;
}

export interface Claim {
  id: string;
  title: string;
  description: string;
  sourceUrl: string;
  // PHASE 2 STEP 2
  category?: string;
  votesTrue: number;
  votesFake: number;
  votesUnsure: number;
  status: ClaimStatus;
  createdAt: string;
  expiresAt: string;
  userVote: VoteOption | null;
  evidence: Evidence[];
  author: User;
}
