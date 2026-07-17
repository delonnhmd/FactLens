"use client";

import { AlertCircle } from "lucide-react";

export default function FeedError({ reset }: { readonly reset: () => void }) {
  return (
    <section className="mx-auto w-full max-w-[680px] rounded-[var(--ff-radius-card)] border border-[var(--ff-border)] bg-white p-7 text-center">
      <AlertCircle aria-hidden="true" className="mx-auto text-[var(--ff-fake)]" size={30} strokeWidth={1.7} />
      <h1 className="mt-4 text-2xl font-medium text-[var(--ff-navy)]">The feed could not be loaded</h1>
      <p className="mt-2 leading-7 text-[var(--ff-text-secondary)]">Please try again. No claim data was changed.</p>
      <button className="mt-6 rounded-[var(--ff-radius-card)] border border-[var(--ff-navy)] bg-[var(--ff-navy)] px-4 py-2.5 text-sm font-medium text-white" onClick={reset} type="button">
        Try again
      </button>
    </section>
  );
}
