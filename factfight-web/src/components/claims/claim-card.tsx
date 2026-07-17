import { ArrowRight, ExternalLink } from "lucide-react";
import Link from "next/link";

import { AiRiskSignal } from "@/components/claims/ai-risk-signal";
import { ClaimMedia } from "@/components/claims/claim-media";
import { ClaimStatusBadge } from "@/components/claims/claim-status-badge";
import { SourceQualityBadge } from "@/components/claims/source-quality-badge";
import { Avatar } from "@/components/ui/avatar";
import { VoteBreakdown } from "@/components/voting/vote-breakdown";
import type { PublicClaim } from "@/lib/types/claim";
import { getClaimTypeLabel } from "@/lib/utils/claim-display";
import { formatAbsoluteDate } from "@/lib/utils/dates";
import { getSourceDomain } from "@/lib/utils/urls";

interface ClaimCardProps {
  readonly claim: PublicClaim;
}

export function ClaimCard({ claim }: ClaimCardProps) {
  const sourceDomain = claim.sourceDomain ?? getSourceDomain(claim.sourceUrl);

  return (
    <article className="overflow-hidden rounded-[var(--ff-radius-card)] border border-[var(--ff-border)] bg-white">
      <div className="p-5 sm:p-6">
        <header className="flex items-center gap-3">
          <Avatar
            avatarUrl={claim.author.avatarUrl}
            displayName={claim.author.displayName}
            size="small"
            verified={claim.author.verified}
          />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-[var(--ff-text)]">{claim.author.displayName}</p>
            <p className="truncate text-xs text-[var(--ff-text-muted)]">
              @{claim.author.username} · {formatAbsoluteDate(claim.createdAt)}
            </p>
          </div>
        </header>

        <h2 className="mt-5 text-xl leading-7 font-medium text-[var(--ff-navy)] sm:text-2xl sm:leading-8">
          <Link className="rounded-sm hover:underline" href={`/claim/${claim.id}`}>
            {claim.title}
          </Link>
        </h2>
        {claim.description ? (
          <p className="mt-3 line-clamp-3 whitespace-pre-line leading-7 text-[var(--ff-text-secondary)]">
            {claim.description}
          </p>
        ) : null}

        <div className="mt-5">
          <ClaimMedia claim={claim} />
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {claim.category ? (
            <span className="rounded-full border border-[var(--ff-border)] bg-white px-2.5 py-1 text-xs text-[var(--ff-text-secondary)]">
              {claim.category}
            </span>
          ) : null}
          <span className="rounded-full border border-[var(--ff-border)] bg-white px-2.5 py-1 text-xs text-[var(--ff-text-secondary)]">
            {getClaimTypeLabel(claim.claimType)}
          </span>
          <ClaimStatusBadge status={claim.status} />
        </div>

        {claim.sourceUrl ? (
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <a
              className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--ff-navy)] hover:underline"
              href={claim.sourceUrl}
              rel="noopener noreferrer"
              target="_blank"
            >
              <ExternalLink aria-hidden="true" size={14} strokeWidth={1.8} />
              {sourceDomain ? `Source: ${sourceDomain}` : "View source"}
            </a>
            <SourceQualityBadge quality={claim.sourceQuality} score={claim.sourceScore} />
          </div>
        ) : null}

        <div className="mt-5">
          <AiRiskSignal confidence={claim.aiConfidence} status={claim.aiStatus} />
        </div>

        <div className="mt-5 border-t border-[var(--ff-border)] pt-5">
          <VoteBreakdown votes={claim.votes} />
        </div>

        <div className="mt-5 border-t border-[var(--ff-border)] pt-4">
          <Link
            className="inline-flex items-center gap-2 rounded-sm text-sm font-medium text-[var(--ff-navy)] hover:underline"
            href={`/claim/${claim.id}`}
          >
            Read full claim
            <ArrowRight aria-hidden="true" size={16} strokeWidth={1.8} />
          </Link>
        </div>
      </div>
    </article>
  );
}
