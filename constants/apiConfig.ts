// PHASE 4 STEP 1
// PHASE 4 STEP 2
export const API_CONFIG = {
  BACKEND_URL:
    process.env.EXPO_PUBLIC_BACKEND_URL ||
    "https://YOUR_RENDER_BACKEND_URL_HERE",
};

export function getBackendUrl(): string | null {
  const url = API_CONFIG.BACKEND_URL.trim().replace(/\/+$/, "");

  if (!url || url.includes("YOUR_RENDER_BACKEND_URL_HERE")) {
    return null;
  }

  return url;
}
