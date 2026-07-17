import Link from "next/link";

export function PublicSiteFooter() {
  return (
    <footer className="border-t border-[var(--ff-border)] bg-white">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 py-7 text-sm text-[var(--ff-text-muted)] sm:flex-row sm:items-center sm:justify-between sm:px-7">
        <p>FactFight is community-powered claim verification built around evidence and transparency.</p>
        <nav className="flex flex-wrap gap-4" aria-label="Footer navigation"><Link className="rounded-sm font-medium text-[var(--ff-navy)] hover:underline" href="/">Home</Link><Link className="rounded-sm font-medium text-[var(--ff-navy)] hover:underline" href="/privacy">Privacy</Link><Link className="rounded-sm font-medium text-[var(--ff-navy)] hover:underline" href="/terms">Terms</Link></nav>
      </div>
    </footer>
  );
}
