"use client";

import { useActionState } from "react";

import { unblockUserAction, type UnblockActionState } from "@/app/(main)/settings/blocked/actions";

const initialState: UnblockActionState = { message: "", success: false };

export function UnblockUserButton({ userId }: { readonly userId: string }) {
  const [state, action, pending] = useActionState(unblockUserAction, initialState);
  return <div><form action={action}><input name="userId" type="hidden" value={userId} /><button className="rounded-[var(--ff-radius-card)] border border-[var(--ff-border)] px-4 py-2 text-sm font-medium text-[var(--ff-navy)] disabled:cursor-wait disabled:opacity-65" disabled={pending || state.success} type="submit">{pending ? "Unblocking…" : state.success ? "Unblocked" : "Unblock"}</button></form>{state.message && !state.success ? <p className="mt-1 text-xs text-[var(--ff-fake)]" role="alert">{state.message}</p> : null}</div>;
}
