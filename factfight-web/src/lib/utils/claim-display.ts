import type { AiStatus, ClaimStatus, ClaimType } from "../types/claim";

const statusLabels: Record<ClaimStatus, string> = {
  PENDING: "Pending",
  ACTIVE: "Active",
  EARLY_VERDICT: "Early verdict",
  FINALIZED_TRUE: "Finalized true",
  FINALIZED_FAKE: "Finalized fake",
  INSUFFICIENT_DATA: "Insufficient data",
  // 24H MODEL: closed-but-unpublished claims are just waiting on the server
  // sweep (runs every ~10 min) — never a dead "Locked" state.
  LOCKED: "Finalizing verdict",
  OPEN: "Open",
  VOTING_CLOSED: "Finalizing verdict",
  COMMUNITY_TRUE: "Community says true",
  COMMUNITY_FAKE: "Community says fake",
  NEEDS_MORE_EVIDENCE: "Needs more evidence",
};

const claimTypeLabels: Record<ClaimType, string> = {
  FACTUAL: "Factual claim",
  OPINION: "Opinion",
  SATIRE: "Satire",
  QUESTION: "Question",
  PROMOTION: "Promotion",
  UNCLEAR: "Unclear",
};

const aiSignalLabels: Record<AiStatus, string> = {
  PENDING: "Pending review",
  LOW_RISK: "Lower risk signal",
  MEDIUM_RISK: "Moderate risk signal",
  HIGH_RISK: "Higher risk signal",
  LIKELY_TRUE: "Fewer risk indicators found",
  LIKELY_FAKE: "Stronger risk indicators found",
  NEEDS_MORE_EVIDENCE: "More evidence suggested",
  NOT_FACT_CHECKABLE: "May not be fact-checkable",
  ERROR: "Signal unavailable",
};

export function getClaimStatusLabel(status: ClaimStatus | null): string {
  return status ? statusLabels[status] : "Status unavailable";
}

export function getClaimTypeLabel(type: ClaimType | null): string {
  return type ? claimTypeLabels[type] : "Type unavailable";
}

export function getAiRiskSignalLabel(status: AiStatus | null): string {
  return status ? aiSignalLabels[status] : "Signal unavailable";
}

export type SourceQualityTone = "positive" | "neutral" | "caution" | "danger";

export interface SourceQualityDisplay {
  readonly label: string;
  readonly tone: SourceQualityTone;
}

export function getSourceQualityDisplay(
  quality: string | null,
  score: number | null,
): SourceQualityDisplay {
  const normalized = quality?.trim().toLowerCase() ?? "";

  if (["highly trusted", "official", "mainstream"].includes(normalized) || (score ?? -1) >= 90) {
    return { label: "Highly trusted", tone: "positive" };
  }

  if (["trusted", "specialized", "blog"].includes(normalized) || (score ?? -1) >= 75) {
    return { label: "Trusted", tone: "neutral" };
  }

  if (normalized === "moderate" || (score ?? -1) >= 60) {
    return { label: "Moderate credibility", tone: "caution" };
  }

  if (["low trust", "invalid url"].includes(normalized) || (score !== null && score < 40)) {
    return { label: "Low trust", tone: "danger" };
  }

  if (["use caution", "social", "unknown"].includes(normalized) || score !== null) {
    return { label: "Use caution", tone: "caution" };
  }

  return { label: "Source not yet rated", tone: "neutral" };
}
