import { Bot, FileCheck2, UsersRound } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { ClaimCard } from "@/components/claims/claim-card";
import { PublicSiteFooter } from "@/components/navigation/public-site-footer";
import { PublicSiteHeader } from "@/components/navigation/public-site-header";
import { AppStoreLink } from "@/components/ui/app-store-link";
import { EmptyState } from "@/components/ui/empty-state";
import { SITE_TAGLINE } from "@/lib/constants/public-site";
import { getPublicHomeClaims, type PublicHomeClaims } from "@/lib/api/claims";
import { createClient } from "@/lib/supabase/server";

export const revalidate = 60;

export const metadata: Metadata = {
  title: { absolute: "FactFight | Community-powered claim verification" },
  description:
    "Explore public claims, evidence, AI risk signals, and community verdicts on FactFight.",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    title: "FactFight | Community-powered claim verification",
    description: "Fight misinformation with evidence, transparency, and responsible participation.",
    url: "/",
  },
  twitter: {
    card: "summary_large_image",
    title: "FactFight | Community-powered claim verification",
    description: "Fight misinformation with evidence, transparency, and responsible participation.",
  },
};

const principles = [
  {
    title: "Community verification",
    description: "Public votes and evidence help people assess claims together.",
    icon: UsersRound,
  },
  {
    title: "Evidence first",
    description: "Sources and context stay visible so readers can examine the record.",
    icon: FileCheck2,
  },
  {
    title: "AI is a signal",
    description: "AI can flag risk, but it never acts as the final judge.",
    icon: Bot,
  },
] as const;

async function loadClaims(): Promise<PublicHomeClaims | null> {
  try {
    return await getPublicHomeClaims();
  } catch {
    return null;
  }
}

export default async function Home() {
  // An already-signed-in visitor landing on the marketing homepage (e.g. a
  // bookmark to factfight.com) has nothing to do here - the hero/pitch
  // content is for prospective visitors, and this page's wide hero layout
  // doesn't fit inside the authenticated app's narrower sidebar shell. Send
  // them straight into the app instead of leaving them on a page with no way
  // back to their own navigation.
  const supabase = await createClient();
  const { data: viewerData } = await supabase.auth.getClaims();
  if (typeof viewerData?.claims?.sub === "string") {
    redirect("/feed");
  }

  const data = await loadClaims();

  return (
    <div className="min-h-screen bg-[var(--ff-surface)] text-[var(--ff-text)]">
      <PublicSiteHeader />
      <main>
        <section className="bg-[var(--ff-navy)] px-4 pt-12 pb-16 text-white sm:px-7 sm:pt-16 sm:pb-20">
          <div className="mx-auto grid w-full max-w-6xl items-center gap-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(340px,0.9fr)]">
            <div>
              <p className="text-sm font-medium tracking-[0.04em] text-slate-300">Community-powered verification</p>
              <h1 className="mt-4 max-w-3xl text-4xl leading-[1.08] font-medium tracking-[-0.04em] sm:text-5xl lg:text-6xl">
                {SITE_TAGLINE}
              </h1>
              <p className="mt-6 max-w-2xl text-base leading-7 text-slate-300 sm:text-lg sm:leading-8">
                Read claims, inspect sources, and see how the community is weighing the evidence. Participation stays in the Verifact app during this public-web phase.
              </p>
              <div className="mt-8">
                <AppStoreLink label="Get Verifact on the App Store" />
              </div>
            </div>

            <aside className="rounded-[var(--ff-radius-card)] border border-white/15 bg-white/5 p-5 sm:p-6">
              <h2 className="text-lg font-medium">How FactFight approaches verification</h2>
              <ul className="mt-5 space-y-4">
                {principles.map((principle) => {
                  const Icon = principle.icon;
                  return (
                    <li className="flex gap-3" key={principle.title}>
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-white/10 text-slate-100">
                        <Icon aria-hidden="true" size={18} strokeWidth={1.8} />
                      </span>
                      <span>
                        <span className="block text-sm font-medium">{principle.title}</span>
                        <span className="mt-1 block text-sm leading-6 text-slate-300">{principle.description}</span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            </aside>
          </div>
        </section>

        <section className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-7 sm:py-14" id="recent-claims">
          <header className="mb-6 max-w-2xl">
            <p className="text-sm font-medium text-[var(--ff-ai)]">Latest activity</p>
            <h2 className="mt-1 text-3xl font-medium tracking-[-0.03em] text-[var(--ff-navy)]">Recent claims</h2>
            <p className="mt-2 leading-7 text-[var(--ff-text-secondary)]">Approved public claims, ordered by publication date.</p>
          </header>
          {!data ? (
            <EmptyState description="Public claims could not be loaded right now. Please try again shortly." title="Claims temporarily unavailable" />
          ) : data.recent.length === 0 ? (
            <EmptyState description="There are no approved public claims to display yet." title="No recent claims" />
          ) : (
            <div className="grid items-start gap-5 lg:grid-cols-2">
              {data.recent.map((claim) => <ClaimCard claim={claim} key={claim.id} />)}
            </div>
          )}
        </section>

        {data && data.trending.length > 0 ? (
          <section className="border-t border-[var(--ff-border)] bg-white">
            <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-7 sm:py-14">
              <header className="mb-6 max-w-2xl">
                <p className="text-sm font-medium text-[var(--ff-ai)]">Community attention</p>
                <h2 className="mt-1 text-3xl font-medium tracking-[-0.03em] text-[var(--ff-navy)]">Trending claims</h2>
                <p className="mt-2 leading-7 text-[var(--ff-text-secondary)]">Approved claims ordered by public vote count.</p>
              </header>
              <div className="grid items-start gap-5 lg:grid-cols-2">
                {data.trending.map((claim) => <ClaimCard claim={claim} key={claim.id} />)}
              </div>
            </div>
          </section>
        ) : null}

        <section className="border-t border-[var(--ff-border)] bg-[var(--ff-surface)] px-4 py-12 text-center sm:px-7">
          <div className="mx-auto max-w-2xl">
            <h2 className="text-2xl font-medium tracking-[-0.02em] text-[var(--ff-navy)]">Ready to weigh the evidence?</h2>
            <p className="mt-3 leading-7 text-[var(--ff-text-secondary)]">Use FactFight in your browser to vote, contribute evidence, and follow community verdicts.</p>
            <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row"><Link className="inline-flex items-center justify-center rounded-[var(--ff-radius-card)] bg-[var(--ff-navy)] px-5 py-3 text-sm font-medium text-white" href="/feed">Open FactFight on web</Link><AppStoreLink label="Get the mobile app" /></div>
          </div>
        </section>
      </main>
      <PublicSiteFooter />
    </div>
  );
}
