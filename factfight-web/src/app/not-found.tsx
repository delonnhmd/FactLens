import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--ff-surface)] px-4 py-10 text-[var(--ff-text)]">
      <section className="w-full max-w-xl rounded-[var(--ff-radius-card)] border border-[var(--ff-border)] bg-white p-7 text-center sm:p-10">
        <p className="text-sm font-medium text-[var(--ff-ai)]">FactFight</p>
        <h1 className="mt-3 text-3xl font-medium tracking-[-0.03em] text-[var(--ff-navy)]">Claim or page unavailable</h1>
        <p className="mt-4 leading-7 text-[var(--ff-text-secondary)]">It may have been removed, hidden, or never existed. We do not reveal moderation details for unavailable content.</p>
        <div className="mt-7 flex justify-center">
          <Link className="rounded-[var(--ff-radius-card)] bg-[var(--ff-navy)] px-4 py-2.5 text-sm font-medium text-white" href="/">Go to homepage</Link>
        </div>
      </section>
    </main>
  );
}
