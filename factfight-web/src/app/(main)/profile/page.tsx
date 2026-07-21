import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Avatar } from "@/components/ui/avatar";
import { getVerifiedSession } from "@/lib/auth/verified-session";
import { getPublicProfile } from "@/lib/api/discovery";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "My profile | FactFight" };

export default async function MyProfilePage() {
  const session = await getVerifiedSession();
  if (!session.ok) redirect("/login?next=/profile");
  const userId = session.userId;

  const profile = await getPublicProfile(userId);

  if (!profile) {
    return <p className="rounded-[var(--ff-radius-card)] border border-[var(--ff-border)] bg-white p-5">Your profile is temporarily unavailable.</p>;
  }

  return (
    <div className="mx-auto w-full max-w-[720px]">
      <header className="rounded-[var(--ff-radius-card)] border border-[var(--ff-border)] bg-white p-5 sm:p-7">
        <div className="flex items-center gap-4">
          <Avatar avatarUrl={profile.avatarUrl} displayName={profile.displayName} />
          <div className="min-w-0"><h1 className="truncate text-2xl font-medium text-[var(--ff-navy)]">{profile.displayName}</h1><p className="truncate text-sm text-[var(--ff-text-muted)]">@{profile.username}</p></div>
        </div>
        {profile.bio ? <p className="mt-5 leading-7 text-[var(--ff-text-secondary)]">{profile.bio}</p> : null}
        <div className="mt-5 flex flex-wrap gap-2 text-sm">
          <span className="rounded-full bg-[var(--ff-surface)] px-3 py-1.5">{profile.rankTitle}</span>
          {profile.profileVisibility === "public" ? <span className="rounded-full bg-[var(--ff-surface)] px-3 py-1.5">{profile.reputationPoints.toLocaleString()} points</span> : null}
        </div>
        <Link className="mt-5 inline-flex rounded-[var(--ff-radius-card)] border border-[var(--ff-navy)] px-4 py-2.5 text-sm font-medium text-[var(--ff-navy)]" href={`/profile/${profile.publicProfileSlug}`}>View public profile</Link>
      </header>

      <section className="mt-5 rounded-[var(--ff-radius-card)] border border-[var(--ff-border)] bg-white p-5" aria-labelledby="account-links">
        <h2 className="text-lg font-medium text-[var(--ff-navy)]" id="account-links">Your FactFight</h2>
        <nav className="mt-3 divide-y divide-[var(--ff-border)]" aria-label="Profile pages">
          <Link className="block py-3 text-sm font-medium text-[var(--ff-navy)]" href="/notifications">Notifications</Link>
          <Link className="block py-3 text-sm font-medium text-[var(--ff-navy)]" href="/profile/claims">My claims</Link>
          <Link className="block py-3 text-sm font-medium text-[var(--ff-navy)]" href="/my-activity/votes">Voting history</Link>
          <Link className="block py-3 text-sm font-medium text-[var(--ff-navy)]" href="/profile/saved">Saved claims</Link>
          <Link className="block py-3 text-sm font-medium text-[var(--ff-navy)]" href="/settings">Account settings</Link>
          <Link className="block py-3 text-sm font-medium text-[var(--ff-navy)]" href="/settings/blocked">Blocked users</Link>
        </nav>
      </section>
    </div>
  );
}
