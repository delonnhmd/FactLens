"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState, useSyncExternalStore } from "react";

import { voteClaimAction, type VoteActionState } from "@/app/claim/[id]/actions";
import type { ClaimStatus } from "@/lib/types/claim";

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

// 24H MODEL: verdicts publish at the 24-hour mark via the server sweep, so
// the panel renders the verdict itself once it exists.
const trueBox = "border-[color-mix(in_srgb,var(--ff-true)_40%,var(--ff-border))] bg-[color-mix(in_srgb,var(--ff-true)_7%,white)]";
const fakeBox = "border-[color-mix(in_srgb,var(--ff-fake)_40%,var(--ff-border))] bg-[color-mix(in_srgb,var(--ff-fake)_6%,white)]";
const unsureBox = "border-[color-mix(in_srgb,var(--ff-unsure)_45%,var(--ff-border))] bg-[color-mix(in_srgb,var(--ff-unsure)_10%,white)]";

const finalVerdictDisplay: Partial<Record<ClaimStatus, { label: string; boxClassName: string; textClassName: string }>> = {
  FINALIZED_TRUE: { label: "Finalized: True", boxClassName: trueBox, textClassName: "text-[var(--ff-true)]" },
  COMMUNITY_TRUE: { label: "Community says: True", boxClassName: trueBox, textClassName: "text-[var(--ff-true)]" },
  FINALIZED_FAKE: { label: "Finalized: Fake", boxClassName: fakeBox, textClassName: "text-[var(--ff-fake)]" },
  COMMUNITY_FAKE: { label: "Community says: Fake", boxClassName: fakeBox, textClassName: "text-[var(--ff-fake)]" },
  NEEDS_MORE_EVIDENCE: { label: "Needs more evidence", boxClassName: unsureBox, textClassName: "text-[#8A5700]" },
  INSUFFICIENT_DATA: { label: "Insufficient data", boxClassName: unsureBox, textClassName: "text-[#8A5700]" },
};

// Hydration flag store: never emits, so the snapshot only flips when the
// client takes over rendering from the server. Time-dependent text (the
// countdown) renders only after that flip so server and client HTML match.
function subscribeNever(): () => void {
  return () => {};
}

function formatRemaining(deadline: string | null | undefined): string | null {
  if (!deadline) {
    return null;
  }

  const remainingMs = new Date(deadline).getTime() - Date.now();

  if (!Number.isFinite(remainingMs) || remainingMs <= 0) {
    return null;
  }

  const totalMinutes = Math.ceil(remainingMs / (60 * 1000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

interface VoteActionPanelProps {
  readonly claimId: string;
  readonly pathIdentifier: string;
  readonly votingOpen: boolean;
  // The server-published verdict, when one exists — renders the clear final
  // result instead of any voting UI.
  readonly finalStatus?: ClaimStatus | null;
  // ISO timestamp when voting ends (= when the verdict publishes) for the
  // live countdown.
  readonly voteDeadline?: string | null;
  // The signed-in viewer's existing vote. The backend rejects repeat votes
  // (409, no overwrite), so when this is set the buttons are replaced with a
  // clear "You voted X" indicator — there is no vote-changing path.
  readonly viewerVote?: string | null;
  // Compact styling for the feed card (the detail page keeps full size).
  readonly compact?: boolean;
}

export function VoteActionPanel({
  claimId,
  pathIdentifier,
  votingOpen,
  finalStatus = null,
  voteDeadline = null,
  viewerVote = null,
  compact = false,
}: VoteActionPanelProps) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(voteClaimAction, initialState);
  const mounted = useSyncExternalStore(
    subscribeNever,
    () => true,
    () => false,
  );
  const [, setCountdownTick] = useState(0);

  useEffect(() => {
    if (state.success) {
      router.refresh();
    }
  }, [router, state.success]);

  // Keep the countdown live while voting is open, and re-check the server
  // for the published verdict once the deadline passes (the sweep runs every
  // ~10 minutes, so the "Finalizing…" state resolves itself).
  useEffect(() => {
    if (finalStatus) {
      return;
    }

    const interval = setInterval(() => {
      setCountdownTick((tick) => tick + 1);

      if (!votingOpen) {
        router.refresh();
      }
    }, 60 * 1000);
    return () => clearInterval(interval);
  }, [finalStatus, router, votingOpen]);

  const sectionSpacing = compact ? "mt-5" : "mt-8";
  const sectionPadding = compact ? "p-4" : "p-5 sm:p-6";
  const headingClass = compact ? "text-sm font-medium text-[var(--ff-navy)]" : "text-lg font-medium text-[var(--ff-navy)]";
  const verdict = finalStatus ? finalVerdictDisplay[finalStatus] : undefined;

  if (verdict) {
    return (
      <section aria-label="Final verdict" className={`${sectionSpacing} rounded-[var(--ff-radius-card)] border ${verdict.boxClassName} ${sectionPadding}`}>
        <p className={`text-sm font-semibold uppercase tracking-wide ${verdict.textClassName}`}>
          {verdict.label}
        </p>
        <p className="mt-1 text-xs leading-5 text-[var(--ff-text-secondary)]">
          Community voting has ended and the verdict is published.
          {viewerVote && voteLabels[viewerVote] ? ` You voted ${voteLabels[viewerVote]}.` : ""}
        </p>
      </section>
    );
  }

  if (viewerVote && voteLabels[viewerVote]) {
    return (
      <section aria-label="Your vote" className={`${sectionSpacing} rounded-[var(--ff-radius-card)] border border-[color-mix(in_srgb,var(--ff-true)_35%,var(--ff-border))] bg-[color-mix(in_srgb,var(--ff-true)_6%,white)] ${sectionPadding}`}>
        <p className="text-sm font-medium text-[var(--ff-navy)]">✓ You voted {voteLabels[viewerVote]}</p>
        <p className="mt-1 text-xs leading-5 text-[var(--ff-text-secondary)]">
          {votingOpen
            ? "Votes are final and can't be changed."
            : "Voting has ended — the final verdict is being calculated."}
        </p>
      </section>
    );
  }

  if (!votingOpen) {
    // Brief residual window between the 24h deadline and the next server
    // sweep run (cron every ~10 minutes). Auto-refreshes above.
    return (
      <section aria-live="polite" className={`${sectionSpacing} rounded-[var(--ff-radius-card)] bg-[var(--ff-surface)] ${sectionPadding}`}>
        <h2 className={headingClass}>Finalizing verdict…</h2>
        <p className="mt-2 text-sm leading-6 text-[var(--ff-text-secondary)]">
          Voting has ended. The final verdict is being calculated and will appear here in a few minutes.
        </p>
      </section>
    );
  }

  const remaining = mounted ? formatRemaining(voteDeadline) : null;

  return (
    <section className={`${sectionSpacing} rounded-[var(--ff-radius-card)] border border-[var(--ff-border)] bg-[var(--ff-surface)] ${sectionPadding}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className={headingClass}>Cast your vote</h2>
        {remaining ? (
          <p className="text-xs font-medium text-[var(--ff-text-muted)]">Voting ends in {remaining}</p>
        ) : null}
      </div>
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
