import { Bot } from "lucide-react";

import type { AiStatus } from "@/lib/types/claim";
import { getAiRiskSignalLabel } from "@/lib/utils/claim-display";

interface AiRiskSignalProps {
  readonly status: AiStatus | null;
  readonly confidence: number | null;
  readonly summary?: string | null;
  readonly expanded?: boolean;
}

function formatConfidence(value: number): string {
  const normalized = value <= 1 ? value * 100 : value;
  return `${Math.round(Math.min(100, Math.max(0, normalized)))}% signal confidence`;
}

export function AiRiskSignal({ status, confidence, summary, expanded = false }: AiRiskSignalProps) {
  return (
    <section
      aria-label="AI risk signal"
      className="rounded-[var(--ff-radius-card)] border border-[color-mix(in_srgb,var(--ff-ai)_25%,var(--ff-border))] bg-[color-mix(in_srgb,var(--ff-ai)_5%,white)] p-4"
    >
      <div className="flex items-start gap-3">
        <Bot aria-hidden="true" className="mt-0.5 shrink-0 text-[var(--ff-ai)]" size={19} strokeWidth={1.8} />
        <div className="min-w-0">
          <p className="text-sm font-medium text-[var(--ff-ai)]">AI risk signal · {getAiRiskSignalLabel(status)}</p>
          {confidence !== null ? (
            <p className="mt-1 text-xs text-[var(--ff-text-muted)]">{formatConfidence(confidence)}</p>
          ) : null}
          {expanded && summary ? (
            <p className="mt-3 whitespace-pre-line text-sm leading-6 text-[var(--ff-text-secondary)]">{summary}</p>
          ) : null}
          <p className="mt-2 text-xs leading-5 text-[var(--ff-text-muted)]">
            AI flags possible risk. It is not the final judge or the community verdict.
          </p>
        </div>
      </div>
    </section>
  );
}
