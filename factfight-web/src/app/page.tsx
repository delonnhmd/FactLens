import { Bot, MessagesSquare, Scale } from "lucide-react";
import Link from "next/link";

const previewFeatures = [
  {
    title: "Community verification",
    description: "Claims are examined through responsible participation.",
    icon: Scale,
    color: "var(--ff-true)",
    background: "color-mix(in srgb, var(--ff-true) 12%, white)",
  },
  {
    title: "Evidence-based discussion",
    description: "Sources and context keep conversations grounded.",
    icon: MessagesSquare,
    color: "var(--ff-navy)",
    background: "color-mix(in srgb, var(--ff-navy) 9%, white)",
  },
  {
    title: "AI as a risk signal, not the final judge",
    description: "People and evidence remain central to every verdict.",
    icon: Bot,
    color: "var(--ff-ai)",
    background: "color-mix(in srgb, var(--ff-ai) 10%, white)",
  },
] as const;

export default function Home() {
  return (
    <main className="min-h-screen bg-[var(--ff-background)] px-4 py-6 text-[var(--ff-text)] sm:px-8 sm:py-8 lg:px-12 lg:py-10">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-6xl flex-col sm:min-h-[calc(100vh-4rem)] lg:min-h-[calc(100vh-5rem)]">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--ff-border)] pb-5">
          <Link
            className="rounded-sm text-xl font-medium tracking-[-0.02em] text-[var(--ff-navy)]"
            href="/"
          >
            FactFight
          </Link>
          <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3">
            <p className="rounded-full border border-[color-mix(in_srgb,var(--ff-ai)_35%,var(--ff-border))] bg-[color-mix(in_srgb,var(--ff-ai)_8%,white)] px-3 py-1.5 text-sm font-medium text-[var(--ff-ai)]">
              Development preview
            </p>
            <nav aria-label="Account" className="flex items-center gap-2">
              <Link
                className="rounded-[var(--ff-radius-card)] border border-[var(--ff-border)] px-3.5 py-2 text-sm font-medium text-[var(--ff-navy)]"
                href="/login"
              >
                Log in
              </Link>
              <Link
                className="rounded-[var(--ff-radius-card)] border border-[var(--ff-navy)] bg-[var(--ff-navy)] px-3.5 py-2 text-sm font-medium text-white"
                href="/signup"
              >
                Create account
              </Link>
            </nav>
          </div>
        </header>

        <section
          aria-labelledby="preview-title"
          className="grid flex-1 items-center gap-10 py-12 sm:py-16 lg:grid-cols-[minmax(0,1.05fr)_minmax(360px,0.95fr)] lg:gap-16 lg:py-20"
          id="preview"
        >
          <div className="max-w-2xl">
            <p className="mb-4 text-sm font-medium tracking-[0.04em] text-[var(--ff-ai)]">
              Community-powered verification
            </p>
            <h1
              className="max-w-xl text-4xl leading-[1.08] font-medium tracking-[-0.035em] text-[var(--ff-navy)] sm:text-5xl lg:text-6xl"
              id="preview-title"
            >
              FactFight
            </h1>
            <p className="mt-5 max-w-xl text-xl leading-8 font-medium text-[var(--ff-text)] sm:text-2xl">
              Fight misinformation, not each other.
            </p>
            <p className="mt-5 max-w-xl text-base leading-7 text-[var(--ff-text-secondary)] sm:text-lg sm:leading-8">
              The FactFight web platform is being prepared. This temporary page validates the new application foundation while the real product experience remains under development.
            </p>
            <button
              className="mt-8 cursor-not-allowed rounded-[var(--ff-radius-card)] border border-[var(--ff-control-border)] bg-[var(--ff-surface)] px-5 py-3 text-base font-medium text-[var(--ff-text-muted)] opacity-75"
              disabled
              type="button"
            >
              Open FactFight
            </button>
          </div>

          <article className="rounded-[var(--ff-radius-card)] border border-[var(--ff-border)] bg-[var(--ff-surface)] p-5 sm:p-7">
            <h2 className="text-lg font-medium text-[var(--ff-navy)]">What FactFight is built around</h2>
            <ul className="mt-5 space-y-3" role="list">
              {previewFeatures.map((feature) => {
                const Icon = feature.icon;

                return (
                  <li
                    className="flex gap-4 rounded-[var(--ff-radius-card)] border border-[var(--ff-border)] bg-white p-4"
                    key={feature.title}
                  >
                    <span
                      aria-hidden="true"
                      className="flex size-10 shrink-0 items-center justify-center rounded-[10px]"
                      style={{ background: feature.background, color: feature.color }}
                    >
                      <Icon size={20} strokeWidth={1.8} />
                    </span>
                    <span>
                      <span className="block font-medium text-[var(--ff-text)]">{feature.title}</span>
                      <span className="mt-1 block text-sm leading-6 text-[var(--ff-text-secondary)]">
                        {feature.description}
                      </span>
                    </span>
                  </li>
                );
              })}
            </ul>
          </article>
        </section>

        <footer className="border-t border-[var(--ff-border)] py-5 text-sm text-[var(--ff-text-muted)]">
          Development preview. Read-only claim views are enabled.
        </footer>
      </div>
    </main>
  );
}
