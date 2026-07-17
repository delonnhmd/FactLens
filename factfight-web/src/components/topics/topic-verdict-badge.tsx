import type { TopicVerdict } from "@/lib/types/topic";

interface TopicVerdictBadgeProps {
  readonly verdict: TopicVerdict;
}

const verdictDisplay: Record<TopicVerdict, { label: string; colors: string }> = {
  TRUE: {
    label: "Community leans true",
    colors: "border-emerald-200 bg-emerald-50 text-[var(--ff-true)]",
  },
  FAKE: {
    label: "Community leans fake",
    colors: "border-red-200 bg-red-50 text-[var(--ff-fake)]",
  },
  DISPUTED: {
    label: "Disputed",
    colors: "border-amber-200 bg-amber-50 text-[#8A5700]",
  },
  INSUFFICIENT_DATA: {
    label: "Not enough data",
    colors: "border-[var(--ff-border)] bg-[var(--ff-surface)] text-[var(--ff-text-secondary)]",
  },
};

export function TopicVerdictBadge({ verdict }: TopicVerdictBadgeProps) {
  const display = verdictDisplay[verdict];
  return <span className={`inline-flex rounded-full border px-3 py-1.5 text-sm font-medium ${display.colors}`}>{display.label}</span>;
}
