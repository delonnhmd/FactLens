import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { ClaimCard } from "@/components/claims/claim-card";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty-state";
import { searchPublicClaims } from "@/lib/api/claims";
import { searchProfiles, searchTopics } from "@/lib/api/discovery";
import { getViewerVotesByClaimId } from "@/lib/api/viewer-votes";
import { getVerifiedSession } from "@/lib/auth/verified-session";
import { claimCategories } from "@/lib/validation/claim-actions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Search | FactFight",
  description: "Search FactFight claims, topics, and contributors.",
};

const statusFilters = [
  { value: "", label: "Any status" },
  { value: "OPEN_VOTING", label: "Open voting" },
  { value: "FINALIZED_TRUE", label: "Finalized true" },
  { value: "FINALIZED_FAKE", label: "Finalized fake" },
  { value: "NEEDS_MORE_EVIDENCE", label: "Needs more evidence" },
] as const;

function firstParam(value: string | string[] | undefined): string {
  return typeof value === "string" ? value : "";
}

export default async function SearchPage({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getVerifiedSession();
  if (!session.ok) redirect("/login?next=/search");

  const params = await searchParams;
  const query = firstParam(params.q).trim().slice(0, 100);
  const requestedCategory = firstParam(params.category);
  const category = claimCategories.includes(requestedCategory as (typeof claimCategories)[number])
    ? requestedCategory
    : "";
  const requestedStatus = firstParam(params.status);
  const status = statusFilters.some((option) => option.value === requestedStatus)
    ? requestedStatus
    : "";

  const [claims, profiles, topics] = await Promise.all([
    searchPublicClaims(query, {
      category: category || undefined,
      status:
        status === "OPEN_VOTING" ||
        status === "FINALIZED_TRUE" ||
        status === "FINALIZED_FAKE" ||
        status === "NEEDS_MORE_EVIDENCE"
          ? status
          : undefined,
    }),
    searchProfiles(query),
    searchTopics(query),
  ]);
  const viewerVotes = await getViewerVotesByClaimId(session.userId, claims.map((claim) => claim.id));
  const hasFilters = Boolean(query || category || status);

  return (
    <div className="mx-auto w-full max-w-[760px]">
      <header>
        <p className="text-sm font-medium text-[var(--ff-ai)]">Discover</p>
        <h1 className="mt-1 text-3xl font-medium tracking-[-0.03em] text-[var(--ff-navy)] sm:text-4xl">Search</h1>
        <p className="mt-2 leading-7 text-[var(--ff-text-secondary)]">
          Find public claims, related topics, and community contributors.
        </p>
      </header>

      <form className="mt-6 rounded-[var(--ff-radius-card)] border border-[var(--ff-border)] bg-white p-4 sm:p-5" method="get" role="search">
        <label className="block text-sm font-medium" htmlFor="search-query">Search FactFight</label>
        <div className="mt-2 flex flex-col gap-3 sm:flex-row">
          <input
            className="min-w-0 flex-1 rounded-[var(--ff-radius-card)] border border-[var(--ff-control-border)] px-3.5 py-3"
            defaultValue={query}
            id="search-query"
            maxLength={100}
            name="q"
            placeholder="Claim, source, topic, or @username"
            type="search"
          />
          <button className="rounded-[var(--ff-radius-card)] bg-[var(--ff-navy)] px-6 py-3 text-sm font-medium text-white" type="submit">Search</button>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="text-sm text-[var(--ff-text-secondary)]">
            Category
            <select className="mt-1.5 w-full rounded-[var(--ff-radius-card)] border border-[var(--ff-control-border)] bg-white px-3 py-2.5 text-[var(--ff-text)]" defaultValue={category} name="category">
              <option value="">All categories</option>
              {claimCategories.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
          <label className="text-sm text-[var(--ff-text-secondary)]">
            Status
            <select className="mt-1.5 w-full rounded-[var(--ff-radius-card)] border border-[var(--ff-control-border)] bg-white px-3 py-2.5 text-[var(--ff-text)]" defaultValue={status} name="status">
              {statusFilters.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
        </div>
      </form>

      {query && profiles.length > 0 ? (
        <section className="mt-7" aria-labelledby="people-results">
          <h2 className="text-xl font-medium text-[var(--ff-navy)]" id="people-results">Contributors</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {profiles.map((profile) => (
              <Link className="flex items-center gap-3 rounded-[var(--ff-radius-card)] border border-[var(--ff-border)] bg-white p-4 hover:border-[var(--ff-control-border)]" href={`/profile/${profile.username}`} key={profile.id}>
                <Avatar avatarUrl={profile.avatarUrl} displayName={profile.displayName} size="small" verified={profile.verified} />
                <span className="min-w-0"><span className="block truncate text-sm font-medium">{profile.displayName}</span><span className="block truncate text-xs text-[var(--ff-text-muted)]">@{profile.username}</span></span>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {query && topics.length > 0 ? (
        <section className="mt-7" aria-labelledby="topic-results">
          <h2 className="text-xl font-medium text-[var(--ff-navy)]" id="topic-results">Topics</h2>
          <div className="mt-3 space-y-3">
            {topics.map((topic) => (
              <Link className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--ff-radius-card)] border border-[var(--ff-border)] bg-white p-4 hover:border-[var(--ff-control-border)]" href={`/topic/${topic.slug}`} key={topic.id}>
                <span className="font-medium text-[var(--ff-navy)]">{topic.label}</span>
                <span className="text-xs text-[var(--ff-text-muted)]">{topic.claimCount} claims · {topic.totalVotes} votes</span>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <section className="mt-7" aria-labelledby="claim-results">
        <div className="mb-4 flex items-end justify-between gap-3">
          <h2 className="text-xl font-medium text-[var(--ff-navy)]" id="claim-results">{hasFilters ? "Claim results" : "Recent claims"}</h2>
          <span className="text-sm text-[var(--ff-text-muted)]">{claims.length} found</span>
        </div>
        {claims.length ? (
          <div className="space-y-5">{claims.map((claim) => <ClaimCard claim={claim} key={claim.id} viewerVote={viewerVotes[claim.id] ?? null} />)}</div>
        ) : (
          <EmptyState title="No claims found" description="Try a broader phrase or remove a filter." />
        )}
      </section>
    </div>
  );
}
