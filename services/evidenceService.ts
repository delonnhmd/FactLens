// PHASE 3 STEP 5
// PHASE 3 STEP 28
// PHASE 4 STEP 14
import { supabase } from "../lib/supabase";
import { getSourceQuality } from "./sourceQuality";
import { ensureProfileForUser } from "./profileService";
import type { Evidence, EvidenceType } from "../types/claim";
import { getDebugErrorParts } from "../utils/debugError";
import { isValidSourceUrl, normalizeUrl } from "../utils/url";

export interface EvidenceInput {
  url: string;
  note: string;
  type: EvidenceType;
}

export interface EvidenceUpdates {
  url?: string;
  note?: string;
  type?: EvidenceType;
}

export interface EvidenceRow {
  id: string;
  claim_id: string;
  user_id: string;
  evidence_type: EvidenceType;
  url: string;
  note: string;
  source_quality_label: string | null;
  source_quality_score: number | null;
  source_quality_reason: string | null;
  created_at: string;
  updated_at: string;
}

interface EvidenceListResult {
  evidence: Evidence[];
  error?: string;
}

interface EvidenceResult {
  evidence: Evidence | null;
  evidenceCount?: number;
  error?: string;
}

interface EvidenceCountResult {
  evidenceCount: number;
  error?: string;
}

function getEvidenceErrorMessage(message: string, action: "load" | "save" | "delete" = "save"): string {
  const normalizedMessage = message.toLowerCase();

  if (normalizedMessage.includes("row-level security")) {
    return action === "load"
      ? "You are not allowed to load evidence for this claim."
      : "You are not allowed to save evidence for this claim.";
  }

  if (action === "load") {
    return "We could not load evidence right now. Please try again.";
  }

  if (action === "delete") {
    return "We could not delete this evidence. Please try again.";
  }

  return "We could not save this evidence. Please try again.";
}

// PHASE 4 STEP 14
function removeUndefinedValues<T extends Record<string, unknown>>(payload: T): T {
  return Object.fromEntries(
    Object.entries(payload).filter(([, value]) => value !== undefined),
  ) as T;
}

// PHASE 4 STEP 14
function formatSupabaseEvidenceError(error: { message?: unknown; code?: unknown; details?: unknown; hint?: unknown }): string {
  const parts = getDebugErrorParts(error);

  return [
    `We could not save this evidence: ${parts.message}`,
    parts.code ? `Code: ${parts.code}` : "",
    parts.details ? `Details: ${parts.details}` : "",
    parts.hint ? `Hint: ${parts.hint}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

// PHASE 4 STEP 14
function normalizeEvidenceType(type: EvidenceType | string): EvidenceType {
  const normalizedType = type.trim().toUpperCase().replace(/\s+/g, "_");

  if (normalizedType === "SUPPORTS_TRUE" || normalizedType === "TRUE") {
    return "SUPPORTS_TRUE";
  }

  if (normalizedType === "SUPPORTS_FAKE" || normalizedType === "FAKE") {
    return "SUPPORTS_FAKE";
  }

  if (normalizedType === "ADDS_CONTEXT" || normalizedType === "CONTEXT" || normalizedType === "ADDS") {
    return "ADDS_CONTEXT";
  }

  return "UNCLEAR";
}

function validateEvidenceInput(input: EvidenceInput | EvidenceUpdates): string | null {
  const trimmedUrl = input.url?.trim();
  const trimmedNote = input.note?.trim();

  if (input.url !== undefined && !trimmedUrl) {
    return "Evidence URL is required.";
  }

  if (trimmedUrl && !isValidSourceUrl(trimmedUrl)) {
    return "Enter a valid evidence URL.";
  }

  if (input.note !== undefined && !trimmedNote) {
    return "Short note is required.";
  }

  if (trimmedNote && trimmedNote.length < 10) {
    return "Short note must be at least 10 characters.";
  }

  return null;
}

export function mapEvidenceRowToEvidence(row: EvidenceRow): Evidence {
  return {
    id: row.id,
    userId: row.user_id,
    url: row.url,
    note: row.note,
    type: row.evidence_type,
    createdAt: row.created_at,
    sourceQualityLabel: row.source_quality_label,
    sourceQualityScore: row.source_quality_score,
    sourceQualityReason: row.source_quality_reason,
  };
}

export async function fetchEvidenceForClaim(claimId: string): Promise<EvidenceListResult> {
  const { data, error } = await supabase
    .from("evidence")
    .select("*")
    .eq("claim_id", claimId)
    .order("created_at", { ascending: false });

  if (error) {
    return {
      evidence: [],
      error: getEvidenceErrorMessage(error.message, "load"),
    };
  }

  return {
    evidence: ((data ?? []) as EvidenceRow[]).map(mapEvidenceRowToEvidence),
  };
}

export async function recalculateEvidenceCount(claimId: string): Promise<EvidenceCountResult> {
  const { error } = await supabase.rpc("recalculate_claim_evidence_count", {
    target_claim_id: claimId,
  });

  if (error) {
    return {
      evidenceCount: 0,
      error: getEvidenceErrorMessage(error.message, "save"),
    };
  }

  const { data, error: claimError } = await supabase
    .from("claims")
    .select("evidence_count")
    .eq("id", claimId)
    .maybeSingle();

  if (claimError) {
    return {
      evidenceCount: 0,
      error: getEvidenceErrorMessage(claimError.message, "load"),
    };
  }

  return {
    evidenceCount: Number(data?.evidence_count ?? 0),
  };
}

export async function addEvidence(
  claimId: string,
  userId: string,
  input: EvidenceInput,
): Promise<EvidenceResult> {
  void userId;
  const validationError = validateEvidenceInput(input);

  if (validationError) {
    return {
      evidence: null,
      error: validationError,
    };
  }

  // PHASE 4 STEP 14
  const { data: userData, error: userError } = await supabase.auth.getUser();
  const user = userData?.user;

  if (userError || !user) {
    console.log("[evidence] auth user error:", userError);
    return {
      evidence: null,
      error: "Please log in to add evidence.",
    };
  }

  console.log("[evidence] auth user id:", user.id);

  const profileResult = await ensureProfileForUser(user);

  if (profileResult.error || !profileResult.profile) {
    return {
      evidence: null,
      error: profileResult.error ?? "Profile required to add evidence.",
    };
  }

  const normalizedUrl = normalizeUrl(input.url);
  const normalizedEvidenceType = normalizeEvidenceType(input.type);
  const sourceQuality = getSourceQuality(normalizedUrl);
  const payload = removeUndefinedValues({
    claim_id: claimId,
    user_id: user.id,
    url: normalizedUrl,
    note: input.note.trim(),
    evidence_type: normalizedEvidenceType,
    source_quality_label: sourceQuality.label || null,
    source_quality_score: sourceQuality.score ?? null,
  });

  console.log("[evidence] payload:", payload);

  const { data, error } = await supabase
    .from("evidence")
    .insert(payload)
    .select("*")
    .single();

  if (error) {
    console.log("[evidence] error:", error);
    return {
      evidence: null,
      error: formatSupabaseEvidenceError(error),
    };
  }

  const countResult = await recalculateEvidenceCount(claimId);

  if (countResult.error) {
    console.log("[evidence] count refresh warning:", countResult.error);
    return {
      evidence: mapEvidenceRowToEvidence(data as EvidenceRow),
    };
  }

  return {
    evidence: mapEvidenceRowToEvidence(data as EvidenceRow),
    evidenceCount: countResult.evidenceCount,
  };
}

export async function updateEvidence(
  evidenceId: string,
  userId: string,
  updates: EvidenceUpdates,
): Promise<EvidenceResult> {
  const validationError = validateEvidenceInput(updates);

  if (validationError) {
    return {
      evidence: null,
      error: validationError,
    };
  }

  const normalizedUrl = updates.url ? normalizeUrl(updates.url) : null;
  const sourceQuality = normalizedUrl ? getSourceQuality(normalizedUrl) : null;
  const updateRow = {
    ...(updates.url !== undefined ? { url: normalizedUrl } : {}),
    ...(updates.note !== undefined ? { note: updates.note.trim() } : {}),
    ...(updates.type !== undefined ? { evidence_type: updates.type } : {}),
    ...(sourceQuality
      ? {
          source_quality_label: sourceQuality.label,
          source_quality_score: sourceQuality.score,
          source_quality_reason: sourceQuality.reason,
        }
      : {}),
  };

  const { data, error } = await supabase
    .from("evidence")
    .update(updateRow)
    .eq("id", evidenceId)
    .eq("user_id", userId)
    .select("*")
    .single();

  if (error) {
    return {
      evidence: null,
      error: getEvidenceErrorMessage(error.message, "save"),
    };
  }

  const evidenceRow = data as EvidenceRow;
  const countResult = await recalculateEvidenceCount(evidenceRow.claim_id);

  return {
    evidence: mapEvidenceRowToEvidence(evidenceRow),
    evidenceCount: countResult.evidenceCount,
    error: countResult.error,
  };
}

export async function deleteEvidence(evidenceId: string, userId: string): Promise<EvidenceCountResult> {
  const { data: existingData, error: loadError } = await supabase
    .from("evidence")
    .select("claim_id")
    .eq("id", evidenceId)
    .eq("user_id", userId)
    .maybeSingle();

  if (loadError) {
    return {
      evidenceCount: 0,
      error: getEvidenceErrorMessage(loadError.message, "load"),
    };
  }

  const claimId = existingData?.claim_id;

  if (!claimId) {
    return {
      evidenceCount: 0,
      error: "Evidence not found.",
    };
  }

  const { error } = await supabase.from("evidence").delete().eq("id", evidenceId).eq("user_id", userId);

  if (error) {
    return {
      evidenceCount: 0,
      error: getEvidenceErrorMessage(error.message, "delete"),
    };
  }

  return recalculateEvidenceCount(claimId);
}
