import Link from "next/link";

import type { VoteHistoryItem, VoteHistoryResult } from "@/lib/types/vote-history";
import { formatRelativePastDate } from "@/lib/utils/dates";
import { getFinalResultLabel, voteLabels } from "@/lib/utils/vote-history";

const resultDisplay: Readonly<
  Record<VoteHistoryResult, { readonly symbol: string; readonly label: string; readonly className: string }>
> = Object.freeze({
  MATCHED: {
    symbol: "✓",
    label: "Matched final verdict",
    className: "text-[var(--ff-true)]",
  },
  DID_NOT_MATCH: {
    symbol: "✕",
    label: "Did not match final verdict",
    className: "text-[var(--ff-fake)]",
  },
  PENDING: {
    symbol: "⏳",
    label: "Verdict pending",
    className: "text-[#8A5700]",
  },
});

interface VoteHistoryCardProps {
  readonly item: VoteHistoryItem;
}

export function VoteHistoryCard({ item }: VoteHistoryCardProps) {
  const result = resultDisplay[item.result];

  return (
    <article className="rounded-[var(--ff-radius-card)] border border-[var(--ff-border)] bg-white p-5 sm:p-6">
      <h2 className="text-xl leading-7 font-medium text-[var(--ff-navy)]">
        <Link className="rounded-sm hover:underline" href={`/claim/${item.claimId}`}>
          {item.claimTitle}
        </Link>
      </h2>

      <dl className="mt-4 space-y-2 text-sm leading-6">
        <div className="flex flex-wrap gap-x-1.5">
          <dt className="text-[var(--ff-text-secondary)]">Your vote:</dt>
          <dd className="font-medium text-[var(--ff-text)]">{voteLabels[item.voteType]}</dd>
        </div>
        <div className="flex flex-wrap gap-x-1.5">
          <dt className="text-[var(--ff-text-secondary)]">Final result:</dt>
          <dd className="font-medium text-[var(--ff-text)]">{getFinalResultLabel(item.claimStatus)}</dd>
        </div>
      </dl>

      <p className="mt-4 text-sm text-[var(--ff-text-muted)]">
        Voted {formatRelativePastDate(item.votedAt)}
      </p>

      <div className="mt-5 border-t border-[var(--ff-border)] pt-4">
        <p className="text-xs text-[var(--ff-text-muted)]">Result:</p>
        <p className={`mt-1 flex items-center gap-2 text-sm font-medium ${result.className}`}>
          <span aria-hidden="true">{result.symbol}</span>
          {result.label}
        </p>
      </div>
    </article>
  );
}
