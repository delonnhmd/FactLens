// CLAIM TRANSLATION — client for POST /api/claims/{id}/translate. The backend
// owns the OpenAI call, the per-user rate limit, and the per-claim+language
// cache (claim_translations), so repeat requests are instant and free. Works
// logged out too (the backend then rate-limits by IP); a session token is
// attached when present so the per-user cap applies.
import { supabase } from "../lib/supabase";
import { getBackendUrl } from "../constants/apiConfig";
import { fetchWithAuthRetry } from "../utils/authFetch";
import type { TranslationLanguage } from "../utils/claimLanguage";

export interface ClaimTranslation {
  title: string;
  description: string;
  cached: boolean;
}

export interface ClaimTranslationResult {
  translation: ClaimTranslation | null;
  error: string | null;
}

const TRANSLATE_UNAVAILABLE_MESSAGE = "Translation is unavailable right now. Please try again.";

export async function translateClaim(
  claimId: string,
  targetLanguage: TranslationLanguage,
): Promise<ClaimTranslationResult> {
  const backendUrl = getBackendUrl();

  if (!backendUrl) {
    return { translation: null, error: TRANSLATE_UNAVAILABLE_MESSAGE };
  }

  const url = `${backendUrl}/api/claims/${encodeURIComponent(claimId)}/translate`;
  const body = JSON.stringify({ target_language: targetLanguage });
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token ?? null;

  let response: Response;

  try {
    response = accessToken
      ? await fetchWithAuthRetry(
          url,
          (token) => ({
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body,
          }),
          accessToken,
        )
      : await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
        });
  } catch (error) {
    console.log("[translate] network error:", error);
    return { translation: null, error: "Unable to reach FactFight. Check your connection and try again." };
  }

  let data: Record<string, unknown> = {};

  try {
    data = (await response.json()) as Record<string, unknown>;
  } catch {
    data = {};
  }

  if (!response.ok) {
    const detail = typeof data.detail === "string" ? data.detail : "";

    if (response.status === 429) {
      return { translation: null, error: "Too many translations right now. Please try again later." };
    }

    return { translation: null, error: detail || TRANSLATE_UNAVAILABLE_MESSAGE };
  }

  const title = typeof data.translated_title === "string" ? data.translated_title : "";
  const description =
    typeof data.translated_description === "string" ? data.translated_description : "";

  if (!title) {
    return { translation: null, error: TRANSLATE_UNAVAILABLE_MESSAGE };
  }

  return {
    translation: { title, description, cached: data.cached === true },
    error: null,
  };
}
