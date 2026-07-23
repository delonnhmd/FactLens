// CLAIM TRANSLATION — shared state for the feed card and the claim detail
// screen: which language is showing, per-language results already fetched
// this session (so toggling back and forth never refetches), and the picker
// options. expo-localization is NOT a dependency of this app, so instead of
// auto-detecting the device language (which would need a new native module
// and a rebuild) the user picks the target language from a small menu; the
// claim's own detected language is removed from that menu.
import { useCallback, useMemo, useState } from "react";
import { Alert } from "react-native";

import { translateClaim, type ClaimTranslation } from "../services/translationService";
import {
  TRANSLATION_LANGUAGE_OPTIONS,
  detectClaimLanguage,
  type TranslationLanguage,
} from "../utils/claimLanguage";

export interface ClaimTranslationState {
  displayTitle: string;
  displayDescription: string;
  isShowingTranslation: boolean;
  isTranslating: boolean;
  canTranslate: boolean;
  promptTranslate: () => void;
  showOriginal: () => void;
}

export function useClaimTranslation(claim: {
  id: string;
  title: string;
  description: string;
}): ClaimTranslationState {
  const [translations, setTranslations] = useState<
    Partial<Record<TranslationLanguage, ClaimTranslation>>
  >({});
  const [activeLanguage, setActiveLanguage] = useState<TranslationLanguage | null>(null);
  const [isTranslating, setIsTranslating] = useState(false);

  const detectedLanguage = useMemo(
    () => detectClaimLanguage(`${claim.title} ${claim.description}`),
    [claim.title, claim.description],
  );

  // Never offer to translate a claim into the language it is already in.
  const languageOptions = useMemo(
    () => TRANSLATION_LANGUAGE_OPTIONS.filter((option) => option.code !== detectedLanguage),
    [detectedLanguage],
  );

  const translateTo = useCallback(
    async (language: TranslationLanguage) => {
      if (translations[language]) {
        setActiveLanguage(language);
        return;
      }

      setIsTranslating(true);

      try {
        const result = await translateClaim(claim.id, language);

        if (!result.translation) {
          Alert.alert(result.error ?? "Translation is unavailable right now.");
          return;
        }

        const translation = result.translation;
        setTranslations((current) => ({ ...current, [language]: translation }));
        setActiveLanguage(language);
      } finally {
        setIsTranslating(false);
      }
    },
    [claim.id, translations],
  );

  const promptTranslate = useCallback(() => {
    Alert.alert("Translate to", undefined, [
      ...languageOptions.map((option) => ({
        text: option.label,
        onPress: () => {
          void translateTo(option.code);
        },
      })),
      { text: "Cancel", style: "cancel" as const },
    ]);
  }, [languageOptions, translateTo]);

  const showOriginal = useCallback(() => {
    setActiveLanguage(null);
  }, []);

  const activeTranslation = activeLanguage ? translations[activeLanguage] : undefined;

  return {
    displayTitle: activeTranslation?.title ?? claim.title,
    displayDescription: activeTranslation ? activeTranslation.description : claim.description,
    isShowingTranslation: Boolean(activeTranslation),
    isTranslating,
    canTranslate: languageOptions.length > 0,
    promptTranslate,
    showOriginal,
  };
}
