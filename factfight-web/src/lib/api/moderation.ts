import "server-only";

import { z } from "zod";

import { RenderApiError, requestRenderJson } from "@/lib/api/render-client";
import type { AdminMetrics, ModerationDashboard, ModerationReport } from "@/lib/types/moderation";

const numberValue = z.preprocess((value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}, z.number());
const periodSchema = z.looseObject({ new_users: numberValue, claims_posted: numberValue, votes_cast: numberValue });
const metricsSchema = z.looseObject({
  ok: z.literal(true),
  today: periodSchema,
  week: periodSchema,
  totals: z.looseObject({ users: numberValue, claims: numberValue, votes: numberValue, pending_reports: numberValue }),
});
const identitySchema = z.looseObject({ email: z.email(), role: z.string().trim().min(1), active: z.literal(true) });
const nullableText = z.preprocess((value) => typeof value === "string" && value.trim() ? value.trim() : null, z.string().nullable());
const reportSchema = z.looseObject({
  id: z.uuid(),
  target_type: z.preprocess((value) => ["CLAIM", "EVIDENCE", "PROFILE"].includes(String(value)) ? value : "CLAIM", z.enum(["CLAIM", "EVIDENCE", "PROFILE"])),
  claim_id: nullableText,
  evidence_id: nullableText,
  profile_id: nullableText,
  reason: z.string().trim().min(1),
  note: nullableText,
  status: z.string().trim().min(1),
  created_at: nullableText,
  target: z.preprocess((value) => value && typeof value === "object" && !Array.isArray(value) ? value : null, z.record(z.string(), z.unknown()).nullable()),
});
const reportsSchema = z.looseObject({ ok: z.literal(true), reports: z.array(reportSchema) });
const actionSchema = z.looseObject({ ok: z.literal(true) });

function mapMetrics(data: z.infer<typeof metricsSchema>): AdminMetrics {
  return Object.freeze({
    today: Object.freeze({ newUsers: data.today.new_users, claimsPosted: data.today.claims_posted, votesCast: data.today.votes_cast }),
    week: Object.freeze({ newUsers: data.week.new_users, claimsPosted: data.week.claims_posted, votesCast: data.week.votes_cast }),
    totals: Object.freeze({ users: data.totals.users, claims: data.totals.claims, votes: data.totals.votes, pendingReports: data.totals.pending_reports }),
  });
}

function mapReport(row: z.infer<typeof reportSchema>): ModerationReport {
  return Object.freeze({ id: row.id, targetType: row.target_type, claimId: row.claim_id, evidenceId: row.evidence_id, profileId: row.profile_id, reason: row.reason, note: row.note, status: row.status, createdAt: row.created_at, target: row.target ? Object.freeze(row.target) : null });
}

export async function getModerationDashboard(accessToken: string): Promise<ModerationDashboard | null> {
  try {
    const identityPayload = await requestRenderJson("/admin/me", accessToken, { method: "GET" });
    const identity = identitySchema.safeParse(identityPayload);
    if (!identity.success) return null;

    const [metricsResult, reportsResult] = await Promise.allSettled([
      requestRenderJson("/admin/metrics", accessToken, { method: "GET" }),
      requestRenderJson("/admin/reports?status=OPEN&limit=50", accessToken, { method: "GET" }),
    ]);
    const metrics = metricsResult.status === "fulfilled" ? metricsSchema.safeParse(metricsResult.value) : null;
    const reports = reportsResult.status === "fulfilled" ? reportsSchema.safeParse(reportsResult.value) : null;

    return Object.freeze({
      identity: Object.freeze({ email: identity.data.email, role: identity.data.role }),
      metrics: metrics?.success ? mapMetrics(metrics.data) : null,
      reports: Object.freeze(reports?.success ? reports.data.reports.map(mapReport) : []),
      metricsWarning: metrics?.success ? undefined : "Admin metrics are temporarily unavailable.",
    });
  } catch (error) {
    if (error instanceof RenderApiError && (error.status === 401 || error.status === 403)) return null;
    throw error;
  }
}

export async function resolveReport(accessToken: string, reportId: string, input: { readonly status: "REVIEWING" | "RESOLVED" | "DISMISSED"; readonly hideTarget: boolean; readonly adminNote: string }): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const payload = await requestRenderJson(`/admin/reports/${reportId}/resolve`, accessToken, { method: "POST", body: JSON.stringify({ status: input.status, hide_target: input.hideTarget, admin_note: input.adminNote }) });
    return actionSchema.safeParse(payload).success ? { ok: true } : { ok: false, message: "The moderation response could not be verified." };
  } catch (error) {
    if (error instanceof RenderApiError && (error.status === 401 || error.status === 403)) return { ok: false, message: "Admin access required." };
    return { ok: false, message: "Could not update this report right now." };
  }
}
