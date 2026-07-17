import type { ClaimVoteCounts } from "../types/claim";

export interface VotePercentages {
  readonly true: number;
  readonly fake: number;
  readonly unsure: number;
}

export function getVotePercentages(votes: ClaimVoteCounts): VotePercentages {
  if (votes.total <= 0) {
    return { true: 0, fake: 0, unsure: 0 };
  }

  const percentage = (count: number) => Math.min(100, Math.max(0, (count / votes.total) * 100));

  return {
    true: percentage(votes.true),
    fake: percentage(votes.fake),
    unsure: percentage(votes.unsure),
  };
}
