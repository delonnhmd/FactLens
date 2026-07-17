import Link from "next/link";

export function PublicSiteFooter() {
  return (
    <footer className="border-t border-[var(--ff-border)] bg-white">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 py-7 text-sm text-[var(--ff-text-muted)] sm:flex-row sm:items-center sm:justify-between sm:px-7">
        <p>FactFight is community-powered claim verification built around evidence and transparency.</p>
        <Link className="rounded-sm font-medium text-[var(--ff-navy)] hover:underline" href="/">
          FactFight home
        </Link>
      </div>
    </footer>
  );
}
