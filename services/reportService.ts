// PHASE 3 STEP 6
import { supabase } from "../lib/supabase";
import { getBackendUrl } from "../constants/apiConfig";
import { fetchClaimById } from "./claimService";
import type { Claim, Report, ReportReason } from "../types/claim";

// SINGLE WRITE PATH (step 3): route claim reports through POST
// /api/claims/{id}/report so the server (auth, reason enum, note cap, suspension,
// one-per-user dedup, per-day limit) is the single enforcement point. Flip to
// false for an instant rollback to the direct supabase-js upsert below.
const USE_API_REPORT = true;

export type ReportDbReason =
  | "SPAM"
  | "FAKE_SOURCE"
  | "DUPLICATE_CLAIM"
  | "HARMFUL_CONTENT"
  | "MISLEADING_TITLE"
  | "HARASSMENT_OR_ABUSE"
  // PHASE 5 STEP 2
  | "MISINFORMATION_ABUSE"
  | "EXPLICIT_CONTENT"
  | "MALICIOUS_EVIDENCE"
  | "OTHER";

export type ReportTargetType = "CLAIM" | "EVIDENCE" | "PROFILE";

export interface ReportRow {
  id: string;
  claim_id: string | null;
  // PHASE 5 STEP 2
  target_type?: ReportTargetType | null;
  evidence_id?: string | null;
  profile_id?: string | null;
  user_id: string;
  reason: ReportDbReason;
  note: string | null;
  status?: "OPEN" | "REVIEWING" | "RESOLVED" | "DISMISSED" | null;
  created_at: string;
  updated_at: string;
}

interface ReportsResult {
  reports: Report[];
  error?: string;
}

interface UserReportResult {
  report: Report | null;
  error?: string;
}

interface ClaimReportResult {
  claim: Claim | null;
  report?: Report | null;
  error?: string;
}

const MAX_REPORTS_PER_DAY = 20;

const appToDbReason: Record<ReportReason, ReportDbReason> = {
  Spam: "SPAM",
  "Fake source": "FAKE_SOURCE",
  "Duplicate claim": "DUPLICATE_CLAIM",
  "Harmful content": "HARMFUL_CONTENT",
  "Misleading title": "MISLEADING_TITLE",
  "Harassment or abuse": "HARASSMENT_OR_ABUSE",
  "Misinformation abuse": "MISINFORMATION_ABUSE",
  "Explicit content": "EXPLICIT_CONTENT",
  "Malicious evidence": "MALICIOUS_EVIDENCE",
  Other: "OTHER",
};

const dbToAppReason: Record<ReportDbReason, ReportReason> = {
  SPAM: "Spam",
  FAKE_SOURCE: "Fake source",
  DUPLICATE_CLAIM: "Duplicate claim",
  HARMFUL_CONTENT: "Harmful content",
  MISLEADING_TITLE: "Misleading title",
  HARASSMENT_OR_ABUSE: "Harassment or abuse",
  MISINFORMATION_ABUSE: "Misinformation abuse",
  EXPLICIT_CONTENT: "Explicit content",
  MALICIOUS_EVIDENCE: "Malicious evidence",
  OTHER: "Other",
};

function getReportErrorMessage(message: string, action: "load" | "save" | "delete" = "save"): string {
  const normalizedMessage = message.toLowerCase();

  if (normalizedMessage.includes("row-level security")) {
    return action === "load"
      ? "You are not allowed to load reports for this claim."
      : "You are not allowed to report this claim.";
  }

  if (action === "load") {
    return "Could not load reports right now.";
  }

  if (action === "delete") {
    return "Could not delete report right now.";
  }

  return "Could not submit report right now.";
}

function mapReportRowToReport(row: ReportRow): Report {
  return {
    id: row.id,
    claimId: row.claim_id,
    targetType: row.target_type ?? "CLAIM",
    evidenceId: row.evidence_id ?? null,
    profileId: row.profile_id ?? null,
    userId: row.user_id,
    reason: dbToAppReason[row.reason] ?? "Other",
    note: row.note ?? "",
    status: row.status ?? "OPEN",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// PHASE 5 STEP 3
async function checkReportRateLimit(userId: string): Promise<string | null> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count, error } = await supabase
    .from("reports")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", since);

  if (error) {
    return getReportErrorMessage(error.message, "save");
  }

  if ((count ?? 0) >= MAX_REPORTS_PER_DAY) {
    return "Too many reports today. Please try again later.";
  }

  return null;
}

async function fetchReportRowForClaim(
  claimId: string,
  userId: string,
): Promise<{ report: ReportRow | null; error?: string }> {
  const { data, error } = await supabase
    .from("reports")
    .select("*")
    .eq("target_type", "CLAIM")
    .eq("claim_id", claimId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    return {
      report: null,
      error: getReportErrorMessage(error.message, "load"),
    };
  }

  return {
    report: (data as ReportRow | null) ?? null,
  };
}

// PHASE 5 STEP 2
async function fetchReportRowForTarget(
  targetType: ReportTargetType,
  targetId: string,
  userId: string,
): Promise<{ report: ReportRow | null; error?: string }> {
  const targetColumn =
    targetType === "CLAIM" ? "claim_id" : targetType === "EVIDENCE" ? "evidence_id" : "profile_id";
  const { data, error } = await supabase
    .from("reports")
    .select("*")
    .eq("target_type", targetType)
    .eq(targetColumn, targetId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    return {
      report: null,
      error: getReportErrorMessage(error.message, "load"),
    };
  }

  return {
    report: (data as ReportRow | null) ?? null,
  };
}

export async function fetchReportsForClaim(claimId: string): Promise<ReportsResult> {
  const { data, error } = await supabase
    .from("reports")
    .select("*")
    .eq("claim_id", claimId)
    .order("created_at", { ascending: false });

  if (error) {
    return {
      reports: [],
      error: getReportErrorMessage(error.message, "load"),
    };
  }

  return {
    reports: ((data ?? []) as ReportRow[]).map(mapReportRowToReport),
  };
}

export async function fetchUserReportForClaim(claimId: string, userId: string): Promise<UserReportResult> {
  const result = await fetchReportRowForClaim(claimId, userId);

  if (result.error) {
    return {
      report: null,
      error: result.error,
    };
  }

  return {
    report: result.report ? mapReportRowToReport(result.report) : null,
  };
}

export async function recalculateReportCount(claimId: string): Promise<ClaimReportResult> {
  const { error } = await supabase.rpc("recalculate_claim_report_count", {
    target_claim_id: claimId,
  });

  if (error) {
    return {
      claim: null,
      error: getReportErrorMessage(error.message, "save"),
    };
  }

  const result = await fetchClaimById(claimId);

  if (result.error || !result.claim) {
    return {
      claim: null,
      error: result.error ?? "Could not refresh this claim after reporting.",
    };
  }

  return {
    claim: result.claim,
  };
}

// SINGLE WRITE PATH (step 3): submit the report via the server endpoint. The
// endpoint is the authoritative gate; on success we refetch the claim so the
// returned shape matches the direct path. Network failures surface a retry
// error — we never fall back to a direct insert (that would bypass enforcement).
export async function reportClaimViaApi(
  claimId: string,
  userId: string,
  reason: ReportReason,
  note = "",
): Promise<ClaimReportResult> {
  void userId;
  const backendUrl = getBackendUrl();

  if (!backendUrl) {
    return { claim: null, report: null, error: "Verifact is temporarily unavailable. Please try again." };
  }

  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;

  if (!accessToken) {
    return { claim: null, report: null, error: "Please log in to report." };
  }

  let response: Response;
  let data: Record<string, unknown> = {};

  try {
    response = await fetch(`${backendUrl}/api/claims/${encodeURIComponent(claimId)}/report`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ reason: appToDbReason[reason], note }),
    });

    try {
      data = (await response.json()) as Record<string, unknown>;
    } catch {
      data = {};
    }
  } catch (error) {
    console.log("[report api] network error:", error);
    return { claim: null, report: null, error: "Unable to reach Verifact. Check your connection and try again." };
  }

  if (!response.ok) {
    const detail = typeof data.detail === "string" ? data.detail : "";

    if (response.status === 409 && data.already_reported === true) {
      return {
        claim: null,
        report: null,
        error: typeof data.message === "string" ? data.message : "You already reported this claim.",
      };
    }

    if (response.status === 401) {
      return { claim: null, report: null, error: "Please log in to report." };
    }

    if (response.status === 403) {
      return { claim: null, report: null, error: detail || "This account cannot report right now." };
    }

    if (response.status === 404) {
      return { claim: null, report: null, error: detail || "This claim is no longer available." };
    }

    if (response.status === 422) {
      return { claim: null, report: null, error: detail || "Please check the report details and try again." };
    }

    if (response.status === 429) {
      return { claim: null, report: null, error: detail || "Too many reports today. Please try again later." };
    }

    return { claim: null, report: null, error: detail || "Could not submit report right now." };
  }

  const reportRow = (data.report as ReportRow | undefined) ?? null;
  const report = reportRow ? mapReportRowToReport(reportRow) : null;
  const updatedClaim = await fetchClaimById(claimId);

  return { claim: updatedClaim.claim ?? null, report };
}

export async function reportClaim(
  claimId: string,
  userId: string,
  reason: ReportReason,
  note = "",
): Promise<ClaimReportResult> {
  // SINGLE WRITE PATH (step 3): flag on → server endpoint; flag off → the
  // untouched direct-upsert path below (instant rollback).
  if (USE_API_REPORT) {
    return reportClaimViaApi(claimId, userId, reason, note);
  }

  const existingReport = await fetchReportRowForClaim(claimId, userId);

  if (existingReport.error) {
    return {
      claim: null,
      report: null,
      error: existingReport.error,
    };
  }

  if (!existingReport.report) {
    const rateLimitError = await checkReportRateLimit(userId);
    if (rateLimitError) {
      return { claim: null, report: null, error: rateLimitError };
    }
  }

  const reportRow = {
    target_type: "CLAIM",
    claim_id: claimId,
    evidence_id: null,
    profile_id: null,
    reason: appToDbReason[reason],
    note: note.trim() || null,
    status: "OPEN",
  };

  const request = existingReport.report
    ? supabase
        .from("reports")
        .update(reportRow)
        .eq("claim_id", claimId)
        .eq("user_id", userId)
        .select("*")
        .single()
    : supabase
        .from("reports")
        .insert({
          user_id: userId,
          ...reportRow,
        })
        .select("*")
        .single();

  const { data, error } = await request;

  if (error) {
    return {
      claim: null,
      report: null,
      error: getReportErrorMessage(error.message, "save"),
    };
  }

  const updatedClaim = await recalculateReportCount(claimId);

  if (updatedClaim.error || !updatedClaim.claim) {
    return {
      claim: null,
      report: mapReportRowToReport(data as ReportRow),
      error: updatedClaim.error,
    };
  }

  return {
    claim: updatedClaim.claim,
    report: mapReportRowToReport(data as ReportRow),
  };
}

// PHASE 5 STEP 2
export async function reportEvidence(
  evidenceId: string,
  userId: string,
  reason: ReportReason,
  note = "",
): Promise<UserReportResult> {
  const existingReport = await fetchReportRowForTarget("EVIDENCE", evidenceId, userId);

  if (existingReport.error) {
    return { report: null, error: existingReport.error };
  }

  if (!existingReport.report) {
    const rateLimitError = await checkReportRateLimit(userId);
    if (rateLimitError) {
      return { report: null, error: rateLimitError };
    }
  }

  const reportRow = {
    target_type: "EVIDENCE",
    claim_id: null,
    evidence_id: evidenceId,
    profile_id: null,
    reason: appToDbReason[reason],
    note: note.trim() || null,
    status: "OPEN",
  };

  const request = existingReport.report
    ? supabase.from("reports").update(reportRow).eq("id", existingReport.report.id).select("*").single()
    : supabase.from("reports").insert({ user_id: userId, ...reportRow }).select("*").single();

  const { data, error } = await request;

  if (error) {
    return { report: null, error: getReportErrorMessage(error.message, "save") };
  }

  return { report: mapReportRowToReport(data as ReportRow) };
}

// PHASE 5 STEP 2
export async function reportProfile(
  profileId: string,
  userId: string,
  reason: ReportReason,
  note = "",
): Promise<UserReportResult> {
  const existingReport = await fetchReportRowForTarget("PROFILE", profileId, userId);

  if (existingReport.error) {
    return { report: null, error: existingReport.error };
  }

  if (!existingReport.report) {
    const rateLimitError = await checkReportRateLimit(userId);
    if (rateLimitError) {
      return { report: null, error: rateLimitError };
    }
  }

  const reportRow = {
    target_type: "PROFILE",
    claim_id: null,
    evidence_id: null,
    profile_id: profileId,
    reason: appToDbReason[reason],
    note: note.trim() || null,
    status: "OPEN",
  };

  const request = existingReport.report
    ? supabase.from("reports").update(reportRow).eq("id", existingReport.report.id).select("*").single()
    : supabase.from("reports").insert({ user_id: userId, ...reportRow }).select("*").single();

  const { data, error } = await request;

  if (error) {
    return { report: null, error: getReportErrorMessage(error.message, "save") };
  }

  return { report: mapReportRowToReport(data as ReportRow) };
}

export async function deleteReport(claimId: string, userId: string): Promise<ClaimReportResult> {
  const { error } = await supabase.from("reports").delete().eq("claim_id", claimId).eq("user_id", userId);

  if (error) {
    return {
      claim: null,
      error: getReportErrorMessage(error.message, "delete"),
    };
  }

  return recalculateReportCount(claimId);
}
