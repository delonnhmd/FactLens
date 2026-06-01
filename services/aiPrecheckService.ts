// PHASE 4 STEP 1
// PHASE 4 STEP 2
// PHASE 4 STEP 3
// PHASE 4 STEP 6
// PHASE 4 STEP 7
// PHASE 4 STEP 9
// PHASE 4 STEP 10
// PHASE 4 STEP 10B
import { API_CONFIG } from "../constants/apiConfig";
import type { Claim } from "../types/claim";

export interface AiPrecheckResponse {
  ok: boolean;
  claim_id: string;
  claim_type?: string | null;
  ai_result?: Record<string, unknown> | null;
  ai_confidence?: number | null;
  source_count?: number | null;
  source_quality?: string | null;
  source_domain?: string | null;
  source_score?: number | null;
  source_reason?: string | null;
  evidence_used_count?: number | null;
  red_flags?: string[] | null;
  ai_summary?: string | null;
  ai_status?: string | null;
  error?: string | null;
  detail?: unknown;
  details?: string | null;
  hint?: string | null;
  update_payload?: Record<string, unknown> | null;
  updated_claim?: Record<string, unknown> | null;
}

const AI_PRECHECK_TIMEOUT_MS = 10000;

function getBackendErrorMessage(data: Partial<AiPrecheckResponse>, status: number): string {
  const detail =
    typeof data.detail === "string"
      ? data.detail
      : data.detail
        ? JSON.stringify(data.detail)
        : null;

  return [data.error, detail, data.details, data.hint].filter(Boolean).join(" ") || `AI pre-check failed with HTTP ${status}.`;
}

async function postAiPrecheck(
  path: "/ai/precheck" | "/ai/precheck/retry",
  body: Record<string, unknown>,
  claimId: string,
): Promise<AiPrecheckResponse> {
  // PHASE 4 STEP 10B
  const backendUrl = API_CONFIG.BACKEND_URL.trim().replace(/\/+$/, "");

  if (!backendUrl) {
    console.log("[ai frontend] backend url:", API_CONFIG.BACKEND_URL);
    return {
      ok: false,
      claim_id: claimId,
      error: "AI pre-check backend URL is not configured.",
    };
  }

  const requestUrl = `${backendUrl}${path}`;
  console.log("[ai frontend] backend url:", API_CONFIG.BACKEND_URL);
  console.log("[ai frontend] request body:", body);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), AI_PRECHECK_TIMEOUT_MS);

  try {
    const response = await fetch(requestUrl, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    const json = (await response.json().catch(() => ({}))) as Partial<AiPrecheckResponse>;

    console.log("[ai frontend] response status:", response.status);
    console.log("[ai frontend] response json:", json);

    if (!response.ok) {
      return {
        ok: false,
        claim_id: claimId,
        error: getBackendErrorMessage(json, response.status),
        details: null,
        hint: null,
      };
    }

    return {
      ok: Boolean(json.ok),
      claim_id: json.claim_id ?? claimId,
      claim_type: json.claim_type ?? null,
      ai_result: json.ai_result ?? null,
      ai_confidence: json.ai_confidence ?? null,
      source_count: json.source_count ?? null,
      source_quality: json.source_quality ?? null,
      source_domain: json.source_domain ?? null,
      source_score: json.source_score ?? null,
      source_reason: json.source_reason ?? null,
      evidence_used_count: json.evidence_used_count ?? null,
      red_flags: json.red_flags ?? [],
      ai_summary: json.ai_summary ?? null,
      ai_status: json.ai_status ?? null,
      error: json.error ?? null,
      details: json.details ?? null,
      hint: json.hint ?? null,
      update_payload: json.update_payload ?? null,
      updated_claim: json.updated_claim ?? null,
    };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return {
        ok: false,
        claim_id: claimId,
        error: "Backend timeout",
      };
    }

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
  // PHASE 4 STEP 10B
  const claimWithSnakeCase = claim as Claim & { source_url?: string | null };
  const body = {
    claim_id: claim.id,
    title: claim.title,
    description: claim.description,
    source_url: claim.sourceUrl || claimWithSnakeCase.source_url || "",
    category: claim.category || "Other",
  };

  return postAiPrecheck(
    "/ai/precheck",
    body,
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
