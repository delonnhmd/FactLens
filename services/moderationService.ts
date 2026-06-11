// PHASE 5 STEP 3
import { getBackendUrl } from "../constants/apiConfig";
import { supabase } from "../lib/supabase";

export interface ModerationReport {
  id: string;
  target_type: "CLAIM" | "EVIDENCE" | "PROFILE";
  claim_id?: string | null;
  evidence_id?: string | null;
  profile_id?: string | null;
  reason: string;
  note?: string | null;
  status: string;
  created_at: string;
  target?: Record<string, unknown> | null;
}

async function getAdminHeaders(): Promise<Record<string, string> | null> {
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;

  if (!accessToken) {
    return null;
  }

  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${accessToken}`,
  };
}

export async function fetchModerationReports(
  status = "OPEN",
): Promise<{ reports: ModerationReport[]; error?: string }> {
  const backendUrl = getBackendUrl();
  const headers = await getAdminHeaders();

  if (!backendUrl || !headers) {
    return { reports: [], error: "Admin access required." };
  }

  try {
    const response = await fetch(`${backendUrl}/admin/reports?status=${encodeURIComponent(status)}&limit=50`, {
      headers,
    });
    const json = (await response.json().catch(() => ({}))) as {
      ok?: boolean;
      reports?: ModerationReport[];
      detail?: string;
    };

    if (!response.ok || !json.ok) {
      return { reports: [], error: json.detail || "Could not load moderation reports." };
    }

    return { reports: Array.isArray(json.reports) ? json.reports : [] };
  } catch {
    return { reports: [], error: "Could not load moderation reports." };
  }
}

export async function resolveModerationReport(
  reportId: string,
  options: { status?: string; hideTarget?: boolean; adminNote?: string } = {},
): Promise<{ ok: boolean; error?: string }> {
  const backendUrl = getBackendUrl();
  const headers = await getAdminHeaders();

  if (!backendUrl || !headers) {
    return { ok: false, error: "Admin access required." };
  }

  try {
    const response = await fetch(`${backendUrl}/admin/reports/${reportId}/resolve`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        status: options.status ?? "RESOLVED",
        hide_target: Boolean(options.hideTarget),
        admin_note: options.adminNote ?? "",
      }),
    });
    const json = (await response.json().catch(() => ({}))) as { ok?: boolean; detail?: string };

    if (!response.ok || !json.ok) {
      return { ok: false, error: json.detail || "Could not update report." };
    }

    return { ok: true };
  } catch {
    return { ok: false, error: "Could not update report." };
  }
}

export async function restoreModerationTarget(
  targetType: "CLAIM" | "EVIDENCE",
  targetId: string,
): Promise<{ ok: boolean; error?: string }> {
  const backendUrl = getBackendUrl();
  const headers = await getAdminHeaders();

  if (!backendUrl || !headers) {
    return { ok: false, error: "Admin access required." };
  }

  try {
    const response = await fetch(`${backendUrl}/admin/content/restore`, {
      method: "POST",
      headers,
      body: JSON.stringify({ target_type: targetType, target_id: targetId }),
    });
    const json = (await response.json().catch(() => ({}))) as { ok?: boolean; detail?: string };

    if (!response.ok || !json.ok) {
      return { ok: false, error: json.detail || "Could not restore content." };
    }

    return { ok: true };
  } catch {
    return { ok: false, error: "Could not restore content." };
  }
}

async function postAdminAction(path: string, body: Record<string, unknown>): Promise<{ ok: boolean; error?: string }> {
  const backendUrl = getBackendUrl();
  const headers = await getAdminHeaders();

  if (!backendUrl || !headers) {
    return { ok: false, error: "Admin access required." };
  }

  try {
    const response = await fetch(`${backendUrl}${path}`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
    const json = (await response.json().catch(() => ({}))) as { ok?: boolean; detail?: string };

    if (!response.ok || !json.ok) {
      return { ok: false, error: json.detail || "Could not complete admin action." };
    }

    return { ok: true };
  } catch {
    return { ok: false, error: "Could not complete admin action." };
  }
}

export function hideClaim(claimId: string, reason: string) {
  return postAdminAction("/admin/content/hide", {
    target_type: "CLAIM",
    target_id: claimId,
    reason,
  });
}

export function deleteClaimAsAdmin(claimId: string, reason: string) {
  return postAdminAction("/admin/claims/delete", {
    claim_id: claimId,
    reason,
  });
}

export function lockClaimVoting(claimId: string, reason: string) {
  return postAdminAction("/admin/claims/lock-voting", {
    claim_id: claimId,
    reason,
  });
}

export function markClaimFeatured(claimId: string, featured: boolean) {
  return postAdminAction("/admin/claims/feature", {
    claim_id: claimId,
    featured,
  });
}

export function suspendUser(userId: string, reason: string) {
  return postAdminAction("/admin/users/suspend", {
    user_id: userId,
    reason,
    suspended: true,
  });
}
