"use client";

export default function MainAppError({ reset }: { readonly error: Error & { digest?: string }; readonly reset: () => void }) {
  return <section className="mx-auto w-full max-w-xl rounded-[var(--ff-radius-card)] border border-[var(--ff-border)] bg-white p-6 text-center sm:p-8"><p className="text-sm font-medium text-[var(--ff-ai)]">FactFight</p><h1 className="mt-2 text-2xl font-medium text-[var(--ff-navy)]">This page is temporarily unavailable</h1><p className="mt-3 leading-7 text-[var(--ff-text-secondary)]">Your account is still safe. Try loading the page again.</p><button className="mt-6 rounded-[var(--ff-radius-card)] bg-[var(--ff-navy)] px-5 py-3 text-sm font-medium text-white" onClick={reset} type="button">Try again</button></section>;
}
