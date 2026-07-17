"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect } from "react";

import { voteClaimAction, type VoteActionState } from "@/app/claim/[id]/actions";

const initialState: VoteActionState = { message: "", success: false };

const choices = [
  {
    value: "TRUE",
    label: "True",
    className: "border-[var(--ff-true)] text-[var(--ff-true)] hover:bg-[color-mix(in_srgb,var(--ff-true)_8%,white)]",
  },
  {
    value: "FAKE",
    label: "Fake",
    className: "border-[var(--ff-fake)] text-[var(--ff-fake)] hover:bg-[color-mix(in_srgb,var(--ff-fake)_8%,white)]",
  },
  {
    value: "UNSURE",
    label: "Unsure",
    className: "border-[var(--ff-unsure)] text-[color-mix(in_srgb,var(--ff-unsure)_80%,black)] hover:bg-[color-mix(in_srgb,var(--ff-unsure)_10%,white)]",
  },
] as const;

interface VoteActionPanelProps {
  readonly claimId: string;
  readonly pathIdentifier: string;
  readonly votingOpen: boolean;
}

export function VoteActionPanel({ claimId, pathIdentifier, votingOpen }: VoteActionPanelProps) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(voteClaimAction, initialState);

  useEffect(() => {
    if (state.success) {
      router.refresh();
    }
  }, [router, state.success]);

  if (!votingOpen) {
    return (
      <section className="mt-8 rounded-[var(--ff-radius-card)] bg-[var(--ff-surface)] p-5 sm:p-6">
        <h2 className="text-lg font-medium text-[var(--ff-navy)]">Voting is closed</h2>
        <p className="mt-2 text-sm leading-6 text-[var(--ff-text-secondary)]">
          The current community result and any server-published verdict remain available above.
        </p>
      </section>
    );
  }

  return (
    <section className="mt-8 rounded-[var(--ff-radius-card)] border border-[var(--ff-border)] bg-[var(--ff-surface)] p-5 sm:p-6">
      <h2 className="text-lg font-medium text-[var(--ff-navy)]">Cast your vote</h2>
      <p className="mt-2 text-sm leading-6 text-[var(--ff-text-secondary)]">
        Review the claim and evidence first. You can vote once, and your trust weight is calculated only by the server.
      </p>

      <form action={formAction} className="mt-5">
        <input name="claimId" type="hidden" value={claimId} />
        <input name="pathIdentifier" type="hidden" value={pathIdentifier} />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {choices.map((choice) => (
            <button
              className={`rounded-[var(--ff-radius-card)] border bg-white px-4 py-3 text-sm font-medium disabled:cursor-wait disabled:opacity-55 ${choice.className}`}
              disabled={pending || state.success}
              key={choice.value}
              name="voteType"
              type="submit"
              value={choice.value}
            >
              {pending ? "Saving…" : choice.label}
            </button>
          ))}
        </div>
      </form>

      {state.message ? (
        <div
          aria-live="polite"
          className={`mt-4 rounded-[var(--ff-radius-card)] border px-4 py-3 text-sm ${
            state.success
              ? "border-[color-mix(in_srgb,var(--ff-true)_40%,var(--ff-border))] bg-[color-mix(in_srgb,var(--ff-true)_8%,white)]"
              : "border-[color-mix(in_srgb,var(--ff-fake)_35%,var(--ff-border))] bg-[color-mix(in_srgb,var(--ff-fake)_7%,white)]"
          }`}
          role={state.success ? "status" : "alert"}
        >
          {state.message}
          {state.loginRequired ? (
            <>
              {" "}
              <Link className="font-medium text-[var(--ff-navy)] underline" href={`/login?next=/claim/${pathIdentifier}`}>
                Log in
              </Link>
            </>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
