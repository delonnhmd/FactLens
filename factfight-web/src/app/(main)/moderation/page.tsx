import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { ReportActions } from "@/components/moderation/report-actions";
import { EmptyState } from "@/components/ui/empty-state";
import { getModerationDashboard } from "@/lib/api/moderation";
import { getVerifiedSession } from "@/lib/auth/verified-session";
import { formatAbsoluteDate } from "@/lib/utils/dates";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Moderation | FactFight", robots: { index: false, follow: false } };

function targetTitle(target: Readonly<Record<string, unknown>> | null, fallback: string) {
  if (!target) return fallback;
  for (const key of ["title", "display_name", "username", "note", "url"]) {
    const value = target[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return fallback;
}

export default async function ModerationPage() {
  const session = await getVerifiedSession();
  if (!session.ok) redirect("/login?next=/moderation");
  const dashboard = await getModerationDashboard(session.accessToken);
  if (!dashboard) redirect("/feed");

  return <div className="mx-auto w-full max-w-[820px]"><header><p className="text-sm font-medium text-[var(--ff-ai)]">{dashboard.identity.role}</p><h1 className="mt-1 text-3xl font-medium text-[var(--ff-navy)]">Moderation</h1><p className="mt-2 text-[var(--ff-text-secondary)]">Signed in as {dashboard.identity.email}. Every action is re-authorized by the Render backend.</p></header>{dashboard.metrics ? <section className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4" aria-label="Moderation metrics"><div className="rounded-[var(--ff-radius-card)] border border-[var(--ff-border)] bg-white p-4"><p className="text-xs text-[var(--ff-text-muted)]">Users</p><p className="mt-1 text-2xl font-medium text-[var(--ff-navy)]">{dashboard.metrics.totals.users.toLocaleString()}</p></div><div className="rounded-[var(--ff-radius-card)] border border-[var(--ff-border)] bg-white p-4"><p className="text-xs text-[var(--ff-text-muted)]">Claims</p><p className="mt-1 text-2xl font-medium text-[var(--ff-navy)]">{dashboard.metrics.totals.claims.toLocaleString()}</p></div><div className="rounded-[var(--ff-radius-card)] border border-[var(--ff-border)] bg-white p-4"><p className="text-xs text-[var(--ff-text-muted)]">Votes</p><p className="mt-1 text-2xl font-medium text-[var(--ff-navy)]">{dashboard.metrics.totals.votes.toLocaleString()}</p></div><div className="rounded-[var(--ff-radius-card)] border border-[var(--ff-border)] bg-white p-4"><p className="text-xs text-[var(--ff-text-muted)]">Open reports</p><p className="mt-1 text-2xl font-medium text-[var(--ff-navy)]">{dashboard.metrics.totals.pendingReports.toLocaleString()}</p></div></section> : <p className="mt-6 rounded-[var(--ff-radius-card)] border border-[var(--ff-border)] bg-white p-4 text-sm">{dashboard.metricsWarning}</p>}<section className="mt-7" aria-labelledby="open-reports"><div className="mb-4 flex items-end justify-between"><h2 className="text-xl font-medium text-[var(--ff-navy)]" id="open-reports">Open reports</h2><span className="text-sm text-[var(--ff-text-muted)]">{dashboard.reports.length}</span></div>{dashboard.reports.length ? <div className="space-y-4">{dashboard.reports.map((report) => <article className="rounded-[var(--ff-radius-card)] border border-[var(--ff-border)] bg-white p-5" key={report.id}><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-medium text-[var(--ff-ai)]">{report.targetType} · {report.reason}</p><h3 className="mt-1 font-medium text-[var(--ff-navy)]">{targetTitle(report.target, "Reported content")}</h3>{report.note ? <p className="mt-2 text-sm leading-6 text-[var(--ff-text-secondary)]">{report.note}</p> : null}<p className="mt-2 text-xs text-[var(--ff-text-muted)]">Reported {formatAbsoluteDate(report.createdAt)}</p></div>{report.claimId ? <Link className="text-sm font-medium text-[var(--ff-navy)] hover:underline" href={`/claim/${report.claimId}`}>Open claim</Link> : null}</div><ReportActions reportId={report.id} /></article>)}</div> : <EmptyState title="No open reports" description="The moderation queue is clear." />}</section></div>;
}
