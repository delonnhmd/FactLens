export default function FeedLoading() {
  return (
    <div aria-busy="true" aria-label="Loading claims" className="mx-auto w-full max-w-[680px]">
      <div className="h-8 w-28 rounded bg-[var(--ff-border)] opacity-60" />
      <div className="mt-3 h-5 w-72 max-w-full rounded bg-[var(--ff-border)] opacity-45" />
      <div className="mt-7 space-y-5">
        {[0, 1, 2].map((item) => (
          <div className="rounded-[var(--ff-radius-card)] border border-[var(--ff-border)] bg-white p-6" key={item}>
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-full bg-[var(--ff-surface)]" />
              <div className="space-y-2">
                <div className="h-3 w-32 rounded bg-[var(--ff-border)] opacity-60" />
                <div className="h-3 w-44 rounded bg-[var(--ff-border)] opacity-40" />
              </div>
            </div>
            <div className="mt-6 h-6 w-4/5 rounded bg-[var(--ff-border)] opacity-55" />
            <div className="mt-3 h-4 w-full rounded bg-[var(--ff-border)] opacity-35" />
            <div className="mt-2 h-4 w-3/4 rounded bg-[var(--ff-border)] opacity-35" />
          </div>
        ))}
      </div>
      <span className="sr-only">Loading recent claims</span>
    </div>
  );
}
