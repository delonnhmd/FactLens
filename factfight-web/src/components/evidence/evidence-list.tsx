import { ExternalLink, FileText } from "lucide-react";

import { SourceQualityBadge } from "@/components/claims/source-quality-badge";
import type { EvidenceType, PublicEvidence } from "@/lib/types/evidence";
import { formatAbsoluteDate } from "@/lib/utils/dates";
import { getSourceDomain } from "@/lib/utils/urls";

interface EvidenceListProps {
  readonly evidence: readonly PublicEvidence[];
}

const evidenceLabels: Record<EvidenceType, string> = {
  SUPPORTS_TRUE: "Supports true",
  SUPPORTS_FAKE: "Supports fake",
  ADDS_CONTEXT: "Adds context",
  UNCLEAR: "Unclear",
};

export function EvidenceList({ evidence }: EvidenceListProps) {
  if (evidence.length === 0) {
    return (
      <div className="rounded-[var(--ff-radius-card)] border border-dashed border-[var(--ff-border)] bg-[var(--ff-surface)] px-5 py-8 text-center">
        <FileText aria-hidden="true" className="mx-auto text-[var(--ff-text-muted)]" size={28} strokeWidth={1.6} />
        <p className="mt-3 font-medium text-[var(--ff-text)]">No public evidence has been added yet</p>
        <p className="mt-1 text-sm text-[var(--ff-text-muted)]">Open the app to follow this claim as the community adds sources.</p>
      </div>
    );
  }

  return (
    <ol className="space-y-3">
      {evidence.map((item) => {
        const sourceDomain = getSourceDomain(item.url);

        return (
          <li className="rounded-[var(--ff-radius-card)] border border-[var(--ff-border)] p-4 sm:p-5" key={item.id}>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-[var(--ff-navy)] px-2.5 py-1 text-xs font-medium text-white">
                {evidenceLabels[item.type]}
              </span>
              <SourceQualityBadge quality={item.sourceQualityLabel} score={item.sourceQualityScore} />
            </div>
            {item.note ? <p className="mt-3 whitespace-pre-line text-sm leading-6 text-[var(--ff-text-secondary)]">{item.note}</p> : null}
            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--ff-text-muted)]">
              <span>Added by {item.contributorName}</span>
              {item.createdAt ? <span>{formatAbsoluteDate(item.createdAt)}</span> : null}
            </div>
            {item.url ? (
              <a
                className="mt-3 inline-flex items-center gap-1.5 rounded-sm text-sm font-medium text-[var(--ff-navy)] hover:underline"
                href={item.url}
                rel="noopener noreferrer"
                target="_blank"
              >
                <ExternalLink aria-hidden="true" size={14} strokeWidth={1.8} />
                {sourceDomain ?? "Open evidence source"}
              </a>
            ) : null}
            {item.sourceQualityReason ? (
              <p className="mt-2 text-xs leading-5 text-[var(--ff-text-muted)]">{item.sourceQualityReason}</p>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
