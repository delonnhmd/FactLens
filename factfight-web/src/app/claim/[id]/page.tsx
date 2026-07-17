import { ExternalLink, LogIn } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AiRiskSignal } from "@/components/claims/ai-risk-signal";
import { ClaimMedia } from "@/components/claims/claim-media";
import { ClaimStatusBadge } from "@/components/claims/claim-status-badge";
import { SourceQualityBadge } from "@/components/claims/source-quality-badge";
import { Avatar } from "@/components/ui/avatar";
import { VoteBreakdown } from "@/components/voting/vote-breakdown";
import { getClaimById } from "@/lib/api/claims";
import type { ClaimStatus } from "@/lib/types/claim";
import { getClaimTypeLabel } from "@/lib/utils/claim-display";
import { formatAbsoluteDate } from "@/lib/utils/dates";
import { getApprovedImageUrl } from "@/lib/utils/images";
import { getSourceDomain } from "@/lib/utils/urls";
import { publicEnvironment } from "@/lib/validation/env";

export const dynamic = "force-dynamic";

interface ClaimPageProps {
  readonly params: Promise<{ id: string }>;
}

function truncateDescription(value: string): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > 155 ? `${normalized.slice(0, 152).trimEnd()}…` : normalized;
}

function isFinalStatus(status: ClaimStatus | null): boolean {
  return status === "FINALIZED_TRUE" || status === "FINALIZED_FAKE" || status === "COMMUNITY_TRUE" || status === "COMMUNITY_FAKE" || status === "INSUFFICIENT_DATA";
}

function formatPublishedScore(value: number): string {
  const normalized = value <= 1 ? value * 100 : value;
  return `${Math.round(Math.min(100, Math.max(0, normalized)))}%`;
}

export async function generateMetadata({ params }: ClaimPageProps): Promise<Metadata> {
  const { id } = await params;
  const claim = await getClaimById(id);

  if (!claim) {
    return {
      title: "Claim unavailable | FactFight",
      description: "This FactFight claim is unavailable.",
    };
  }

  const title = `${claim.title} | FactFight`;
  const description = truncateDescription(claim.description || claim.title);
  const canonical = new URL(`/claim/${claim.id}`, publicEnvironment.siteUrl).toString();
  const imageUrl = getApprovedImageUrl(claim.imageUrl) ?? getApprovedImageUrl(claim.thumbnailUrl);

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      type: "article",
      title,
      description,
      url: canonical,
      ...(imageUrl ? { images: [{ url: imageUrl, alt: `Image for ${claim.title}` }] } : {}),
    },
  };
}

export default async function PublicClaimPage({ params }: ClaimPageProps) {
  const { id } = await params;
  const claim = await getClaimById(id);

  if (!claim) {
    notFound();
  }

  const sourceDomain = claim.sourceDomain ?? getSourceDomain(claim.sourceUrl);

  return (
    <div className="min-h-screen bg-[var(--ff-surface)] text-[var(--ff-text)]">
      <header className="border-b border-[var(--ff-border)] bg-white px-4 py-4 sm:px-7">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
          <Link className="rounded-sm text-xl font-medium text-[var(--ff-navy)]" href="/">
            FactFight
          </Link>
          <Link className="rounded-[var(--ff-radius-card)] border border-[var(--ff-border)] px-3.5 py-2 text-sm font-medium text-[var(--ff-navy)]" href={`/login?next=/claim/${claim.id}`}>
            Log in
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-7 sm:py-10">
        <article className="overflow-hidden rounded-[var(--ff-radius-card)] border border-[var(--ff-border)] bg-white">
          <div className="p-5 sm:p-8">
            <header className="flex items-center gap-3">
              <Avatar avatarUrl={claim.author.avatarUrl} displayName={claim.author.displayName} verified={claim.author.verified} />
              <div className="min-w-0">
                <p className="truncate font-medium text-[var(--ff-text)]">{claim.author.displayName}</p>
                <p className="truncate text-sm text-[var(--ff-text-muted)]">@{claim.author.username} · {formatAbsoluteDate(claim.createdAt)}</p>
              </div>
            </header>

            <div className="mt-6 flex flex-wrap gap-2">
              {claim.category ? <span className="rounded-full border border-[var(--ff-border)] px-2.5 py-1 text-xs text-[var(--ff-text-secondary)]">{claim.category}</span> : null}
              {claim.subCategory ? <span className="rounded-full border border-[var(--ff-border)] px-2.5 py-1 text-xs text-[var(--ff-text-secondary)]">{claim.subCategory}</span> : null}
              <span className="rounded-full border border-[var(--ff-border)] px-2.5 py-1 text-xs text-[var(--ff-text-secondary)]">{getClaimTypeLabel(claim.claimType)}</span>
              <ClaimStatusBadge status={claim.status} />
            </div>

            <h1 className="mt-6 text-3xl leading-[1.18] font-medium tracking-[-0.03em] text-[var(--ff-navy)] sm:text-4xl">{claim.title}</h1>
            {claim.description ? <p className="mt-5 whitespace-pre-line text-lg leading-8 text-[var(--ff-text-secondary)]">{claim.description}</p> : null}

            <div className="mt-7">
              <ClaimMedia claim={claim} priority />
            </div>

            {claim.sourceUrl ? (
              <section aria-labelledby="claim-source-heading" className="mt-7 rounded-[var(--ff-radius-card)] border border-[var(--ff-border)] p-4 sm:p-5">
                <h2 className="text-sm font-medium text-[var(--ff-navy)]" id="claim-source-heading">Claim source</h2>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <a className="inline-flex items-center gap-2 text-sm font-medium text-[var(--ff-navy)] hover:underline" href={claim.sourceUrl} rel="noopener noreferrer" target="_blank">
                    <ExternalLink aria-hidden="true" size={15} strokeWidth={1.8} />
                    {sourceDomain ?? "Open source"}
                  </a>
                  <SourceQualityBadge quality={claim.sourceQuality} score={claim.sourceScore} />
                </div>
              </section>
            ) : null}

            <div className="mt-7">
              <AiRiskSignal confidence={claim.aiConfidence} expanded status={claim.aiStatus} summary={claim.aiSummary} />
            </div>

            <section aria-labelledby="community-data-heading" className="mt-7 rounded-[var(--ff-radius-card)] border border-[var(--ff-border)] p-4 sm:p-5">
              <h2 className="text-base font-medium text-[var(--ff-navy)]" id="community-data-heading">Community response</h2>
              <div className="mt-4"><VoteBreakdown votes={claim.votes} /></div>
              {claim.finalScore !== null && isFinalStatus(claim.status) ? (
                <p className="mt-4 border-t border-[var(--ff-border)] pt-4 text-sm text-[var(--ff-text-secondary)]">
                  Server-published final score: <span className="font-medium text-[var(--ff-text)]">{formatPublishedScore(claim.finalScore)}</span>
                </p>
              ) : null}
            </section>

            {(claim.currentPhase !== null || claim.voteAcceptUntil) ? (
              <section aria-labelledby="claim-timing-heading" className="mt-7 border-t border-[var(--ff-border)] pt-6">
                <h2 className="text-sm font-medium text-[var(--ff-navy)]" id="claim-timing-heading">Verification timing</h2>
                <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
                  {claim.currentPhase !== null ? <div><dt className="text-[var(--ff-text-muted)]">Current phase</dt><dd className="mt-1 text-[var(--ff-text)]">Phase {claim.currentPhase}</dd></div> : null}
                  {claim.voteAcceptUntil ? <div><dt className="text-[var(--ff-text-muted)]">Voting window closes</dt><dd className="mt-1 text-[var(--ff-text)]">{formatAbsoluteDate(claim.voteAcceptUntil)}</dd></div> : null}
                </dl>
              </section>
            ) : null}

            <aside className="mt-8 rounded-[var(--ff-radius-card)] bg-[var(--ff-surface)] p-5">
              <h2 className="font-medium text-[var(--ff-navy)]">Want to participate?</h2>
              <p className="mt-2 text-sm leading-6 text-[var(--ff-text-secondary)]">Log in to prepare for future community voting features. Voting is not enabled on the web yet.</p>
              <Link className="mt-4 inline-flex items-center gap-2 rounded-[var(--ff-radius-card)] bg-[var(--ff-navy)] px-4 py-2.5 text-sm font-medium text-white" href={`/login?next=/claim/${claim.id}`}>
                <LogIn aria-hidden="true" size={16} strokeWidth={1.8} />
                Log in
              </Link>
            </aside>
          </div>
        </article>
      </main>
    </div>
  );
}
