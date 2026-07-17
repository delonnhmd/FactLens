"use client";

import { Home, PlusSquare, Search, Trophy, UserRound } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const navigation = [
  { label: "Feed", icon: Home, href: "/feed", enabled: true },
  { label: "Create", icon: PlusSquare, href: "/create", enabled: true },
  { label: "Search", icon: Search, href: "/search", enabled: true },
  { label: "Leaderboard", icon: Trophy, href: "/leaderboard", enabled: true },
  { label: "Profile", icon: UserRound, href: "/profile", enabled: true },
] as const;

function isActivePath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function DesktopMainNavigation() {
  const pathname = usePathname();

  return (
    <nav aria-label="Main navigation" className="mt-8 space-y-1.5">
      {navigation.map((item) => {
        const Icon = item.icon;
        const active = item.enabled && isActivePath(pathname, item.href);
        const content = (
          <>
            <Icon aria-hidden="true" size={19} strokeWidth={1.8} />
            <span>{item.label}</span>
            {!item.enabled ? <span className="ml-auto text-[10px] text-[var(--ff-text-muted)]">Soon</span> : null}
          </>
        );

        return item.enabled ? (
          <Link
            aria-current={active ? "page" : undefined}
            className={`flex items-center gap-3 rounded-[var(--ff-radius-card)] px-3 py-3 text-sm ${
              active
                ? "bg-[color-mix(in_srgb,var(--ff-navy)_8%,white)] font-medium text-[var(--ff-navy)]"
                : "text-[var(--ff-text-secondary)] hover:bg-[var(--ff-surface)] hover:text-[var(--ff-navy)]"
            }`}
            href={item.href}
            key={item.label}
          >
            {content}
          </Link>
        ) : (
          <span
            aria-disabled="true"
            className="flex cursor-not-allowed items-center gap-3 rounded-[var(--ff-radius-card)] px-3 py-3 text-sm text-[var(--ff-text-muted)]"
            key={item.label}
          >
            {content}
          </span>
        );
      })}
    </nav>
  );
}

export function MobileMainNavigation() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Mobile navigation"
      className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-[var(--ff-border)] bg-white px-1 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] lg:hidden"
    >
      {navigation.map((item) => {
        const Icon = item.icon;
        const active = item.enabled && isActivePath(pathname, item.href);
        const className = item.enabled
          ? `flex flex-col items-center gap-1 rounded-[10px] px-1 py-1.5 ${active ? "text-[var(--ff-navy)]" : "text-[var(--ff-text-muted)]"}`
          : "flex cursor-not-allowed flex-col items-center gap-1 rounded-[10px] px-1 py-1.5 text-[var(--ff-text-muted)] opacity-65";
        const content = (
          <>
            <Icon aria-hidden="true" size={19} strokeWidth={active ? 2 : 1.7} />
            <span className="text-[10px] font-medium">{item.label}</span>
          </>
        );

        return item.enabled ? (
          <Link aria-current={active ? "page" : undefined} className={className} href={item.href} key={item.label}>
            {content}
          </Link>
        ) : (
          <span aria-disabled="true" className={className} key={item.label}>
            {content}
          </span>
        );
      })}
    </nav>
  );
}
