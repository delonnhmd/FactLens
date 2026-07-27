import { describe, expect, it } from "vitest";

import { mapLocaleToAppLanguage } from "./detect-user-language";
import { onboardingStrings } from "./onboarding-strings";

describe("FactFight onboarding localization", () => {
  it.each([
    ["en-US", "en"],
    ["vi-VN", "vi"],
    ["zh-Hans-CN", "zh"],
    ["es-ES", "es"],
    ["fr-FR", "en"],
    ["", "en"],
  ])("maps %s to %s", (locale, expected) => {
    expect(mapLocaleToAppLanguage(locale)).toBe(expected);
  });

  it("contains complete static copy for every supported language", () => {
    for (const language of ["en", "vi", "zh", "es"] as const) {
      expect(onboardingStrings[language].welcomeTitle).toBeTruthy();
      expect(onboardingStrings[language].howItWorksSteps).toHaveLength(4);
      expect(onboardingStrings[language].firstClaimLiveBody).toBeTruthy();
      expect(onboardingStrings[language].shareIt).toBeTruthy();
    }
  });
});
