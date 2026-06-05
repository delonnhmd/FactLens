// PHASE 3 STEP 5
// PHASE 3 STEP 28
// PHASE 4 STEP 14
// PHASE 4 STEP 14B
// PHASE 4 STEP 23
// PHASE 5 STEP 4
// PHASE 5 STEP 6
import { supabase } from "../lib/supabase";
import { getSourceQuality } from "./sourceQuality";
import { ensureProfileForUser } from "./profileService";
import type { Evidence, EvidenceType } from "../types/claim";
import { getDebugErrorParts } from "../utils/debugError";
import { normalizeUrl } from "../utils/url";
import { getDisplayRankTitle, parseBadgeList } from "../utils/reputation";
import { normalizeProfileVisibility } from "../utils/publicProfile";
import { uploadEvidenceImage, type PickedOptimizedImage } from "./imageUploadService";

const EVIDENCE_NOTE_MAX_LENGTH = 500;
const EVIDENCE_DOMAIN_PATTERN = /^(?:[a-z0-9-]+\.)+[a-z]{2,}$/i;

export interface EvidenceInput {
  url: string;
  note: string;
  type?: EvidenceType;
  imageAsset?: PickedOptimizedImage | null;
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
  // PHASE 5 STEP 6
  image_url?: string | null;
  image_path?: string | null;
  thumbnail_url?: string | null;
  source_quality_label: string | null;
  source_quality_score: number | null;
  source_quality_reason: string | null;
  // PHASE 5 STEP 3
  hidden?: boolean | null;
  hidden_reason?: string | null;
  hidden_at?: string | null;
  created_at: string;
  updated_at: string;
  profiles?: EvidenceProfileRow | EvidenceProfileRow[] | null;
}

interface EvidenceProfileRow {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url?: string | null;
  public_profile_slug?: string | null;
  profile_visibility?: string | null;
  trust_score?: number | null;
  rank_title?: string | null;
  highest_rank_achieved?: string | null;
  badge_list?: unknown;
  evidence_count?: number | null;
  is_deleted?: boolean | null;
  deleted_at?: string | null;
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
    return "Could not load evidence.";
  }

  if (action === "delete") {
    return "Could not delete evidence right now.";
  }

  return "Could not save evidence right now.";
}

// PHASE 4 STEP 14
function removeUndefinedValues<T extends Record<string, unknown>>(payload: T): T {
  return Object.fromEntries(
    Object.entries(payload).filter(([, value]) => value !== undefined),
  ) as T;
}

// PHASE 4 STEP 14
function formatSupabaseEvidenceError(error: { message?: unknown; code?: unknown; details?: unknown; hint?: unknown }): string {
  // PHASE 4 STEP 24
  console.log("[evidence] friendly error from Supabase:", getDebugErrorParts(error));
  return "Could not save evidence right now. Please check the source URL.";
}

// PHASE 4 STEP 14
function normalizeEvidenceType(type?: EvidenceType | string): EvidenceType {
  const normalizedType = type?.trim().toUpperCase().replace(/\s+/g, "_") || "ADDS_CONTEXT";

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

// PHASE 4 STEP 23
function sanitizeEvidenceNote(note: string): string {
  return note
    .replace(/[<>]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, EVIDENCE_NOTE_MAX_LENGTH);
}

// PHASE 4 STEP 23
function isValidEvidenceUrl(input: string): boolean {
  const normalizedUrl = normalizeUrl(input);

  if (!/^https?:\/\//i.test(normalizedUrl)) {
    return false;
  }

  try {
    const parsedUrl = new URL(normalizedUrl);
    const hostname = parsedUrl.hostname.replace(/^www\./i, "").toLowerCase();

    return (
      (parsedUrl.protocol === "http:" || parsedUrl.protocol === "https:") &&
      !parsedUrl.username &&
      !parsedUrl.password &&
      Boolean(hostname) &&
      EVIDENCE_DOMAIN_PATTERN.test(hostname)
    );
  } catch {
    return false;
  }
}

function validateEvidenceInput(input: EvidenceInput | EvidenceUpdates): string | null {
  const trimmedUrl = input.url?.trim();
  const trimmedNote = input.note?.replace(/\s+/g, " ").trim();

  if (input.url !== undefined && !trimmedUrl) {
    return "Evidence URL is required.";
  }

  if (trimmedUrl && !isValidEvidenceUrl(trimmedUrl)) {
    return "Please check the source URL.";
  }

  if (input.note !== undefined && !trimmedNote) {
    return "Evidence note is required.";
  }

  if (trimmedNote && trimmedNote.length < 10) {
    return "Short note must be at least 10 characters.";
  }

  if (trimmedNote && trimmedNote.length > EVIDENCE_NOTE_MAX_LENGTH) {
    return `Evidence note must be ${EVIDENCE_NOTE_MAX_LENGTH} characters or fewer.`;
  }

  return null;
}

function getEmbeddedProfile(row: EvidenceRow): EvidenceProfileRow | null {
  if (Array.isArray(row.profiles)) {
    return row.profiles[0] ?? null;
  }

  return row.profiles ?? null;
}

export function mapEvidenceRowToEvidence(row: EvidenceRow): Evidence {
  const profile = getEmbeddedProfile(row);
  const isDeleted = Boolean(profile?.is_deleted);
  const rankTitle = profile
    ? getDisplayRankTitle({
        trustScore: profile.trust_score ?? 50,
        rankTitle: profile.rank_title,
        highestRankAchieved: profile.highest_rank_achieved,
      })
    : null;

  return {
    id: row.id,
    userId: row.user_id,
    // PHASE 5 STEP 1
    contributorUsername: isDeleted ? "deleted_user" : profile?.username ?? null,
    contributorDisplayName: isDeleted ? "Deleted User" : profile?.display_name || profile?.username || null,
    contributorRankTitle: isDeleted ? null : rankTitle,
    contributorBadges: isDeleted ? [] : parseBadgeList(profile?.badge_list),
    // PHASE 5 STEP 1E
    contributorAvatarUrl: isDeleted ? null : profile?.avatar_url ?? null,
    contributorProfileSlug: isDeleted ? null : profile?.public_profile_slug ?? profile?.username ?? null,
    contributorProfileVisibility: isDeleted ? "private" : normalizeProfileVisibility(profile?.profile_visibility),
    contributorEvidenceCount: isDeleted || profile?.profile_visibility === "private" ? null : profile?.evidence_count ?? 0,
    url: row.url,
    note: row.note,
    type: row.evidence_type,
    createdAt: row.created_at,
    // PHASE 5 STEP 6
    imageUrl: row.image_url ?? null,
    imagePath: row.image_path ?? null,
    thumbnailUrl: row.thumbnail_url ?? row.image_url ?? null,
    // PHASE 5 STEP 3
    hidden: Boolean(row.hidden),
    hiddenReason: row.hidden_reason ?? null,
    hiddenAt: row.hidden_at ?? null,
    sourceQualityLabel: row.source_quality_label,
    sourceQualityScore: row.source_quality_score,
    sourceQualityReason: row.source_quality_reason,
  };
}

// PHASE 5 STEP 1
async function mergeEvidenceProfiles(rows: EvidenceRow[]): Promise<EvidenceRow[]> {
  const userIds = Array.from(new Set(rows.map((row) => row.user_id).filter(Boolean)));

  if (userIds.length === 0) {
    return rows;
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("id,username,display_name,avatar_url,public_profile_slug,profile_visibility,trust_score,rank_title,highest_rank_achieved,badge_list,evidence_count,is_deleted,deleted_at")
    .in("id", userIds);

  if (error) {
    console.log("[evidence] contributor profiles load failed:", {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });
    return rows;
  }

  const profilesById = new Map(((data ?? []) as EvidenceProfileRow[]).map((profile) => [profile.id, profile]));

  return rows.map((row) => ({
    ...row,
    profiles: profilesById.get(row.user_id) ?? null,
  }));
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

  const rowsWithProfiles = await mergeEvidenceProfiles((data ?? []) as EvidenceRow[]);

  return {
    evidence: rowsWithProfiles.map(mapEvidenceRowToEvidence),
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
  // PHASE 4 STEP 14B
  console.log("[evidence] claimId:", claimId);

  if (!claimId) {
    return {
      evidence: null,
      error: "Missing claim id.",
    };
  }

  const validationError = validateEvidenceInput(input);

  if (validationError) {
    return {
      evidence: null,
      error: validationError,
    };
  }

  // PHASE 4 STEP 14
  // PHASE 4 STEP 14B
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
  const sanitizedNote = sanitizeEvidenceNote(input.note);
  const payload = removeUndefinedValues({
    claim_id: claimId,
    user_id: user.id,
    evidence_type: normalizedEvidenceType,
    url: normalizedUrl,
    note: sanitizedNote,
    source_quality_label: sourceQuality.label || null,
    source_quality_score: sourceQuality.score ?? null,
    source_quality_reason: sourceQuality.reason ?? null,
  });

  console.log("[evidence] payload:", payload);

  const { data, error } = await supabase
    .from("evidence")
    .insert(payload)
    .select("*")
    .single();

  if (error) {
    console.log("[evidence] error:", error);
    console.log("[evidence] insert error:", error);
    return {
      evidence: null,
      error: formatSupabaseEvidenceError(error),
    };
  }

  console.log("[evidence] inserted:", data);

  // PHASE 5 STEP 6
  let evidenceRow = data as EvidenceRow;

  if (input.imageAsset && evidenceRow.id) {
    try {
      const uploadedImage = await uploadEvidenceImage(user.id, evidenceRow.id, input.imageAsset);
      const { data: updatedEvidence, error: imageUpdateError } = await supabase
        .from("evidence")
        .update({
          image_url: uploadedImage.imageUrl,
          image_path: uploadedImage.imagePath,
          thumbnail_url: uploadedImage.thumbnailUrl,
        })
        .eq("id", evidenceRow.id)
        .eq("user_id", user.id)
        .select("*")
        .single();

      if (imageUpdateError) {
        console.log("[evidence] image field update error:", imageUpdateError);
      } else {
        evidenceRow = updatedEvidence as EvidenceRow;
      }
    } catch (uploadError) {
      console.log("[evidence] image upload warning:", uploadError);
    }
  }

  const countResult = await recalculateEvidenceCount(claimId);

  if (countResult.error) {
    console.log("[evidence] count refresh warning:", countResult.error);
    return {
      evidence: mapEvidenceRowToEvidence(evidenceRow),
    };
  }

  return {
    evidence: mapEvidenceRowToEvidence(evidenceRow),
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
  const sanitizedNote = updates.note !== undefined ? sanitizeEvidenceNote(updates.note) : null;
  const updateRow = {
    ...(updates.url !== undefined ? { url: normalizedUrl } : {}),
    ...(updates.note !== undefined ? { note: sanitizedNote } : {}),
    ...(updates.type !== undefined ? { evidence_type: normalizeEvidenceType(updates.type) } : {}),
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
