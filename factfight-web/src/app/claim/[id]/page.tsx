import { ExternalLink } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AiRiskSignal } from "@/components/claims/ai-risk-signal";
import { ClaimMedia } from "@/components/claims/claim-media";
import { ClaimStatusBadge } from "@/components/claims/claim-status-badge";
import { ClaimTools } from "@/components/claims/claim-tools";
import { SourceQualityBadge } from "@/components/claims/source-quality-badge";
import { AddEvidenceForm } from "@/components/evidence/add-evidence-form";
import { EvidenceList } from "@/components/evidence/evidence-list";
import { AuthenticatedAppShell } from "@/components/navigation/authenticated-app-shell";
import { PublicSiteFooter } from "@/components/navigation/public-site-footer";
import { PublicSiteHeader } from "@/components/navigation/public-site-header";
import { Avatar } from "@/components/ui/avatar";
import { VoteActionPanel } from "@/components/voting/vote-action-panel";
import { VoteBreakdown } from "@/components/voting/vote-breakdown";
import { getClaimPageData } from "@/lib/api/claims";
import { getPublicProfile } from "@/lib/api/discovery";
import { createClient } from "@/lib/supabase/server";
import { SITE_NAME } from "@/lib/constants/public-site";
import type { ClaimStatus, PublicClaim } from "@/lib/types/claim";
import { getClaimStatusLabel, getClaimTypeLabel } from "@/lib/utils/claim-display";
import { formatAbsoluteDate } from "@/lib/utils/dates";
import { getApprovedImageUrl } from "@/lib/utils/images";
import { getSourceDomain } from "@/lib/utils/urls";
import { getRequestTimestamp } from "@/lib/utils/server-time";
import { publicEnvironment } from "@/lib/validation/env";

export const revalidate = 60;

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

function isVotingOpen(claim: PublicClaim): boolean {
  const closedStatuses = new Set<ClaimStatus>([
    "FINALIZED_TRUE",
    "FINALIZED_FAKE",
    "INSUFFICIENT_DATA",
    "LOCKED",
    "VOTING_CLOSED",
    "COMMUNITY_TRUE",
    "COMMUNITY_FAKE",
    "NEEDS_MORE_EVIDENCE",
  ]);

  if (claim.status && closedStatuses.has(claim.status)) {
    return false;
  }

  if (claim.voteAcceptUntil) {
    const deadline = new Date(claim.voteAcceptUntil).getTime();
    if (!Number.isNaN(deadline) && deadline <= Date.now()) {
      return false;
    }
  }

  return true;
}

function formatPublishedScore(value: number): string {
  const normalized = value <= 1 ? value * 100 : value;
  return `${Math.round(Math.min(100, Math.max(0, normalized)))}%`;
}

function getCanonicalUrl(claim: PublicClaim, slug: string | null): string {
  return new URL(`/claim/${slug ?? claim.id}`, publicEnvironment.siteUrl).toString();
}

function getReviewRating(status: ClaimStatus | null) {
  const isTrue = status === "FINALIZED_TRUE" || status === "COMMUNITY_TRUE";
  const isFake = status === "FINALIZED_FAKE" || status === "COMMUNITY_FAKE";

  return {
    "@type": "Rating",
    ratingValue: isTrue ? 5 : isFake ? 1 : 3,
    bestRating: 5,
    worstRating: 1,
    alternateName: getClaimStatusLabel(status),
  };
}

export async function generateMetadata({ params }: ClaimPageProps): Promise<Metadata> {
  const { id } = await params;
  const data = await getClaimPageData(id);

  if (!data) {
    return {
      title: "Claim unavailable",
      description: "This FactFight claim is unavailable.",
      robots: { index: false, follow: false },
    };
  }

  const { claim, seo } = data;
  const title = seo?.metaTitle ?? claim.title;
  const description = seo?.metaDescription ?? truncateDescription(claim.description || claim.title);
  const openGraphTitle = seo?.openGraphTitle ?? title;
  const openGraphDescription = seo?.openGraphDescription ?? description;
  const canonical = getCanonicalUrl(claim, seo?.slug ?? null);
  const imageUrl = getApprovedImageUrl(claim.imageUrl) ?? getApprovedImageUrl(claim.thumbnailUrl);
  const socialImage = imageUrl ?? new URL("/opengraph-image", publicEnvironment.siteUrl).toString();

  return {
    title,
    description,
    keywords: seo ? [...seo.keywords] : undefined,
    alternates: { canonical },
    openGraph: {
      type: "article",
      siteName: SITE_NAME,
      title: openGraphTitle,
      description: openGraphDescription,
      url: canonical,
      publishedTime: claim.createdAt ?? undefined,
      images: [{ url: socialImage, alt: imageUrl ? `Image for ${claim.title}` : "FactFight community verification" }],
    },
    twitter: {
      card: "summary_large_image",
      title: openGraphTitle,
      description: openGraphDescription,
      images: [socialImage],
    },
  };
}

export default async function PublicClaimPage({ params }: ClaimPageProps) {
  const { id } = await params;
  const data = await getClaimPageData(id);

  if (!data) {
    notFound();
  }

  const { claim, evidence, seo } = data;
  const supabase = await createClient();
  const { data: viewerData } = await supabase.auth.getClaims();
  const viewerId = typeof viewerData?.claims?.sub === "string" ? viewerData.claims.sub : null;
  const viewerProfile = viewerId ? await getPublicProfile(viewerId) : null;
  const createdAt = claim.createdAt ? new Date(claim.createdAt).getTime() : Number.NaN;
  const canDelete =
    viewerId === claim.authorId &&
    !Number.isNaN(createdAt) &&
    getRequestTimestamp() - createdAt <= 3 * 60 * 60 * 1_000 &&
    !isFinalStatus(claim.status);
  const sourceDomain = claim.sourceDomain ?? getSourceDomain(claim.sourceUrl);
  const canonical = getCanonicalUrl(claim, seo?.slug ?? null);
  const claimReview = {
    "@context": "https://schema.org",
    "@type": "ClaimReview",
    url: canonical,
    datePublished: claim.createdAt ?? undefined,
    claimReviewed: claim.title,
    author: {
      "@type": "Organization",
      name: SITE_NAME,
      url: publicEnvironment.siteUrl,
    },
    itemReviewed: {
      "@type": "CreativeWork",
      author: {
        "@type": "Person",
        name: claim.author.displayName,
      },
    },
    reviewRating: getReviewRating(claim.status),
  };
  // The object is built only from validated values. Escaping '<' prevents a
  // user-authored string from terminating the JSON-LD script element.
  const serializedClaimReview = JSON.stringify(claimReview).replace(/</g, "\\u003c");

  const articleContent = (
    <>
      <script dangerouslySetInnerHTML={{ __html: serializedClaimReview }} type="application/ld+json" />
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

            <div className="mt-7"><ClaimMedia claim={claim} priority /></div>

            {claim.sourceUrl ? (
              <section aria-labelledby="claim-source-heading" className="mt-7 rounded-[var(--ff-radius-card)] border border-[var(--ff-border)] p-4 sm:p-5">
                <h2 className="text-sm font-medium text-[var(--ff-navy)]" id="claim-source-heading">Claim source</h2>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <a className="inline-flex items-center gap-2 rounded-sm text-sm font-medium text-[var(--ff-navy)] hover:underline" href={claim.sourceUrl} rel="noopener noreferrer" target="_blank">
                    <ExternalLink aria-hidden="true" size={15} strokeWidth={1.8} />
                    {sourceDomain ?? "Open source"}
                  </a>
                  <SourceQualityBadge quality={claim.sourceQuality} score={claim.sourceScore} />
                </div>
                {claim.sourceSupportSummary ? <p className="mt-3 text-sm leading-6 text-[var(--ff-text-secondary)]">{claim.sourceSupportSummary}</p> : null}
              </section>
            ) : null}

            <div className="mt-7"><AiRiskSignal confidence={claim.aiConfidence} expanded status={claim.aiStatus} summary={claim.aiSummary} /></div>

            <section aria-labelledby="community-data-heading" className="mt-7 rounded-[var(--ff-radius-card)] border border-[var(--ff-border)] p-4 sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-base font-medium text-[var(--ff-navy)]" id="community-data-heading">Community verdict</h2>
                <ClaimStatusBadge status={claim.status} />
              </div>
              <div className="mt-4"><VoteBreakdown votes={claim.votes} /></div>
              {claim.finalScore !== null && isFinalStatus(claim.status) ? (
                <p className="mt-4 border-t border-[var(--ff-border)] pt-4 text-sm text-[var(--ff-text-secondary)]">
                  Server-published final score: <span className="font-medium text-[var(--ff-text)]">{formatPublishedScore(claim.finalScore)}</span>
                </p>
              ) : null}
            </section>

            <section aria-labelledby="evidence-heading" className="mt-8 border-t border-[var(--ff-border)] pt-7">
              <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
                <div>
                  <h2 className="text-xl font-medium text-[var(--ff-navy)]" id="evidence-heading">Evidence</h2>
                  <p className="mt-1 text-sm text-[var(--ff-text-muted)]">{evidence.length} public {evidence.length === 1 ? "source" : "sources"}</p>
                </div>
              </div>
              <EvidenceList evidence={evidence} />
              <AddEvidenceForm claimId={claim.id} pathIdentifier={id} />
            </section>

            {claim.topicClusterId ? (
              <p className="mt-7 text-sm text-[var(--ff-text-secondary)]">
                This claim belongs to a related topic cluster. <Link className="font-medium text-[var(--ff-navy)] hover:underline" href={`/topic/${claim.topicClusterId}`}>View topic</Link>
              </p>
            ) : null}

            <VoteActionPanel claimId={claim.id} pathIdentifier={id} votingOpen={isVotingOpen(claim)} />
            <ClaimTools canDelete={canDelete} claimId={claim.id} pathIdentifier={id} />
          </div>
      </article>
    </>
  );

  if (viewerProfile) {
    return (
      <AuthenticatedAppShell
        profile={{
          displayName: viewerProfile.displayName,
          username: viewerProfile.username,
          avatarUrl: viewerProfile.avatarUrl,
        }}
      >
        <div className="mx-auto w-full max-w-3xl">{articleContent}</div>
      </AuthenticatedAppShell>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--ff-surface)] text-[var(--ff-text)]">
      <PublicSiteHeader />
      <main className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-7 sm:py-10">{articleContent}</main>
      <PublicSiteFooter />
    </div>
  );
}
