export const appLanguages = ["en", "vi", "zh", "es"] as const;

export type AppLanguage = (typeof appLanguages)[number];

/** Map a BCP-47/device locale to the small set of languages FactFight ships. */
export function mapLocaleToAppLanguage(locale: string | null | undefined): AppLanguage {
  const prefix = (locale ?? "").trim().toLowerCase().split(/[-_]/)[0];

  return (appLanguages as readonly string[]).includes(prefix)
    ? (prefix as AppLanguage)
    : "en";
}
