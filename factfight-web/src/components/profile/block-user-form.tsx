"use client";

import { useActionState } from "react";

import { blockUserAction, type BlockActionState } from "@/app/profile/[username]/actions";

const initialState: BlockActionState = { message: "", success: false };

export function BlockUserForm({ userId }: { readonly userId: string }) {
  const [state, action, pending] = useActionState(blockUserAction, initialState);
  return <details className="mt-5 border-t border-[var(--ff-border)] pt-4"><summary className="cursor-pointer text-sm font-medium text-[var(--ff-fake)]">Block contributor</summary><form action={action} className="mt-3 space-y-3"><input name="userId" type="hidden" value={userId} /><p className="text-sm leading-6 text-[var(--ff-text-secondary)]">Their content will be removed from your feed and the block will be surfaced to moderation.</p><label className="flex items-start gap-2 text-sm"><input className="mt-1" disabled={pending} name="confirmation" type="checkbox" /><span>Block this contributor.</span></label><button className="rounded-[var(--ff-radius-card)] bg-[var(--ff-fake)] px-4 py-2.5 text-sm font-medium text-white disabled:cursor-wait disabled:opacity-65" disabled={pending} type="submit">{pending ? "Blocking…" : "Block contributor"}</button>{state.message ? <p className="text-sm text-[var(--ff-fake)]" role="alert">{state.message}</p> : null}</form></details>;
}
