"use client";

import Link from "next/link";

export default function ClaimError({ reset }: { readonly reset: () => void }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--ff-surface)] px-4 py-10">
      <section className="w-full max-w-lg rounded-[var(--ff-radius-card)] border border-[var(--ff-border)] bg-white p-7 text-center">
        <h1 className="text-2xl font-medium text-[var(--ff-navy)]">This claim could not be loaded</h1>
        <p className="mt-3 leading-7 text-[var(--ff-text-secondary)]">Please try again. No claim data was changed.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button className="rounded-[var(--ff-radius-card)] bg-[var(--ff-navy)] px-4 py-2.5 text-sm font-medium text-white" onClick={reset} type="button">Try again</button>
          <Link className="rounded-[var(--ff-radius-card)] border border-[var(--ff-border)] px-4 py-2.5 text-sm font-medium text-[var(--ff-navy)]" href="/">Home</Link>
        </div>
      </section>
    </main>
  );
}
