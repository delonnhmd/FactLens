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

// HIDE/UNHIDE CLAIMS + ADMIN MANAGEMENT DASHBOARD (NEW, additive).
// hideClaim above (legacy /admin/content/hide) is untouched; these call the
// new endpoints that also remove the claim from feeds via RLS.

export interface ManagedUser {
  id: string;
  username: string | null;
  display_name: string | null;
  email: string | null;
  is_suspended: boolean;
  is_admin: boolean;
  created_at: string;
  blocked_by_count: number;
  claim_count: number;
}

export interface ManagedClaim {
  id: string;
  title: string | null;
  author_id: string | null;
  author_username: string | null;
  is_hidden: boolean;
  hidden: boolean | null;
  hidden_reason: string | null;
  hidden_at: string | null;
  votes_true: number | null;
  votes_fake: number | null;
  votes_unsure: number | null;
  created_at: string;
}

export function hideClaimFromFeeds(claimId: string, reason: string) {
  return postAdminAction(`/admin/claims/${encodeURIComponent(claimId)}/hide`, { reason });
}

export function unhideClaim(claimId: string) {
  return postAdminAction(`/admin/claims/${encodeURIComponent(claimId)}/unhide`, {});
}

export function unsuspendUser(userId: string) {
  return postAdminAction("/admin/users/suspend", {
    user_id: userId,
    reason: "",
    suspended: false,
  });
}

async function getAdminJson<T>(path: string): Promise<{ data: T | null; error?: string }> {
  const backendUrl = getBackendUrl();
  const headers = await getAdminHeaders();

  if (!backendUrl || !headers) {
    return { data: null, error: "Admin access required." };
  }

  try {
    const response = await fetch(`${backendUrl}${path}`, { headers });
    const json = (await response.json().catch(() => ({}))) as { ok?: boolean; detail?: string } & T;

    if (!response.ok || !json.ok) {
      return { data: null, error: json.detail || "Could not load admin data." };
    }

    return { data: json };
  } catch {
    return { data: null, error: "Could not load admin data." };
  }
}

export async function fetchManagedUsers(
  search: string,
  filter: "all" | "blocked" | "suspended",
): Promise<{ users: ManagedUser[]; error?: string }> {
  const result = await getAdminJson<{ users?: ManagedUser[] }>(
    `/admin/manage/users?search=${encodeURIComponent(search)}&filter=${encodeURIComponent(filter)}`,
  );

  if (result.error || !result.data) {
    return { users: [], error: result.error };
  }

  return { users: Array.isArray(result.data.users) ? result.data.users : [] };
}

export async function fetchManagedClaims(
  search: string,
  filter: "all" | "hidden" | "visible",
): Promise<{ claims: ManagedClaim[]; error?: string }> {
  const result = await getAdminJson<{ claims?: ManagedClaim[] }>(
    `/admin/manage/claims?search=${encodeURIComponent(search)}&filter=${encodeURIComponent(filter)}`,
  );

  if (result.error || !result.data) {
    return { claims: [], error: result.error };
  }

  return { claims: Array.isArray(result.data.claims) ? result.data.claims : [] };
}
