// PHASE 4 STEP 1
// PHASE 4 STEP 2
// PHASE 4 STEP 6
// PHASE 4 STEP 10B
const backendUrlFromEnv = process.env.EXPO_PUBLIC_BACKEND_URL;

export const API_CONFIG = {
  BACKEND_URL:
    backendUrlFromEnv ||
    "https://factlens-e8uf.onrender.com",
};

console.log("BACKEND_URL", API_CONFIG.BACKEND_URL);
console.log("BACKEND_ENV", {
  EXPO_PUBLIC_BACKEND_URL: backendUrlFromEnv ?? null,
  USING_FALLBACK_BACKEND_URL: !backendUrlFromEnv,
});

export function getBackendUrl(): string | null {
  const url = API_CONFIG.BACKEND_URL.trim().replace(/\/+$/, "");

  if (!url) {
    return null;
  }

  return url;
}
