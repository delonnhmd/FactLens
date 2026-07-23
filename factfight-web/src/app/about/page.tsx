import { Bot, FileCheck2, UsersRound } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { PublicPageShell } from "@/components/navigation/public-page-shell";
import { AppStoreLink } from "@/components/ui/app-store-link";
import { SITE_NAME, SITE_TAGLINE } from "@/lib/constants/public-site";

export const metadata: Metadata = {
  title: "About | FactFight",
  description: "What FactFight is, how community verification works, and who operates it.",
  alternates: { canonical: "/about" },
};

const principles = [
  {
    title: "Community verification",
    description: "Every claim is reviewed and voted on by the community — True, Fake, or Unsure. The server calculates the final result from those votes.",
    icon: UsersRound,
  },
  {
    title: "Evidence first",
    description: "Sources and supporting evidence stay attached to every claim so readers can examine the record themselves, not just the verdict.",
    icon: FileCheck2,
  },
  {
    title: "AI is a signal, not a judge",
    description: "AI can flag risk and surface context, but it never decides a claim's outcome. That's left to community voting.",
    icon: Bot,
  },
] as const;

export default function AboutPage() {
  return (
    <PublicPageShell>
      <article className="overflow-hidden rounded-[var(--ff-radius-card)] border border-[var(--ff-border)] bg-white p-6 sm:p-9">
        <p className="text-sm font-medium text-[var(--ff-ai)]">About {SITE_NAME}</p>
        <h1 className="mt-2 text-3xl font-medium tracking-[-0.03em] text-[var(--ff-navy)] sm:text-4xl">{SITE_TAGLINE}</h1>
        <p className="mt-5 leading-7 text-[var(--ff-text-secondary)]">
          {SITE_NAME} is a community-powered claim verification platform. Anyone can post a claim, attach a source, and the community decides what to believe — by voting, not by algorithm. Our goal is to make it easier to weigh evidence together, in public, instead of arguing past each other.
        </p>

        <section className="mt-8" aria-labelledby="how-it-works-heading">
          <h2 className="text-xl font-medium text-[var(--ff-navy)]" id="how-it-works-heading">How it works</h2>
          <ul className="mt-5 space-y-5">
            {principles.map((principle) => {
              const Icon = principle.icon;
              return (
                <li className="flex gap-3" key={principle.title}>
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-[var(--ff-surface)] text-[var(--ff-navy)]">
                    <Icon aria-hidden="true" size={18} strokeWidth={1.8} />
                  </span>
                  <span>
                    <span className="block font-medium text-[var(--ff-navy)]">{principle.title}</span>
                    <span className="mt-1 block leading-6 text-[var(--ff-text-secondary)]">{principle.description}</span>
                  </span>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="mt-8 border-t border-[var(--ff-border)] pt-7" aria-labelledby="who-runs-heading">
          <h2 className="text-xl font-medium text-[var(--ff-navy)]" id="who-runs-heading">Who runs FactFight</h2>
          <p className="mt-3 leading-7 text-[var(--ff-text-secondary)]">
            FactFight is operated by MD Media LLC (Houston, Texas). We don&apos;t author claims, and verdicts on the platform are the aggregated output of community voting, not a statement of fact by FactFight or MD Media LLC. See our <Link className="font-medium text-[var(--ff-navy)] underline" href="/terms">Terms of use</Link> and <Link className="font-medium text-[var(--ff-navy)] underline" href="/privacy">Privacy Policy</Link> for the full details.
          </p>
        </section>

        <section className="mt-8 border-t border-[var(--ff-border)] pt-7" aria-labelledby="get-in-touch-heading">
          <h2 className="text-xl font-medium text-[var(--ff-navy)]" id="get-in-touch-heading">Get in touch</h2>
          <p className="mt-3 leading-7 text-[var(--ff-text-secondary)]">
            Questions, feedback, or a report we should know about? Email <a className="font-medium text-[var(--ff-navy)] underline" href="mailto:support@factfight.com">support@factfight.com</a>.
          </p>
        </section>

        <div className="mt-9 flex flex-col items-start gap-3 border-t border-[var(--ff-border)] pt-7 sm:flex-row sm:items-center">
          <Link className="inline-flex items-center justify-center rounded-[var(--ff-radius-card)] bg-[var(--ff-navy)] px-5 py-3 text-sm font-medium text-white" href="/feed">
            Open FactFight on web
          </Link>
          <AppStoreLink label="Get the mobile app" />
        </div>
      </article>
    </PublicPageShell>
  );
}
