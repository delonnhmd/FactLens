import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { markAllNotificationsReadAction, markNotificationReadAction } from "@/app/(main)/notifications/actions";
import { EmptyState } from "@/components/ui/empty-state";
import { getVerifiedSession } from "@/lib/auth/verified-session";
import { createClient } from "@/lib/supabase/server";
import { formatAbsoluteDate } from "@/lib/utils/dates";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Notifications | FactFight" };

export default async function NotificationsPage() {
  const session = await getVerifiedSession();
  if (!session.ok) redirect("/login?next=/notifications");
  const supabase = await createClient();
  const userId = session.userId;
  const { data: notifications, error: readError } = await supabase.from("notifications").select("id,type,title,body,claim_id,read,created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(50);
  if (readError) throw new Error("Notifications are temporarily unavailable.");
  const unread = (notifications ?? []).filter((notification) => !notification.read).length;

  return <div className="mx-auto w-full max-w-[720px]"><header className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm font-medium text-[var(--ff-ai)]">Activity</p><h1 className="mt-1 text-3xl font-medium text-[var(--ff-navy)]">Notifications</h1><p className="mt-2 text-[var(--ff-text-secondary)]">{unread} unread</p></div>{unread ? <form action={markAllNotificationsReadAction}><button className="rounded-[var(--ff-radius-card)] border border-[var(--ff-border)] bg-white px-4 py-2.5 text-sm font-medium text-[var(--ff-navy)]" type="submit">Mark all read</button></form> : null}</header>{notifications?.length ? <ol className="mt-6 space-y-3">{notifications.map((notification) => <li className={`rounded-[var(--ff-radius-card)] border p-4 ${notification.read ? "border-[var(--ff-border)] bg-white" : "border-[color-mix(in_srgb,var(--ff-ai)_35%,var(--ff-border))] bg-[color-mix(in_srgb,var(--ff-ai)_5%,white)]"}`} key={notification.id}><div className="flex items-start justify-between gap-3"><div className="min-w-0"><h2 className="font-medium text-[var(--ff-navy)]">{notification.title}</h2><p className="mt-1 text-sm leading-6 text-[var(--ff-text-secondary)]">{notification.body}</p><p className="mt-2 text-xs text-[var(--ff-text-muted)]">{formatAbsoluteDate(notification.created_at)}</p></div>{!notification.read ? <form action={markNotificationReadAction}><input name="notificationId" type="hidden" value={notification.id} /><button className="text-xs font-medium text-[var(--ff-ai)] hover:underline" type="submit">Mark read</button></form> : null}</div>{notification.claim_id ? <Link className="mt-3 inline-flex text-sm font-medium text-[var(--ff-navy)] hover:underline" href={`/claim/${notification.claim_id}`}>Open claim</Link> : null}</li>)}</ol> : <div className="mt-6"><EmptyState title="No notifications yet" description="Claim, evidence, mention, and reputation activity will appear here." /></div>}</div>;
}
