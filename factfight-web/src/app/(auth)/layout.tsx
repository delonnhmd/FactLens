import Link from "next/link";
import type { ReactNode } from "react";

export default function AuthLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <div className="min-h-screen bg-[var(--ff-surface)] px-4 py-5 text-[var(--ff-text)] sm:px-8 sm:py-8">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4">
        <Link
          className="rounded-sm text-xl font-medium tracking-[-0.02em] text-[var(--ff-navy)]"
          href="/"
        >
          FactFight
        </Link>
        <Link
          className="rounded-[var(--ff-radius-card)] border border-[var(--ff-border)] bg-white px-3.5 py-2 text-sm font-medium text-[var(--ff-navy)]"
          href="/"
        >
          Back to home
        </Link>
      </header>
      <main className="mx-auto flex w-full max-w-xl items-center py-10 sm:min-h-[calc(100vh-6rem)] sm:py-12">
        {children}
      </main>
    </div>
  );
}
