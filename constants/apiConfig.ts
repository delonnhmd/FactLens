// PHASE 4 STEP 1
// PHASE 4 STEP 2
// PHASE 4 STEP 6
// PHASE 4 STEP 10B
export const API_CONFIG = {
  BACKEND_URL:
    process.env.EXPO_PUBLIC_BACKEND_URL ||
    "https://factlens-e8uf.onrender.com",
};

export function getBackendUrl(): string | null {
  const url = API_CONFIG.BACKEND_URL.trim().replace(/\/+$/, "");

  if (!url) {
    return null;
  }

  return url;
}
