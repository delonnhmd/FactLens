export const appLanguages = ["en", "vi", "zh", "es"] as const;
export type AppLanguage = (typeof appLanguages)[number];

// Keep the web boundary self-contained: Next/Turbopack intentionally does not
// bundle files from the Expo project root. This is the same pure mapping used
// by the mobile shared utility (utils/detectUserLanguage.ts).
export function mapLocaleToAppLanguage(locale: string | null | undefined): AppLanguage {
  const prefix = (locale ?? "").trim().toLowerCase().split(/[-_]/)[0];
  return (appLanguages as readonly string[]).includes(prefix)
    ? (prefix as AppLanguage)
    : "en";
}
