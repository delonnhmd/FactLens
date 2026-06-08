// PHASE 4 STEP 1
// PHASE 4 STEP 2
// PHASE 4 STEP 3
// PHASE 4 STEP 6
// PHASE 4 STEP 7
// PHASE 4 STEP 9
// PHASE 4 STEP 10
// PHASE 4 STEP 10B
// PHASE 4 STEP 15
// PHASE 4 STEP 20
// PHASE 4 STEP 22
// PHASE 4 STEP 27
import { API_CONFIG } from "../constants/apiConfig";
import { supabase } from "../lib/supabase";
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
  // PHASE 4 STEP 22
  source_read_status?: string | null;
  source_page_title?: string | null;
  source_supports_claim?: boolean | null;
  source_support_summary?: string | null;
  evidence_used_count?: number | null;
  red_flags?: string[] | null;
  ai_summary?: string | null;
  ai_status?: string | null;
  error?: string | null;
  detail?: unknown;
  details?: string | null;
  hint?: string | null;
  updated_claim?: Record<string, unknown> | null;
}

const AI_PRECHECK_TIMEOUT_MS = 12000;

// PHASE 4 STEP 20
function isSourceQualityConstraintError(message: string): boolean {
  const normalizedMessage = message.toLowerCase();

  return (
    normalizedMessage.includes("claims_source_quality_check") ||
    (normalizedMessage.includes("source_quality") && normalizedMessage.includes("check constraint")) ||
    (normalizedMessage.includes("source_quality") && normalizedMessage.includes("violates"))
  );
}

function isRawBackendError(message: string): boolean {
  return /supabase|postgrest|schema|constraint|violates|traceback|exception|sql|column|relation|jwt|stack|http \d{3}/i.test(
    message,
  );
}

// PHASE 4 STEP 20
export function formatAiPrecheckErrorForDisplay(parts: Array<unknown>, fallback = "AI pre-check unavailable."): string {
  const message = parts
    .filter((part) => part !== null && part !== undefined && part !== "")
    .map((part) => (typeof part === "string" ? part : JSON.stringify(part)))
    .join(" ");

  if (isSourceQualityConstraintError(message)) {
    return "AI pre-check is unavailable right now.";
  }

  if (isRawBackendError(message)) {
    return fallback;
  }

  return message || fallback;
}

function getBackendErrorMessage(data: Partial<AiPrecheckResponse>, status: number): string {
  const detail =
    typeof data.detail === "string"
      ? data.detail
      : data.detail
        ? JSON.stringify(data.detail)
        : null;

  return formatAiPrecheckErrorForDisplay(
    [data.error, detail, data.details, data.hint],
    "AI pre-check is unavailable right now.",
  );
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
      error: "AI pre-check unavailable",
    };
  }

  const requestUrl = `${backendUrl}${path}`;
  console.log("[ai frontend] backend url:", API_CONFIG.BACKEND_URL);
  // PHASE 4 STEP 15
  console.log("[ai frontend] calling:", requestUrl);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), AI_PRECHECK_TIMEOUT_MS);

  try {
    // PHASE 4 STEP 27
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;
    const response = await fetch(requestUrl, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify(body),
    });
    const json = (await response.json().catch(() => ({}))) as Partial<AiPrecheckResponse>;

    // PHASE 4 STEP 15
    console.log("[ai frontend] response status:", response.status);

    if (!response.ok) {
      return {
        ok: false,
        claim_id: claimId,
        error: getBackendErrorMessage(json, response.status),
        details: null,
        hint: null,
      };
    }

    const responseError = formatAiPrecheckErrorForDisplay(
      [json.error, json.detail, json.details, json.hint],
      "",
    );
    const shouldHideDebugDetails = isSourceQualityConstraintError(
      [json.error, json.detail, json.details, json.hint].filter(Boolean).join(" "),
    );

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
      source_read_status: json.source_read_status ?? null,
      source_page_title: json.source_page_title ?? null,
      source_supports_claim: json.source_supports_claim ?? null,
      source_support_summary: json.source_support_summary ?? null,
      evidence_used_count: json.evidence_used_count ?? null,
      red_flags: json.red_flags ?? [],
      ai_summary: json.ai_summary ?? null,
      ai_status: json.ai_status ?? null,
      error: responseError || json.error || null,
      details: shouldHideDebugDetails ? null : json.details ?? null,
      hint: shouldHideDebugDetails ? null : json.hint ?? null,
      updated_claim: json.updated_claim ?? null,
    };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return {
        ok: false,
        claim_id: claimId,
        error: "AI request timed out.",
      };
    }

    return {
      ok: false,
      claim_id: claimId,
      error: "AI pre-check unavailable",
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
