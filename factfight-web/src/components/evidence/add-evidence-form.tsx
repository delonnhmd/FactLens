"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef } from "react";

import {
  addEvidenceAction,
  type ParticipationActionState,
} from "@/app/claim/[id]/actions";

const initialState: ParticipationActionState = { message: "", success: false };

export function AddEvidenceForm({ claimId, pathIdentifier }: { readonly claimId: string; readonly pathIdentifier: string }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState(addEvidenceAction, initialState);

  useEffect(() => {
    if (state.success) {
      formRef.current?.reset();
      router.refresh();
    }
  }, [router, state.success]);

  return (
    <details className="mt-5 rounded-[var(--ff-radius-card)] border border-[var(--ff-border)] bg-[var(--ff-surface)] p-4">
      <summary className="cursor-pointer text-sm font-medium text-[var(--ff-navy)]">Add evidence</summary>
      <form action={formAction} className="mt-4 space-y-4" noValidate ref={formRef}>
        <input name="claimId" type="hidden" value={claimId} />
        <input name="pathIdentifier" type="hidden" value={pathIdentifier} />
        <label className="block text-sm font-medium">
          Evidence position
          <select className="mt-2 w-full rounded-[var(--ff-radius-card)] border border-[var(--ff-control-border)] bg-white px-3.5 py-3" defaultValue="ADDS_CONTEXT" disabled={pending} name="evidenceType">
            <option value="SUPPORTS_TRUE">Supports true</option>
            <option value="SUPPORTS_FAKE">Supports fake</option>
            <option value="ADDS_CONTEXT">Adds context</option>
            <option value="UNCLEAR">Unclear</option>
          </select>
        </label>
        <label className="block text-sm font-medium">
          Evidence URL
          <input autoCapitalize="none" autoCorrect="off" className="mt-2 w-full rounded-[var(--ff-radius-card)] border border-[var(--ff-control-border)] bg-white px-3.5 py-3" disabled={pending} inputMode="url" name="url" placeholder="https://example.com/source" required type="url" />
        </label>
        <label className="block text-sm font-medium">
          Why this source matters
          <textarea className="mt-2 min-h-24 w-full resize-y rounded-[var(--ff-radius-card)] border border-[var(--ff-control-border)] bg-white px-3.5 py-3" disabled={pending} maxLength={500} minLength={10} name="note" placeholder="Explain how the source supports, challenges, or adds context to the claim" required />
        </label>
        <label className="block text-sm font-medium">
          Image or screenshot <span className="font-normal text-[var(--ff-text-muted)]">(optional)</span>
          <input accept="image/jpeg,image/png,image/webp" className="mt-2 w-full rounded-[var(--ff-radius-card)] border border-[var(--ff-control-border)] bg-white px-3.5 py-3 file:mr-3 file:rounded-[8px] file:border-0 file:bg-[var(--ff-surface)] file:px-3 file:py-2 file:text-sm file:font-medium" disabled={pending} name="evidenceImage" type="file" />
          <span className="mt-2 block text-xs font-normal text-[var(--ff-text-muted)]">JPG, PNG, or WebP up to 5 MB.</span>
        </label>
        <button className="rounded-[var(--ff-radius-card)] bg-[var(--ff-navy)] px-5 py-2.5 text-sm font-medium text-white disabled:cursor-wait disabled:opacity-65" disabled={pending} type="submit">{pending ? "Adding evidence…" : "Add evidence"}</button>
      </form>
      {state.message ? (
        <p aria-live="polite" className={`mt-3 text-sm ${state.success ? "text-[var(--ff-true)]" : "text-[var(--ff-fake)]"}`} role={state.success ? "status" : "alert"}>
          {state.message}{state.loginRequired ? <> <Link className="font-medium underline" href={`/login?next=/claim/${pathIdentifier}`}>Log in</Link></> : null}
        </p>
      ) : null}
    </details>
  );
}
