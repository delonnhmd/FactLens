import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { UnblockUserButton } from "@/components/profile/unblock-user-button";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty-state";
import { getBlockedUserIds } from "@/lib/api/blocks";
import { getPublicProfile } from "@/lib/api/discovery";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Blocked users | FactFight" };

export default async function BlockedUsersPage() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims?.sub) redirect("/login?next=/settings/blocked");
  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session?.access_token) redirect("/login?next=/settings/blocked");
  const blockedIds = (await getBlockedUserIds(sessionData.session.access_token)).slice(0, 100);
  const profileResults = await Promise.all(blockedIds.map((id) => getPublicProfile(id).catch(() => null)));
  const profiles = profileResults.filter((profile) => profile !== null);

  return <div className="mx-auto w-full max-w-[720px]"><header><p className="text-sm font-medium text-[var(--ff-ai)]">Safety controls</p><h1 className="mt-1 text-3xl font-medium text-[var(--ff-navy)]">Blocked users</h1><p className="mt-2 text-[var(--ff-text-secondary)]">Blocked contributors are removed from your feed. You can restore them here.</p></header>{profiles.length ? <ul className="mt-6 space-y-3">{profiles.map((profile) => <li className="flex items-center gap-3 rounded-[var(--ff-radius-card)] border border-[var(--ff-border)] bg-white p-4" key={profile.id}><Avatar avatarUrl={profile.avatarUrl} displayName={profile.displayName} size="small" /><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{profile.displayName}</p><p className="truncate text-xs text-[var(--ff-text-muted)]">@{profile.username}</p></div><UnblockUserButton userId={profile.id} /></li>)}</ul> : <div className="mt-6"><EmptyState title="No blocked users" description="Contributors you block will appear here." /></div>}</div>;
}
