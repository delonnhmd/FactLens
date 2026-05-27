// PHASE 3 STEP 6
import { supabase } from "../lib/supabase";
import { fetchClaimById } from "./claimService";
import type { Claim, Report, ReportReason } from "../types/claim";

export type ReportDbReason =
  | "SPAM"
  | "FAKE_SOURCE"
  | "DUPLICATE_CLAIM"
  | "HARMFUL_CONTENT"
  | "MISLEADING_TITLE"
  | "HARASSMENT_OR_ABUSE"
  | "OTHER";

export interface ReportRow {
  id: string;
  claim_id: string;
  user_id: string;
  reason: ReportDbReason;
  note: string | null;
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

const appToDbReason: Record<ReportReason, ReportDbReason> = {
  Spam: "SPAM",
  "Fake source": "FAKE_SOURCE",
  "Duplicate claim": "DUPLICATE_CLAIM",
  "Harmful content": "HARMFUL_CONTENT",
  "Misleading title": "MISLEADING_TITLE",
  "Harassment or abuse": "HARASSMENT_OR_ABUSE",
  Other: "OTHER",
};

const dbToAppReason: Record<ReportDbReason, ReportReason> = {
  SPAM: "Spam",
  FAKE_SOURCE: "Fake source",
  DUPLICATE_CLAIM: "Duplicate claim",
  HARMFUL_CONTENT: "Harmful content",
  MISLEADING_TITLE: "Misleading title",
  HARASSMENT_OR_ABUSE: "Harassment or abuse",
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
    return "We could not load reports right now. Please try again.";
  }

  if (action === "delete") {
    return "We could not delete this report. Please try again.";
  }

  return "We could not save this report. Please try again.";
}

function mapReportRowToReport(row: ReportRow): Report {
  return {
    id: row.id,
    claimId: row.claim_id,
    userId: row.user_id,
    reason: dbToAppReason[row.reason] ?? "Other",
    note: row.note ?? "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function fetchReportRowForClaim(
  claimId: string,
  userId: string,
): Promise<{ report: ReportRow | null; error?: string }> {
  const { data, error } = await supabase
    .from("reports")
    .select("*")
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
      error: result.error ?? "We could not refresh this claim after reporting.",
    };
  }

  return {
    claim: result.claim,
  };
}

export async function reportClaim(
  claimId: string,
  userId: string,
  reason: ReportReason,
  note = "",
): Promise<ClaimReportResult> {
  const existingReport = await fetchReportRowForClaim(claimId, userId);

  if (existingReport.error) {
    return {
      claim: null,
      report: null,
      error: existingReport.error,
    };
  }

  const reportRow = {
    reason: appToDbReason[reason],
    note: note.trim() || null,
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
          claim_id: claimId,
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
