import type { ReactNode } from "react";

import { PublicPageShell } from "@/components/navigation/public-page-shell";

export function LegalPage({ title, effective, children }: { readonly title: string; readonly effective: string; readonly children: ReactNode }) {
  return <PublicPageShell><article className="rounded-[var(--ff-radius-card)] border border-[var(--ff-border)] bg-white p-6 sm:p-9"><h1 className="text-3xl font-medium tracking-[-0.03em] text-[var(--ff-navy)] sm:text-4xl">{title}</h1><p className="mt-2 text-sm text-[var(--ff-text-muted)]">{effective}</p><div className="mt-8 space-y-7 text-[var(--ff-text-secondary)] [&_a]:font-medium [&_a]:text-[var(--ff-navy)] [&_a]:underline [&_h2]:mb-2 [&_h2]:text-xl [&_h2]:font-medium [&_h2]:text-[var(--ff-navy)] [&_li]:ml-5 [&_li]:list-disc [&_li]:leading-7 [&_p]:leading-7">{children}</div></article></PublicPageShell>;
}
