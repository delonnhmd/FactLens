export default function ClaimLoading() {
  return (
    <main aria-busy="true" aria-label="Loading claim" className="min-h-screen bg-[var(--ff-surface)] px-4 py-10">
      <div className="mx-auto max-w-3xl rounded-[var(--ff-radius-card)] border border-[var(--ff-border)] bg-white p-6 sm:p-8">
        <div className="flex items-center gap-3"><div className="size-12 rounded-full bg-[var(--ff-surface)]" /><div className="space-y-2"><div className="h-4 w-36 rounded bg-[var(--ff-border)] opacity-55" /><div className="h-3 w-48 rounded bg-[var(--ff-border)] opacity-35" /></div></div>
        <div className="mt-8 h-8 w-5/6 rounded bg-[var(--ff-border)] opacity-55" />
        <div className="mt-4 h-5 w-full rounded bg-[var(--ff-border)] opacity-35" />
        <div className="mt-2 h-5 w-3/4 rounded bg-[var(--ff-border)] opacity-35" />
        <div className="mt-8 aspect-video rounded-[var(--ff-radius-card)] bg-[var(--ff-surface)]" />
        <span className="sr-only">Loading claim details</span>
      </div>
    </main>
  );
}
