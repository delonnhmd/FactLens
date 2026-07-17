import Link from "next/link";

import { AppStoreLink } from "@/components/ui/app-store-link";

export function PublicSiteHeader() {
  return (
    <header className="border-b border-white/10 bg-[var(--ff-navy)] text-white">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-7">
        <Link className="rounded-sm text-xl font-medium tracking-[-0.02em]" href="/">
          FactFight
        </Link>
        <nav aria-label="Public navigation" className="flex items-center gap-3">
          <Link className="hidden rounded-sm text-sm text-slate-200 hover:text-white sm:inline" href="/#recent-claims">
            Recent claims
          </Link>
          <Link className="rounded-sm text-sm text-slate-200 hover:text-white" href="/feed">Web app</Link>
          <Link className="hidden rounded-[10px] border border-white/35 px-3 py-2 text-sm font-medium text-white sm:inline" href="/login">Log in</Link>
          <AppStoreLink compact />
        </nav>
      </div>
    </header>
  );
}
