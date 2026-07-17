"use client";

import { useActionState } from "react";

import { resolveReportAction, type ModerationActionState } from "@/app/(main)/moderation/actions";

const initialState: ModerationActionState = { message: "", success: false };

export function ReportActions({ reportId }: { readonly reportId: string }) {
  const [state, action, pending] = useActionState(resolveReportAction, initialState);
  return <form action={action} className="mt-4 space-y-3"><input name="reportId" type="hidden" value={reportId} /><label className="block text-sm">Decision<select className="mt-1.5 w-full rounded-[var(--ff-radius-card)] border border-[var(--ff-control-border)] bg-white px-3 py-2.5" disabled={pending} name="status"><option value="REVIEWING">Mark reviewing</option><option value="RESOLVED">Resolve</option><option value="DISMISSED">Dismiss</option></select></label><label className="block text-sm">Admin note<textarea className="mt-1.5 min-h-20 w-full rounded-[var(--ff-radius-card)] border border-[var(--ff-control-border)] bg-white px-3 py-2.5" disabled={pending} maxLength={500} name="adminNote" /></label><label className="flex items-start gap-2 text-sm"><input className="mt-1" disabled={pending} name="hideTarget" type="checkbox" /><span>Hide the reported target when resolving</span></label><button className="rounded-[var(--ff-radius-card)] bg-[var(--ff-navy)] px-4 py-2.5 text-sm font-medium text-white disabled:cursor-wait disabled:opacity-65" disabled={pending} type="submit">{pending ? "Updating…" : "Update report"}</button>{state.message ? <p aria-live="polite" className={`text-sm ${state.success ? "text-[var(--ff-true)]" : "text-[var(--ff-fake)]"}`} role={state.success ? "status" : "alert"}>{state.message}</p> : null}</form>;
}
