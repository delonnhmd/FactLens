"use client";

import { useActionState } from "react";

import { toggleSavedClaimAction, type SavedClaimActionState } from "@/app/claim/[id]/actions";

const initialState: SavedClaimActionState = { message: "", success: false, saved: true };

export function SavedClaimButton({ claimId }: { readonly claimId: string }) {
  const [state, action, pending] = useActionState(toggleSavedClaimAction, initialState);

  return (
    <div>
      <form action={action}>
        <input name="claimId" type="hidden" value={claimId} />
        <input name="pathIdentifier" type="hidden" value={claimId} />
        <button className="rounded-[var(--ff-radius-card)] border border-[var(--ff-border)] bg-white px-3 py-2 text-xs font-medium text-[var(--ff-navy)] disabled:cursor-wait disabled:opacity-65" disabled={pending || state.saved === false} type="submit">{pending ? "Removing…" : state.saved === false ? "Removed" : "Remove"}</button>
      </form>
      {state.message && !state.success ? <p className="mt-1 text-xs text-[var(--ff-fake)]" role="alert">{state.message}</p> : null}
    </div>
  );
}
