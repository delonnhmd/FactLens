import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ClaimCard } from "@/components/claims/claim-card";
import { PublicSiteFooter } from "@/components/navigation/public-site-footer";
import { PublicSiteHeader } from "@/components/navigation/public-site-header";
import { TopicVerdictBadge } from "@/components/topics/topic-verdict-badge";
import { AppStoreLink } from "@/components/ui/app-store-link";
import { VoteBreakdown } from "@/components/voting/vote-breakdown";
import { getPublicTopicPageData } from "@/lib/api/topics";
import { SITE_NAME } from "@/lib/constants/public-site";
import { publicEnvironment } from "@/lib/validation/env";

export const revalidate = 60;

interface TopicPageProps {
  readonly params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: TopicPageProps): Promise<Metadata> {
  const { slug } = await params;
  const data = await getPublicTopicPageData(slug);

  if (!data) {
    return {
      title: "Topic unavailable",
      description: "This FactFight topic is unavailable.",
      robots: { index: false, follow: false },
    };
  }

  const { topic } = data;
  const title = topic.metaTitle ?? topic.label;
  const description = topic.metaDescription ?? `Review approved public claims and community voting data about ${topic.label}.`;
  const canonical = new URL(`/topic/${topic.slug}`, publicEnvironment.siteUrl).toString();
  const socialImage = new URL("/opengraph-image", publicEnvironment.siteUrl).toString();

  return {
    title,
    description,
    keywords: [...topic.keywords],
    alternates: { canonical },
    openGraph: {
      type: "website",
      siteName: SITE_NAME,
      title: topic.openGraphTitle ?? title,
      description,
      url: canonical,
      images: [{ url: socialImage, alt: "FactFight community verification" }],
    },
    twitter: {
      card: "summary_large_image",
      title: topic.openGraphTitle ?? title,
      description,
      images: [socialImage],
    },
  };
}

export default async function TopicPage({ params }: TopicPageProps) {
  const { slug } = await params;
  const data = await getPublicTopicPageData(slug);

  if (!data) {
    notFound();
  }

  const { topic, claims } = data;

  return (
    <div className="min-h-screen bg-[var(--ff-surface)] text-[var(--ff-text)]">
      <PublicSiteHeader />
      <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-7 sm:py-12">
        <header className="rounded-[var(--ff-radius-card)] border border-[var(--ff-border)] bg-white p-5 sm:p-8">
          <p className="text-sm font-medium text-[var(--ff-ai)]">Topic cluster</p>
          <h1 className="mt-2 max-w-3xl text-3xl font-medium tracking-[-0.03em] text-[var(--ff-navy)] sm:text-4xl">{topic.label}</h1>
          {topic.metaDescription ? <p className="mt-4 max-w-3xl leading-7 text-[var(--ff-text-secondary)]">{topic.metaDescription}</p> : null}

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <TopicVerdictBadge verdict={topic.verdict} />
            <span className="text-sm text-[var(--ff-text-muted)]">{claims.length} approved public {claims.length === 1 ? "claim" : "claims"}</span>
          </div>

          <section aria-labelledby="topic-votes-heading" className="mt-7 max-w-2xl rounded-[var(--ff-radius-card)] border border-[var(--ff-border)] p-4 sm:p-5">
            <h2 className="text-base font-medium text-[var(--ff-navy)]" id="topic-votes-heading">Combined community response</h2>
            <div className="mt-4">
              <VoteBreakdown votes={{ true: topic.totalTrueVotes, fake: topic.totalFakeVotes, unsure: topic.totalUnsureVotes, total: topic.totalVotes }} />
            </div>
            <p className="mt-4 text-xs leading-5 text-[var(--ff-text-muted)]">Cluster totals and verdict are server-published aggregate values. AI does not set the verdict.</p>
          </section>
        </header>

        <section aria-labelledby="topic-claims-heading" className="mt-10">
          <div className="mb-6">
            <h2 className="text-2xl font-medium tracking-[-0.02em] text-[var(--ff-navy)]" id="topic-claims-heading">Claims in this topic</h2>
            <p className="mt-2 text-sm text-[var(--ff-text-muted)]">Only claims visible to anonymous readers are included.</p>
          </div>
          <div className="grid items-start gap-5 lg:grid-cols-2">
            {claims.map((claim) => <ClaimCard claim={claim} key={claim.id} />)}
          </div>
        </section>

        <aside className="mt-10 rounded-[var(--ff-radius-card)] border border-[var(--ff-border)] bg-white p-5 text-center sm:p-7">
          <h2 className="text-xl font-medium text-[var(--ff-navy)]">Join the verification</h2>
          <p className="mx-auto mt-2 max-w-xl leading-7 text-[var(--ff-text-secondary)]">Download Verifact to vote on member claims and contribute evidence.</p>
          <div className="mt-5"><AppStoreLink label="Download the app to vote" /></div>
        </aside>
      </main>
      <PublicSiteFooter />
    </div>
  );
}
