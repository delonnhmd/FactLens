import type { ClaimVoteCounts } from "@/lib/types/claim";
import { getVotePercentages } from "@/lib/utils/votes";

interface VoteBreakdownProps {
  readonly votes: ClaimVoteCounts;
}

export function VoteBreakdown({ votes }: VoteBreakdownProps) {
  const percentages = getVotePercentages(votes);
  const rows = [
    { key: "true", label: "True", count: votes.true, percentage: percentages.true, color: "var(--ff-true)" },
    { key: "fake", label: "Fake", count: votes.fake, percentage: percentages.fake, color: "var(--ff-fake)" },
    { key: "unsure", label: "Not sure", count: votes.unsure, percentage: percentages.unsure, color: "var(--ff-unsure)" },
  ] as const;

  return (
    <section aria-label="Community voting data">
      <p className="text-xs text-[var(--ff-text-muted)]">Community voting data · {votes.total} total votes</p>
      <div className="mt-3 space-y-2.5">
        {rows.map((row) => (
          <div className="grid grid-cols-[4rem_minmax(0,1fr)_2rem] items-center gap-2" key={row.key}>
            <span className="text-xs text-[var(--ff-text-secondary)]">{row.label}</span>
            <span className="h-2 overflow-hidden rounded-full bg-[var(--ff-surface)]">
              <span
                aria-hidden="true"
                className="block h-full rounded-full"
                style={{ backgroundColor: row.color, width: `${row.percentage}%` }}
              />
            </span>
            <span className="text-right text-xs font-medium text-[var(--ff-text)]">{row.count}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
