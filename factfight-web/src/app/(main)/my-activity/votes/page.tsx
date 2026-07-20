import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { VoteHistoryCard } from "@/components/profile/vote-history-card";
import { EmptyState } from "@/components/ui/empty-state";
import { getVoteHistory } from "@/lib/api/vote-history";
import { getVerifiedSession } from "@/lib/auth/verified-session";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Voting history | FactFight" };

export default async function VotingHistoryPage() {
  const session = await getVerifiedSession();
  if (!session.ok) redirect("/login?next=/my-activity/votes");

  const votes = await getVoteHistory(session.accessToken);

  return (
    <div className="mx-auto w-full max-w-[680px]">
      <header className="mb-6">
        <p className="text-sm font-medium text-[var(--ff-ai)]">My activity</p>
        <h1 className="mt-1 text-3xl font-medium text-[var(--ff-navy)]">Voting history</h1>
        <p className="mt-2 text-[var(--ff-text-secondary)]">
          This private history is visible only to you.
        </p>
      </header>

      {votes.length ? (
        <ol aria-label="Your private voting history" className="space-y-4">
          {votes.map((vote) => (
            <li key={vote.claimId}>
              <VoteHistoryCard item={vote} />
            </li>
          ))}
        </ol>
      ) : (
        <EmptyState
          title="No votes yet"
          description="Vote on a claim to see your private voting history here."
        />
      )}
    </div>
  );
}
