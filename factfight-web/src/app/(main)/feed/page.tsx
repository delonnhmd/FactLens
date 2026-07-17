import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { ClaimCard } from "@/components/claims/claim-card";
import { EmptyState } from "@/components/ui/empty-state";
import { getFeedClaims } from "@/lib/api/claims";
import { createClient } from "@/lib/supabase/server";
import { parseFeedPage } from "@/lib/utils/pagination";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Feed | FactFight",
  description: "Review community-submitted claims, evidence signals, and public voting data on FactFight.",
};

interface FeedPageProps {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function FeedPage({ searchParams }: FeedPageProps) {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();

  if (error || !data?.claims?.sub) {
    redirect("/login");
  }

  const parameters = await searchParams;
  const requestedPage = parseFeedPage(parameters.page);
  const feed = await getFeedClaims(requestedPage);

  return (
    <div className="mx-auto w-full max-w-[680px]">
      <header className="mb-5 sm:mb-7">
        <p className="text-sm font-medium text-[var(--ff-ai)]">Community verification</p>
        <h1 className="mt-1 text-3xl font-medium tracking-[-0.03em] text-[var(--ff-navy)] sm:text-4xl">Feed</h1>
        <p className="mt-2 leading-7 text-[var(--ff-text-secondary)]">Review recent claims and public community voting data.</p>
      </header>

      {feed.claims.length === 0 ? (
        <EmptyState
          description={feed.hasPreviousPage ? "There are no visible claims on this page. Return to a previous page to continue." : "No visible claims are available right now. Please check back later."}
          title="No claims to review"
        />
      ) : (
        <section aria-label="Recent claims" className="space-y-5">
          {feed.claims.map((claim) => (
            <ClaimCard claim={claim} key={claim.id} />
          ))}
        </section>
      )}

      {(feed.hasPreviousPage || feed.hasNextPage) && (
        <nav aria-label="Feed pagination" className="mt-7 flex items-center justify-between gap-4">
          {feed.hasPreviousPage ? (
            <Link className="rounded-[var(--ff-radius-card)] border border-[var(--ff-border)] bg-white px-4 py-2.5 text-sm font-medium text-[var(--ff-navy)]" href={feed.page === 2 ? "/feed" : `/feed?page=${feed.page - 1}`}>
              Previous
            </Link>
          ) : <span />}
          <span className="text-sm text-[var(--ff-text-muted)]">Page {feed.page}</span>
          {feed.hasNextPage ? (
            <Link className="rounded-[var(--ff-radius-card)] border border-[var(--ff-navy)] bg-[var(--ff-navy)] px-4 py-2.5 text-sm font-medium text-white" href={`/feed?page=${feed.page + 1}`}>
              Next
            </Link>
          ) : <span />}
        </nav>
      )}
    </div>
  );
}
