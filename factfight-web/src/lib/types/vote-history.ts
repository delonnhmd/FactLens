import type { ClaimStatus } from "@/lib/types/claim";
import type { VoteType } from "@/lib/validation/claim-actions";

export type VoteHistoryResult = "MATCHED" | "DID_NOT_MATCH" | "PENDING";

export interface VoteHistoryItem {
  readonly claimId: string;
  readonly claimTitle: string;
  readonly claimStatus: ClaimStatus | null;
  readonly voteType: VoteType;
  readonly votedAt: string | null;
  readonly result: VoteHistoryResult;
}
