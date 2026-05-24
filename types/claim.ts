// PHASE 1 STEP 1
import type { User } from "./user";

export type ClaimStatus = "pending" | "true" | "fake" | "unsure";

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
  author: User;
}
