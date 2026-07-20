import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { BlockUserForm } from "@/components/profile/block-user-form";
import {
  PublicProfileEvidenceList,
  PublicProfilePosts,
  PublicProfileReplies,
} from "@/components/profile/public-profile-activity";
import { PublicSiteFooter } from "@/components/navigation/public-site-footer";
import { PublicSiteHeader } from "@/components/navigation/public-site-header";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty-state";
import {
  getPublicProfileEvidence,
  getPublicProfilePosts,
  getPublicProfileReplies,
} from "@/lib/api/profile-activity";
import { getPublicProfile } from "@/lib/api/discovery";
import { createClient } from "@/lib/supabase/server";
import type {
  PublicProfileEvidence,
  PublicProfilePost,
  PublicProfileReply,
  PublicProfileTab,
} from "@/lib/types/profile-activity";
import { formatAbsoluteDate } from "@/lib/utils/dates";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Contributor profile | FactFight",
  description: "View a FactFight contributor and their public contributions.",
};

const tabs: ReadonlyArray<{ readonly id: PublicProfileTab; readonly label: string }> = [
  { id: "posts", label: "Posts" },
  { id: "replies", label: "Replies" },
  { id: "evidence", label: "Evidence" },
  { id: "about", label: "About" },
];

function normalizeTab(value: string | undefined): PublicProfileTab {
  return tabs.some((tab) => tab.id === value) ? (value as PublicProfileTab) : "posts";
}

export default async function PublicProfilePage({
  params,
  searchParams,
}: {
  readonly params: Promise<{ username: string }>;
  readonly searchParams: Promise<{ tab?: string }>;
}) {
  const [{ username }, query] = await Promise.all([params, searchParams]);
  const activeTab = normalizeTab(query.tab);
  const supabase = await createClient();
  const { data: viewerData, error: claimsError } = await supabase.auth.getClaims();
  const viewerId = typeof viewerData?.claims?.sub === "string" ? viewerData.claims.sub : null;
  let accessToken: string | null = null;

  if (!claimsError && viewerId) {
    const { data: sessionData } = await supabase.auth.getSession();
    accessToken = sessionData.session?.access_token ?? null;
  }

  const profile = await getPublicProfile(username, accessToken);
  if (!profile || profile.isDeleted) notFound();

  let posts: readonly PublicProfilePost[] = [];
  let replies: readonly PublicProfileReply[] = [];
  let evidence: readonly PublicProfileEvidence[] = [];
  let activityUnavailable = false;

  try {
    if (activeTab === "posts") {
      posts = await getPublicProfilePosts(username, accessToken);
    } else if (activeTab === "replies") {
      replies = await getPublicProfileReplies(username, accessToken);
    } else if (activeTab === "evidence") {
      evidence = await getPublicProfileEvidence(username, accessToken);
    }
  } catch {
    activityUnavailable = true;
  }

  let tabContent = activityUnavailable
    ? <EmptyState title="Activity unavailable" description="This public activity could not be loaded right now. Please try again." />
    : activeTab === "posts"
      ? posts.length
        ? <PublicProfilePosts posts={posts} />
        : <EmptyState title="No public posts" description="This contributor has not published a visible claim yet." />
      : activeTab === "replies"
        ? replies.length
          ? <PublicProfileReplies replies={replies} />
          : <EmptyState title="No public replies" description="This contributor has not written a visible reply yet." />
        : activeTab === "evidence"
          ? evidence.length
            ? <PublicProfileEvidenceList evidence={evidence} />
            : <EmptyState title="No public evidence" description="This contributor has not submitted visible approved evidence yet." />
          : null;

  if (activeTab === "about") {
    tabContent = (
      <section className="rounded-[var(--ff-radius-card)] border border-[var(--ff-border)] bg-white p-5 sm:p-7" aria-labelledby="about-heading">
        <h2 className="text-xl font-medium text-[var(--ff-navy)]" id="about-heading">About</h2>
        {profile.profileVisibility === "private" ? <p className="mt-4 text-[var(--ff-text-secondary)]">This contributor keeps profile details private.</p> : (
          <>
            {profile.bio ? <p className="mt-4 leading-7 text-[var(--ff-text-secondary)]">{profile.bio}</p> : <p className="mt-4 text-[var(--ff-text-muted)]">No biography provided.</p>}
            <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div className="rounded-[var(--ff-radius-card)] bg-[var(--ff-surface)] p-3"><dt className="text-xs text-[var(--ff-text-muted)]">Rank</dt><dd className="mt-1 text-sm font-medium">{profile.rankTitle}</dd></div>
              <div className="rounded-[var(--ff-radius-card)] bg-[var(--ff-surface)] p-3"><dt className="text-xs text-[var(--ff-text-muted)]">Reputation</dt><dd className="mt-1 text-sm font-medium">{profile.reputationPoints.toLocaleString()}</dd></div>
              <div className="rounded-[var(--ff-radius-card)] bg-[var(--ff-surface)] p-3"><dt className="text-xs text-[var(--ff-text-muted)]">Posts</dt><dd className="mt-1 text-sm font-medium">{profile.claimsCount.toLocaleString()}</dd></div>
              <div className="rounded-[var(--ff-radius-card)] bg-[var(--ff-surface)] p-3"><dt className="text-xs text-[var(--ff-text-muted)]">Replies</dt><dd className="mt-1 text-sm font-medium">{profile.repliesCount.toLocaleString()}</dd></div>
              <div className="rounded-[var(--ff-radius-card)] bg-[var(--ff-surface)] p-3"><dt className="text-xs text-[var(--ff-text-muted)]">Evidence</dt><dd className="mt-1 text-sm font-medium">{profile.evidenceCount.toLocaleString()}</dd></div>
              <div className="rounded-[var(--ff-radius-card)] bg-[var(--ff-surface)] p-3"><dt className="text-xs text-[var(--ff-text-muted)]">Voting accuracy</dt><dd className="mt-1 text-sm font-medium">{profile.accuracyPercentage === null ? "Not available" : `${profile.accuracyPercentage}%`}</dd></div>
            </dl>
            <p className="mt-4 text-xs text-[var(--ff-text-muted)]">{profile.totalVotes.toLocaleString()} total votes · {profile.finalizedVotes.toLocaleString()} finalized</p>
            {profile.badges.length ? <div className="mt-5"><h3 className="text-sm font-medium text-[var(--ff-navy)]">Badges</h3><div className="mt-2 flex flex-wrap gap-2">{profile.badges.map((badge) => <span className="rounded-full border border-[var(--ff-border)] px-3 py-1 text-xs" key={badge}>{badge}</span>)}</div></div> : null}
            {profile.createdAt ? <p className="mt-5 text-xs text-[var(--ff-text-muted)]">Joined {formatAbsoluteDate(profile.createdAt)}</p> : null}
          </>
        )}
      </section>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--ff-surface)]">
      <PublicSiteHeader />
      <main className="mx-auto w-full max-w-3xl px-4 py-7 sm:px-7 sm:py-10">
        <header className="rounded-[var(--ff-radius-card)] border border-[var(--ff-border)] bg-white p-6 sm:p-8">
          <div className="flex items-center gap-4"><Avatar avatarUrl={profile.avatarUrl} displayName={profile.displayName} /><div className="min-w-0"><h1 className="truncate text-3xl font-medium text-[var(--ff-navy)]">{profile.displayName}</h1><p className="truncate text-[var(--ff-text-muted)]">@{profile.username}</p></div></div>
          {viewerId && viewerId !== profile.id ? <BlockUserForm userId={profile.id} /> : null}
        </header>

        <nav aria-label="Profile activity" className="mt-5 grid grid-cols-4 overflow-hidden rounded-[var(--ff-radius-card)] border border-[var(--ff-border)] bg-white p-1">
          {tabs.map((tab) => <Link aria-current={activeTab === tab.id ? "page" : undefined} className={`rounded-[9px] px-2 py-2.5 text-center text-sm ${activeTab === tab.id ? "bg-[var(--ff-navy)] font-medium text-white" : "text-[var(--ff-text-secondary)] hover:bg-[var(--ff-surface)]"}`} href={`/profile/${encodeURIComponent(profile.publicProfileSlug)}?tab=${tab.id}`} key={tab.id}>{tab.label}</Link>)}
        </nav>

        <div className="mt-5">{tabContent}</div>
      </main>
      <PublicSiteFooter />
    </div>
  );
}
