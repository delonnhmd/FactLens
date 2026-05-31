// PHASE 4 STEP 1
// PHASE 4 STEP 2
// PHASE 4 STEP 3
// PHASE 4 STEP 6
import { API_CONFIG, getBackendUrl } from "../constants/apiConfig";
import type { Claim } from "../types/claim";

export interface AiPrecheckResponse {
  ok: boolean;
  claim_id: string;
  ai_result?: Record<string, unknown> | null;
  ai_confidence?: number | null;
  source_count?: number | null;
  source_quality?: string | null;
  red_flags?: string[] | null;
  ai_summary?: string | null;
  ai_status?: string | null;
  error?: string | null;
  details?: string | null;
  hint?: string | null;
  update_payload?: Record<string, unknown> | null;
  updated_claim?: Record<string, unknown> | null;
}

async function postAiPrecheck(
  path: "/ai/precheck" | "/ai/precheck/retry",
  body: Record<string, unknown>,
  claimId: string,
): Promise<AiPrecheckResponse> {
  const backendUrl = getBackendUrl();

  if (!backendUrl) {
    console.log("[ai] backend url:", API_CONFIG.BACKEND_URL);
    return {
      ok: false,
      claim_id: claimId,
      error: "AI pre-check backend URL is not configured.",
    };
  }

  const requestUrl = `${backendUrl}${path}`;
  console.log("[ai] backend url:", API_CONFIG.BACKEND_URL);
  console.log("[ai] calling:", requestUrl);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(requestUrl, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const data = (await response.json().catch(() => ({}))) as Partial<AiPrecheckResponse>;

    if (!response.ok) {
      return {
        ok: false,
        claim_id: claimId,
        error: data.error ?? `AI pre-check failed with HTTP ${response.status}.`,
        details: data.details ?? null,
        hint: data.hint ?? null,
      };
    }

    return {
      ok: Boolean(data.ok),
      claim_id: data.claim_id ?? claimId,
      ai_result: data.ai_result ?? null,
      ai_confidence: data.ai_confidence ?? null,
      source_count: data.source_count ?? null,
      source_quality: data.source_quality ?? null,
      red_flags: data.red_flags ?? [],
      ai_summary: data.ai_summary ?? null,
      ai_status: data.ai_status ?? null,
      error: data.error ?? null,
      details: data.details ?? null,
      hint: data.hint ?? null,
      update_payload: data.update_payload ?? null,
      updated_claim: data.updated_claim ?? null,
    };
  } catch (error) {
    return {
      ok: false,
      claim_id: claimId,
      error: error instanceof Error ? error.message : "AI pre-check unavailable",
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function runAiPrecheckForClaim(claim: Claim): Promise<AiPrecheckResponse> {
  return postAiPrecheck(
    "/ai/precheck",
    {
      claim_id: claim.id,
      title: claim.title,
      description: claim.description,
      source_url: claim.sourceUrl,
      category: claim.category ?? "Other",
    },
    claim.id,
  );
}

// PHASE 4 STEP 3
export async function retryAiPrecheckForClaim(claimId: string): Promise<AiPrecheckResponse> {
  return postAiPrecheck(
    "/ai/precheck/retry",
    {
      claim_id: claimId,
    },
    claimId,
  );
}
