// PHASE 3 STEP 5
import { supabase } from "../lib/supabase";
import { getSourceQuality } from "./sourceQuality";
import type { Evidence, EvidenceType } from "../types/claim";

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

function validateEvidenceInput(input: EvidenceInput | EvidenceUpdates): string | null {
  const trimmedUrl = input.url?.trim();
  const trimmedNote = input.note?.trim();

  if (input.url !== undefined && !trimmedUrl) {
    return "Evidence URL is required.";
  }

  if (trimmedUrl && !/^https?:\/\//i.test(trimmedUrl)) {
    return "Evidence URL must start with http:// or https://.";
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
  const validationError = validateEvidenceInput(input);

  if (validationError) {
    return {
      evidence: null,
      error: validationError,
    };
  }

  const sourceQuality = getSourceQuality(input.url);

  const { data, error } = await supabase
    .from("evidence")
    .insert({
      claim_id: claimId,
      user_id: userId,
      evidence_type: input.type,
      url: input.url.trim(),
      note: input.note.trim(),
      source_quality_label: sourceQuality.label,
      source_quality_score: sourceQuality.score,
      source_quality_reason: sourceQuality.reason,
    })
    .select("*")
    .single();

  if (error) {
    return {
      evidence: null,
      error: getEvidenceErrorMessage(error.message, "save"),
    };
  }

  const countResult = await recalculateEvidenceCount(claimId);

  if (countResult.error) {
    return {
      evidence: mapEvidenceRowToEvidence(data as EvidenceRow),
      error: countResult.error,
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

  const sourceQuality = updates.url ? getSourceQuality(updates.url) : null;
  const updateRow = {
    ...(updates.url !== undefined ? { url: updates.url.trim() } : {}),
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
