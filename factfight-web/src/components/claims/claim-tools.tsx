"use client";

import Link from "next/link";
import { useActionState } from "react";

import {
  deleteClaimAction,
  reportClaimAction,
  toggleSavedClaimAction,
  type ParticipationActionState,
  type SavedClaimActionState,
} from "@/app/claim/[id]/actions";

const reportInitialState: ParticipationActionState = { message: "", success: false };
const savedInitialState: SavedClaimActionState = { message: "", success: false };

const reportOptions = [
  ["SPAM", "Spam"],
  ["FAKE_SOURCE", "Misleading or false source"],
  ["DUPLICATE_CLAIM", "Duplicate claim"],
  ["MISLEADING_TITLE", "Misleading title"],
  ["HARASSMENT_OR_ABUSE", "Harassment or abuse"],
  ["HARMFUL_CONTENT", "Harmful content"],
  ["EXPLICIT_CONTENT", "Explicit content"],
  ["OTHER", "Other"],
] as const;

export function ClaimTools({ claimId, pathIdentifier, canDelete = false }: { readonly claimId: string; readonly pathIdentifier: string; readonly canDelete?: boolean }) {
  const [savedState, savedAction, saving] = useActionState(toggleSavedClaimAction, savedInitialState);
  const [reportState, reportAction, reporting] = useActionState(reportClaimAction, reportInitialState);
  const [deleteState, deleteAction, deleting] = useActionState(deleteClaimAction, reportInitialState);

  return (
    <section className="mt-5 rounded-[var(--ff-radius-card)] border border-[var(--ff-border)] p-4 sm:p-5" aria-labelledby="claim-tools-heading">
      <h2 className="text-sm font-medium text-[var(--ff-navy)]" id="claim-tools-heading">Claim tools</h2>
      <div className="mt-3 flex flex-wrap items-start gap-3">
        <form action={savedAction}>
          <input name="claimId" type="hidden" value={claimId} />
          <input name="pathIdentifier" type="hidden" value={pathIdentifier} />
          <button className="rounded-[var(--ff-radius-card)] border border-[var(--ff-border)] bg-white px-4 py-2.5 text-sm font-medium text-[var(--ff-navy)] disabled:cursor-wait disabled:opacity-65" disabled={saving} type="submit">
            {saving ? "Updating…" : savedState.saved ? "Remove from saved" : "Save claim"}
          </button>
        </form>
        <details className="min-w-[220px] flex-1 rounded-[var(--ff-radius-card)] border border-[var(--ff-border)] bg-white p-3">
          <summary className="cursor-pointer text-sm font-medium text-[var(--ff-fake)]">Report claim</summary>
          <form action={reportAction} className="mt-4 space-y-3">
            <input name="claimId" type="hidden" value={claimId} />
            <input name="pathIdentifier" type="hidden" value={pathIdentifier} />
            <label className="block text-sm">Reason<select className="mt-1.5 w-full rounded-[var(--ff-radius-card)] border border-[var(--ff-control-border)] bg-white px-3 py-2.5" disabled={reporting} name="reason" required><option value="">Choose a reason</option>{reportOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label className="block text-sm">Details <span className="text-[var(--ff-text-muted)]">(optional)</span><textarea className="mt-1.5 min-h-20 w-full resize-y rounded-[var(--ff-radius-card)] border border-[var(--ff-control-border)] bg-white px-3 py-2.5" disabled={reporting} maxLength={300} name="note" /></label>
            <button className="rounded-[var(--ff-radius-card)] bg-[var(--ff-fake)] px-4 py-2.5 text-sm font-medium text-white disabled:cursor-wait disabled:opacity-65" disabled={reporting} type="submit">{reporting ? "Submitting…" : "Submit report"}</button>
          </form>
          {reportState.message ? <p aria-live="polite" className={`mt-3 text-sm ${reportState.success ? "text-[var(--ff-true)]" : "text-[var(--ff-fake)]"}`} role={reportState.success ? "status" : "alert"}>{reportState.message}{reportState.loginRequired ? <> <Link className="font-medium underline" href={`/login?next=/claim/${pathIdentifier}`}>Log in</Link></> : null}</p> : null}
        </details>
      </div>
      {savedState.message ? <p aria-live="polite" className={`mt-3 text-sm ${savedState.success ? "text-[var(--ff-true)]" : "text-[var(--ff-fake)]"}`} role={savedState.success ? "status" : "alert"}>{savedState.message}{savedState.loginRequired ? <> <Link className="font-medium underline" href={`/login?next=/claim/${pathIdentifier}`}>Log in</Link></> : null}</p> : null}
      {canDelete ? (
        <details className="mt-4 border-t border-[var(--ff-border)] pt-4">
          <summary className="cursor-pointer text-sm font-medium text-[var(--ff-fake)]">Remove my claim</summary>
          <form action={deleteAction} className="mt-3 space-y-3">
            <input name="claimId" type="hidden" value={claimId} />
            <input name="pathIdentifier" type="hidden" value={pathIdentifier} />
            <p className="text-sm leading-6 text-[var(--ff-text-secondary)]">This is available only during the first 3 hours and before finalization. Removal is permanent.</p>
            <label className="flex items-start gap-2 text-sm"><input className="mt-1" disabled={deleting} name="confirmation" type="checkbox" /><span>I understand this claim will be permanently removed.</span></label>
            <button className="rounded-[var(--ff-radius-card)] bg-[var(--ff-fake)] px-4 py-2.5 text-sm font-medium text-white disabled:cursor-wait disabled:opacity-65" disabled={deleting} type="submit">{deleting ? "Removing…" : "Remove claim"}</button>
            {deleteState.message ? <p className="text-sm text-[var(--ff-fake)]" role="alert">{deleteState.message}</p> : null}
          </form>
        </details>
      ) : null}
    </section>
  );
}
