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

const voteLabels: Record<string, string> = {
  TRUE: "True",
  FAKE: "Fake",
  UNSURE: "Not sure",
};

interface VoteActionPanelProps {
  readonly claimId: string;
  readonly pathIdentifier: string;
  readonly votingOpen: boolean;
  // The signed-in viewer's existing vote. The backend rejects repeat votes
  // (409, no overwrite), so when this is set the buttons are replaced with a
  // clear "You voted X" indicator — there is no vote-changing path.
  readonly viewerVote?: string | null;
  // Compact styling for the feed card (the detail page keeps full size).
  readonly compact?: boolean;
}

export function VoteActionPanel({ claimId, pathIdentifier, votingOpen, viewerVote = null, compact = false }: VoteActionPanelProps) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(voteClaimAction, initialState);

  useEffect(() => {
    if (state.success) {
      router.refresh();
    }
  }, [router, state.success]);

  const sectionSpacing = compact ? "mt-5" : "mt-8";
  const sectionPadding = compact ? "p-4" : "p-5 sm:p-6";
  const headingClass = compact ? "text-sm font-medium text-[var(--ff-navy)]" : "text-lg font-medium text-[var(--ff-navy)]";

  if (viewerVote && voteLabels[viewerVote]) {
    return (
      <section aria-label="Your vote" className={`${sectionSpacing} rounded-[var(--ff-radius-card)] border border-[color-mix(in_srgb,var(--ff-true)_35%,var(--ff-border))] bg-[color-mix(in_srgb,var(--ff-true)_6%,white)] ${sectionPadding}`}>
        <p className="text-sm font-medium text-[var(--ff-navy)]">✓ You voted {voteLabels[viewerVote]}</p>
        <p className="mt-1 text-xs leading-5 text-[var(--ff-text-secondary)]">
          Votes are final and can&apos;t be changed.
        </p>
      </section>
    );
  }

  if (!votingOpen) {
    return (
      <section className={`${sectionSpacing} rounded-[var(--ff-radius-card)] bg-[var(--ff-surface)] ${sectionPadding}`}>
        <h2 className={headingClass}>Voting is closed</h2>
        <p className="mt-2 text-sm leading-6 text-[var(--ff-text-secondary)]">
          The current community result and any server-published verdict remain available above.
        </p>
      </section>
    );
  }

  return (
    <section className={`${sectionSpacing} rounded-[var(--ff-radius-card)] border border-[var(--ff-border)] bg-[var(--ff-surface)] ${sectionPadding}`}>
      <h2 className={headingClass}>Cast your vote</h2>
      {compact ? null : (
        <p className="mt-2 text-sm leading-6 text-[var(--ff-text-secondary)]">
          Review the claim and evidence first. You can vote once, and your trust weight is calculated only by the server.
        </p>
      )}

      <form action={formAction} className={compact ? "mt-3" : "mt-5"}>
        <input name="claimId" type="hidden" value={claimId} />
        <input name="pathIdentifier" type="hidden" value={pathIdentifier} />
        <div className={compact ? "grid grid-cols-3 gap-2" : "grid grid-cols-1 gap-3 sm:grid-cols-3"}>
          {choices.map((choice) => (
            <button
              className={`rounded-[var(--ff-radius-card)] border bg-white px-4 ${compact ? "py-2.5" : "py-3"} text-sm font-medium disabled:cursor-wait disabled:opacity-55 ${choice.className}`}
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
