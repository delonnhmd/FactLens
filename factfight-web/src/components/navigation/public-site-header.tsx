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
          <AppStoreLink compact />
        </nav>
      </div>
    </header>
  );
}
