export const PUBLIC_SITE_URL = "https://verifact.pennyfloat.com";
export const SUPPORT_EMAIL = "support@verifact.pennyfloat.com";
export const AUTH_CALLBACK_URL = `${PUBLIC_SITE_URL}/auth/callback`;
export const APP_AUTH_CALLBACK_URL = "verifact://auth/callback";
export const EXPO_GO_AUTH_CALLBACK_URL = "exp+factlens://auth/callback";
export const VERIFACT_EXPO_GO_AUTH_CALLBACK_URL = "exp+verifact://auth/callback";
export const AUTH_REDIRECT_URLS = [
  AUTH_CALLBACK_URL,
  APP_AUTH_CALLBACK_URL,
  EXPO_GO_AUTH_CALLBACK_URL,
  VERIFACT_EXPO_GO_AUTH_CALLBACK_URL,
];
