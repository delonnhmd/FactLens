import type { ClaimStatus } from "@/lib/types/claim";
import type { VoteHistoryResult } from "@/lib/types/vote-history";
import type { VoteType } from "@/lib/validation/claim-actions";

export const voteLabels: Readonly<Record<VoteType, string>> = Object.freeze({
  TRUE: "True",
  FAKE: "Fake",
  UNSURE: "Not sure",
});

export function getFinalVerdict(status: ClaimStatus | null): VoteType | null {
  if (status === "FINALIZED_TRUE" || status === "COMMUNITY_TRUE") return "TRUE";
  if (status === "FINALIZED_FAKE" || status === "COMMUNITY_FAKE") return "FAKE";
  if (status === "INSUFFICIENT_DATA" || status === "NEEDS_MORE_EVIDENCE") return "UNSURE";
  return null;
}

export function getVoteHistoryResult(voteType: VoteType, status: ClaimStatus | null): VoteHistoryResult {
  const finalVerdict = getFinalVerdict(status);

  if (!finalVerdict) return "PENDING";
  return voteType === finalVerdict ? "MATCHED" : "DID_NOT_MATCH";
}

export function getFinalResultLabel(status: ClaimStatus | null): string {
  const finalVerdict = getFinalVerdict(status);

  if (finalVerdict === "TRUE") return "Community says True";
  if (finalVerdict === "FAKE") return "Community says Fake";
  if (finalVerdict === "UNSURE") return "Needs more evidence";
  return "Verdict pending";
}
