import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Avatar } from "@/components/ui/avatar";
import { getLeaderboard } from "@/lib/api/discovery";
import { getVerifiedSession } from "@/lib/auth/verified-session";
import type { LeaderboardScope } from "@/lib/types/discovery";
import { formatAbsoluteDate } from "@/lib/utils/dates";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Leaderboard | FactFight",
  description: "See server-calculated FactFight community reputation leaders.",
};

export default async function LeaderboardPage({ searchParams }: { readonly searchParams: Promise<{ scope?: string }> }) {
  const session = await getVerifiedSession();
  if (!session.ok) redirect("/login?next=/leaderboard");

  const params = await searchParams;
  const scope: LeaderboardScope = params.scope === "all_time" ? "all_time" : "monthly";
  const leaderboard = await getLeaderboard(scope);

  return (
    <div className="mx-auto w-full max-w-[760px]">
      <header>
        <p className="text-sm font-medium text-[var(--ff-ai)]">Community reputation</p>
        <h1 className="mt-1 text-3xl font-medium tracking-[-0.03em] text-[var(--ff-navy)] sm:text-4xl">Leaderboard</h1>
        <p className="mt-2 leading-7 text-[var(--ff-text-secondary)]">Reputation and trust values shown here are calculated by the server from community participation.</p>
      </header>

      <nav aria-label="Leaderboard period" className="mt-6 inline-flex rounded-[var(--ff-radius-card)] border border-[var(--ff-border)] bg-white p-1">
        <Link aria-current={scope === "monthly" ? "page" : undefined} className={`rounded-[10px] px-4 py-2 text-sm ${scope === "monthly" ? "bg-[var(--ff-navy)] font-medium text-white" : "text-[var(--ff-text-secondary)]"}`} href="/leaderboard">Monthly</Link>
        <Link aria-current={scope === "all_time" ? "page" : undefined} className={`rounded-[10px] px-4 py-2 text-sm ${scope === "all_time" ? "bg-[var(--ff-navy)] font-medium text-white" : "text-[var(--ff-text-secondary)]"}`} href="/leaderboard?scope=all_time">All time</Link>
      </nav>

      {scope === "monthly" && leaderboard.nextMonthlyResetAt ? (
        <p className="mt-3 text-xs text-[var(--ff-text-muted)]">Next monthly reset: {formatAbsoluteDate(leaderboard.nextMonthlyResetAt)}</p>
      ) : null}

      <ol className="mt-6 space-y-3">
        {leaderboard.users.map((user) => (
          <li className="grid grid-cols-[auto_auto_minmax(0,1fr)_auto] items-center gap-3 rounded-[var(--ff-radius-card)] border border-[var(--ff-border)] bg-white p-4" key={user.id}>
            <span className="w-7 text-center text-lg font-medium text-[var(--ff-navy)]">{user.rankPosition}</span>
            <Avatar avatarUrl={user.avatarUrl} displayName={user.displayName} size="small" />
            <span className="min-w-0">
              <Link className="block truncate text-sm font-medium text-[var(--ff-text)] hover:underline" href={`/profile/${user.profileSlug}`}>{user.displayName}</Link>
              <span className="block truncate text-xs text-[var(--ff-text-muted)]">@{user.username} · {user.rankTitle}</span>
            </span>
            <span className="text-right"><span className="block font-medium text-[var(--ff-navy)]">{Math.round(user.points).toLocaleString()}</span><span className="block text-xs text-[var(--ff-text-muted)]">points</span></span>
          </li>
        ))}
      </ol>
    </div>
  );
}
