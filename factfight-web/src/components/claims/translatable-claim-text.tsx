"use client";

import Link from "next/link";
import { useMemo, useState, useSyncExternalStore, useTransition } from "react";

import { translateClaimAction } from "@/app/claim/[id]/actions";
import {
  detectClaimLanguage,
  getTranslationLanguageLabel,
  mapLocaleToTranslationLanguage,
} from "@/lib/utils/claim-language";

interface TranslatableClaimTextProps {
  readonly claimId: string;
  readonly title: string;
  readonly description: string;
  // "card" renders the feed-card heading (linked h2 + clamped snippet);
  // "detail" renders the claim page heading (h1 + full description).
  readonly variant: "card" | "detail";
  readonly href?: string;
}

interface TranslatedText {
  readonly title: string;
  readonly description: string;
}

// Hydration flag store: never emits, so the snapshot only flips when the
// client takes over rendering from the server.
function subscribeNever(): () => void {
  return () => {};
}

// CLAIM TRANSLATION — the target language comes from the browser's
// navigator.language mapped to en/vi/zh/es (default en). The Translate link is
// hidden when the claim already appears to be written in that language.
export function TranslatableClaimText({ claimId, title, description, variant, href }: TranslatableClaimTextProps) {
  const [translation, setTranslation] = useState<TranslatedText | null>(null);
  const [showTranslation, setShowTranslation] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [pending, startTransition] = useTransition();
  // navigator.language only exists in the browser, so the translate controls
  // render only after hydration — server HTML and the first client render stay
  // identical (the server snapshot is false, the client snapshot true).
  const mounted = useSyncExternalStore(
    subscribeNever,
    () => true,
    () => false,
  );

  const targetLanguage = useMemo(
    () => mapLocaleToTranslationLanguage(mounted ? navigator.language : "en"),
    [mounted],
  );
  const detectedLanguage = useMemo(
    () => detectClaimLanguage(`${title} ${description}`),
    [title, description],
  );
  const canTranslate = mounted && detectedLanguage !== targetLanguage;

  const displayTitle = showTranslation && translation ? translation.title : title;
  const displayDescription = showTranslation && translation ? translation.description : description;

  const handleTranslate = () => {
    setErrorMessage("");

    if (translation) {
      setShowTranslation(true);
      return;
    }

    startTransition(async () => {
      const result = await translateClaimAction(claimId, targetLanguage);

      if (!result.ok || !result.translatedTitle) {
        setErrorMessage(result.message ?? "Translation is unavailable right now.");
        return;
      }

      setTranslation({ title: result.translatedTitle, description: result.translatedDescription ?? "" });
      setShowTranslation(true);
    });
  };

  const translateControls = canTranslate ? (
    <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
      {showTranslation && translation ? (
        <>
          <span className="text-xs text-[var(--ff-text-muted)]">Translated by AI — may not be fully accurate.</span>
          <button
            className="rounded-sm text-xs font-medium text-[var(--ff-navy)] underline"
            onClick={() => setShowTranslation(false)}
            type="button"
          >
            See original
          </button>
        </>
      ) : (
        <button
          className="rounded-sm text-sm font-medium text-[var(--ff-navy)] underline disabled:cursor-wait disabled:opacity-60"
          disabled={pending}
          onClick={handleTranslate}
          type="button"
        >
          {pending
            ? "Translating…"
            : translation
              ? "Show translation"
              : `Translate to ${getTranslationLanguageLabel(targetLanguage)}`}
        </button>
      )}
      {errorMessage ? <span className="text-xs text-[var(--ff-fake)]" role="alert">{errorMessage}</span> : null}
    </div>
  ) : null;

  if (variant === "card") {
    return (
      <>
        <h2 className="mt-5 text-xl leading-7 font-medium text-[var(--ff-navy)] sm:text-2xl sm:leading-8">
          {href ? (
            <Link className="rounded-sm hover:underline" href={href}>
              {displayTitle}
            </Link>
          ) : (
            displayTitle
          )}
        </h2>
        {displayDescription ? (
          <p className="mt-3 line-clamp-3 whitespace-pre-line leading-7 text-[var(--ff-text-secondary)]">
            {displayDescription}
          </p>
        ) : null}
        {translateControls}
      </>
    );
  }

  return (
    <>
      <h1 className="mt-6 text-3xl leading-[1.18] font-medium tracking-[-0.03em] text-[var(--ff-navy)] sm:text-4xl">
        {displayTitle}
      </h1>
      {displayDescription ? (
        <p className="mt-5 whitespace-pre-line text-lg leading-8 text-[var(--ff-text-secondary)]">
          {displayDescription}
        </p>
      ) : null}
      {translateControls}
    </>
  );
}
