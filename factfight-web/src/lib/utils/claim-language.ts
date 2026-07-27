// CLAIM TRANSLATION — supported target languages plus a lightweight heuristic
// to guess which of them a claim is already written in. The heuristic only has
// to be good enough to hide a pointless "translate to the language it's
// already in" button. (Mirrored on mobile in utils/claimLanguage.ts.)

import { mapLocaleToAppLanguage } from "./detect-user-language";

export const translationLanguages = ["en", "vi", "zh", "es"] as const;

export type TranslationLanguage = (typeof translationLanguages)[number];

const languageLabels: Record<TranslationLanguage, string> = {
  en: "English",
  vi: "Tiếng Việt",
  zh: "中文",
  es: "Español",
};

export function getTranslationLanguageLabel(code: TranslationLanguage): string {
  return languageLabels[code];
}

// Map a BCP-47 browser locale (e.g. "vi-VN", "zh-Hans-CN") to a supported
// target language; English is the default for everything else.
export function mapLocaleToTranslationLanguage(locale: string | null | undefined): TranslationLanguage {
  return mapLocaleToAppLanguage(locale);
}

// Vietnamese uses Latin letters English/Spanish never use (đ + vowels with
// breve/circumflex/horn, and tone-marked vowels).
const VIETNAMESE_PATTERN = /[đĐăâêôơưẠ-ỹ]/;
const CJK_PATTERN = /[㐀-䶿一-鿿豈-﫿]/g;

const SPANISH_STOPWORDS = new Set([
  "el", "la", "los", "las", "un", "una", "es", "son", "está", "de", "del",
  "que", "en", "por", "para", "con", "no", "se", "su", "más", "como", "pero",
]);
const ENGLISH_STOPWORDS = new Set([
  "the", "is", "are", "was", "were", "of", "and", "to", "in", "that", "for",
  "it", "on", "this", "with", "not", "has", "have", "from", "by",
]);

export function detectClaimLanguage(text: string): TranslationLanguage | "unknown" {
  const normalized = (text || "").trim();

  if (!normalized) {
    return "unknown";
  }

  const cjkMatches = normalized.match(CJK_PATTERN);
  if (cjkMatches && cjkMatches.length / normalized.length > 0.15) {
    return "zh";
  }

  if (VIETNAMESE_PATTERN.test(normalized)) {
    return "vi";
  }

  const words = normalized.toLowerCase().split(/[^\p{L}]+/u).filter(Boolean);
  let spanishHits = 0;
  let englishHits = 0;

  for (const word of words) {
    if (SPANISH_STOPWORDS.has(word)) {
      spanishHits += 1;
    }
    if (ENGLISH_STOPWORDS.has(word)) {
      englishHits += 1;
    }
  }

  if (spanishHits >= 2 && spanishHits > englishHits) {
    return "es";
  }

  if (englishHits >= 2 && englishHits > spanishHits) {
    return "en";
  }

  return "unknown";
}
