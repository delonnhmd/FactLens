import { LogOut } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { logoutAction } from "@/app/(auth)/actions";
import { DesktopMainNavigation, MobileMainNavigation } from "@/components/navigation/main-navigation";

export default function MainLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <div className="min-h-screen bg-[var(--ff-surface)] text-[var(--ff-text)]">
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-[var(--ff-border)] bg-white px-4 py-3 lg:hidden">
        <Link className="rounded-sm text-lg font-medium text-[var(--ff-navy)]" href="/feed">
          FactFight
        </Link>
        <form action={logoutAction}>
          <button
            aria-label="Log out"
            className="rounded-[10px] border border-[var(--ff-border)] p-2 text-[var(--ff-navy)]"
            type="submit"
          >
            <LogOut aria-hidden="true" size={18} strokeWidth={1.8} />
          </button>
        </form>
      </header>

      <div className="mx-auto grid min-h-screen max-w-[1440px] lg:grid-cols-[240px_minmax(0,760px)_minmax(220px,1fr)]">
        <aside className="hidden border-r border-[var(--ff-border)] bg-white lg:block">
          <div className="sticky top-0 flex h-screen flex-col px-5 py-7">
            <Link className="rounded-sm text-2xl font-medium tracking-[-0.03em] text-[var(--ff-navy)]" href="/feed">
              FactFight
            </Link>
            <p className="mt-2 text-sm leading-5 text-[var(--ff-text-muted)]">Fight misinformation, not each other.</p>

            <DesktopMainNavigation />

            <form action={logoutAction} className="mt-auto">
              <button
                className="flex w-full items-center gap-3 rounded-[var(--ff-radius-card)] border border-[var(--ff-border)] px-3 py-3 text-sm font-medium text-[var(--ff-navy)]"
                type="submit"
              >
                <LogOut aria-hidden="true" size={18} strokeWidth={1.8} />
                Log out
              </button>
            </form>
          </div>
        </aside>

        <main className="min-w-0 px-4 pt-5 pb-[calc(6rem+env(safe-area-inset-bottom))] sm:px-6 sm:pt-7 lg:px-8 lg:pb-10">
          {children}
        </main>

        <aside className="hidden border-l border-[var(--ff-border)] px-7 py-8 xl:block">
          <section className="sticky top-8 rounded-[var(--ff-radius-card)] border border-[var(--ff-border)] bg-white p-5">
            <h2 className="text-sm font-medium text-[var(--ff-navy)]">How verification works</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--ff-text-secondary)]">
              Community voting carries the final decision. AI is shown only as a risk signal and never as the final judge.
            </p>
          </section>
        </aside>
      </div>

      <MobileMainNavigation />
    </div>
  );
}
