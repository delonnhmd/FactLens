// PHASE 1 STEP 1
import type { User } from "./user";

// PHASE 2 STEP 1
export type ClaimStatus =
  | "OPEN"
  | "VOTING_CLOSED"
  | "COMMUNITY_TRUE"
  | "COMMUNITY_FAKE"
  | "NEEDS_MORE_EVIDENCE"
  | "FINAL_TRUE"
  | "FINAL_FAKE"
  | "MIXED";

export type VoteOption = "TRUE" | "FAKE" | "NOT_SURE";

export interface Claim {
  id: string;
  title: string;
  description: string;
  sourceUrl: string;
  votesTrue: number;
  votesFake: number;
  votesUnsure: number;
  status: ClaimStatus;
  createdAt: string;
  expiresAt: string;
  userVote?: VoteOption;
  author: User;
}
