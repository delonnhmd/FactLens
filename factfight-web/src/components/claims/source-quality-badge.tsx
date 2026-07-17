import { ShieldCheck } from "lucide-react";

import { getSourceQualityDisplay } from "@/lib/utils/claim-display";

interface SourceQualityBadgeProps {
  readonly quality: string | null;
  readonly score: number | null;
}

export function SourceQualityBadge({ quality, score }: SourceQualityBadgeProps) {
  const display = getSourceQualityDisplay(quality, score);
  const colors = {
    positive: "border-[color-mix(in_srgb,var(--ff-true)_35%,var(--ff-border))] bg-[color-mix(in_srgb,var(--ff-true)_8%,white)] text-[var(--ff-true)]",
    neutral: "border-[var(--ff-border)] bg-[var(--ff-surface)] text-[var(--ff-text-secondary)]",
    caution: "border-[color-mix(in_srgb,var(--ff-unsure)_40%,var(--ff-border))] bg-[color-mix(in_srgb,var(--ff-unsure)_9%,white)] text-[#8A5700]",
    danger: "border-[color-mix(in_srgb,var(--ff-fake)_35%,var(--ff-border))] bg-[color-mix(in_srgb,var(--ff-fake)_7%,white)] text-[var(--ff-fake)]",
  } as const;

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${colors[display.tone]}`}>
      <ShieldCheck aria-hidden="true" size={13} strokeWidth={1.8} />
      {display.label}
      {score !== null ? ` · ${Math.round(score)}/100` : ""}
    </span>
  );
}
