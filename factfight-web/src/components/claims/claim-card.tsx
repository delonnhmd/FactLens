import { ArrowRight, ExternalLink } from "lucide-react";
import Link from "next/link";

import { ClaimMedia } from "@/components/claims/claim-media";
import { ClaimStatusBadge } from "@/components/claims/claim-status-badge";
import { SourceQualityBadge } from "@/components/claims/source-quality-badge";
import { TranslatableClaimText } from "@/components/claims/translatable-claim-text";
import { Avatar } from "@/components/ui/avatar";
import { VoteActionPanel } from "@/components/voting/vote-action-panel";
import { VoteBreakdown } from "@/components/voting/vote-breakdown";
import type { PublicClaim } from "@/lib/types/claim";
import type { VoteType } from "@/lib/validation/claim-actions";
import { getClaimTypeLabel } from "@/lib/utils/claim-display";
import { isVotingOpen } from "@/lib/utils/claim-voting";
import { formatAbsoluteDate } from "@/lib/utils/dates";
import { getSourceDomain } from "@/lib/utils/urls";

interface ClaimCardProps {
  readonly claim: PublicClaim;
  // The signed-in viewer's existing vote on this claim (null/undefined when
  // unknown or signed out). Passed by pages that can resolve it so a voted
  // claim never presents as unvoted.
  readonly viewerVote?: VoteType | null;
}

export function ClaimCard({ claim, viewerVote = null }: ClaimCardProps) {
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

        <TranslatableClaimText
          claimId={claim.id}
          description={claim.description}
          href={`/claim/${claim.id}`}
          title={claim.title}
          variant="card"
        />

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

        {/* The AI risk signal box is intentionally NOT rendered on the feed
            card — it stays on the claim detail page, where the full context
            lives. The underlying AI analysis data is untouched. */}
        <div className="mt-5 border-t border-[var(--ff-border)] pt-5">
          <VoteBreakdown votes={claim.votes} />
        </div>

        {/* Vote buttons directly below the vote bar — same panel as the claim
            detail page, including the "You voted X" state once a vote exists. */}
        <VoteActionPanel
          claimId={claim.id}
          compact
          pathIdentifier={claim.id}
          viewerVote={viewerVote}
          votingOpen={isVotingOpen(claim)}
        />

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
