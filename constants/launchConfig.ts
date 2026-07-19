export const PUBLIC_SITE_URL = "https://verifact.pennyfloat.com";
// Base URL for user-facing claim SHARE links. Kept separate from
// PUBLIC_SITE_URL (which drives auth callback / password-reset / privacy URLs
// registered against verifact.pennyfloat.com in Supabase — do NOT repoint those).
// factfight.com is verified + SSL on Render and serves the same backend, so
// old verifact.pennyfloat.com/claim/{id} links keep resolving.
export const SHARE_BASE_URL = "https://factfight.com";
export const SUPPORT_EMAIL = "support@factfight.com";
export const AUTH_CALLBACK_URL = `${PUBLIC_SITE_URL}/auth/callback`;
export const RESET_PASSWORD_URL = `${PUBLIC_SITE_URL}/reset-password`;
export const AUTH_RESET_PASSWORD_URL = `${PUBLIC_SITE_URL}/auth/reset-password`;
export const APP_AUTH_CALLBACK_URL = "verifact://auth/callback";
export const EXPO_GO_AUTH_CALLBACK_URL = "exp+factlens://auth/callback";
export const VERIFACT_EXPO_GO_AUTH_CALLBACK_URL = "exp+verifact://auth/callback";
export const AUTH_REDIRECT_URLS = [
  AUTH_CALLBACK_URL,
  RESET_PASSWORD_URL,
  AUTH_RESET_PASSWORD_URL,
  APP_AUTH_CALLBACK_URL,
  EXPO_GO_AUTH_CALLBACK_URL,
  VERIFACT_EXPO_GO_AUTH_CALLBACK_URL,
];
