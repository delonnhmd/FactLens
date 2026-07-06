import { getBackendUrl } from "../constants/apiConfig";
import { supabase } from "../lib/supabase";

export type AppealActionType = "claim_hidden" | "claim_removed" | "account_suspended";
export type AppealStatus = "pending" | "granted" | "denied";
export type AppealDecision = "granted" | "denied";

export interface ModerationAppeal {
  id: string;
  user_id: string;
  action_type: AppealActionType;
  claim_id: string | null;
  notification_id: string | null;
  appeal_text: string;
  status: AppealStatus;
  reviewed_by: string | null;
  review_note: string | null;
  created_at: string;
  reviewed_at: string | null;
  username?: string | null;
  display_name?: string | null;
  claim_title?: string | null;
  claim_is_hidden?: boolean | null;
}

export interface SubmitAppealInput {
  action_type: AppealActionType;
  claim_id?: string | null;
  notification_id?: string | null;
  appeal_text: string;
}

async function getAuthHeaders(): Promise<Record<string, string> | null> {
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

function readDetail(json: { detail?: unknown }, fallback: string): string {
  return typeof json.detail === "string" && json.detail.trim() ? json.detail.trim() : fallback;
}

export async function fetchMyAppeals(): Promise<{ appeals: ModerationAppeal[]; error?: string }> {
  const backendUrl = getBackendUrl();
  const headers = await getAuthHeaders();

  if (!backendUrl || !headers) {
    return { appeals: [], error: "Log in to load appeal status." };
  }

  try {
    const response = await fetch(`${backendUrl}/api/appeals/mine`, { headers });
    const json = (await response.json().catch(() => ({}))) as {
      ok?: boolean;
      appeals?: ModerationAppeal[];
      detail?: unknown;
    };

    if (!response.ok || !json.ok) {
      return { appeals: [], error: readDetail(json, "Could not load appeal status.") };
    }

    return { appeals: Array.isArray(json.appeals) ? json.appeals : [] };
  } catch {
    return { appeals: [], error: "Could not load appeal status." };
  }
}

export async function submitAppeal(input: SubmitAppealInput): Promise<{
  ok: boolean;
  appeal?: ModerationAppeal;
  error?: string;
}> {
  const backendUrl = getBackendUrl();
  const headers = await getAuthHeaders();

  if (!backendUrl || !headers) {
    return { ok: false, error: "Log in to submit an appeal." };
  }

  try {
    const response = await fetch(`${backendUrl}/api/appeals`, {
      method: "POST",
      headers,
      body: JSON.stringify(input),
    });
    const json = (await response.json().catch(() => ({}))) as {
      ok?: boolean;
      appeal?: ModerationAppeal;
      detail?: unknown;
    };

    if (!response.ok || !json.ok || !json.appeal) {
      return { ok: false, error: readDetail(json, "Could not submit this appeal.") };
    }

    return { ok: true, appeal: json.appeal };
  } catch {
    return { ok: false, error: "Could not submit this appeal." };
  }
}

export async function fetchAdminAppeals(
  status: AppealStatus | "all" = "all",
  limit = 100,
): Promise<{ appeals: ModerationAppeal[]; error?: string }> {
  const backendUrl = getBackendUrl();
  const headers = await getAuthHeaders();

  if (!backendUrl || !headers) {
    return { appeals: [], error: "Admin access required." };
  }

  try {
    const response = await fetch(
      `${backendUrl}/admin/appeals?status=${encodeURIComponent(status)}&limit=${Math.max(1, Math.min(limit, 200))}`,
      { headers },
    );
    const json = (await response.json().catch(() => ({}))) as {
      ok?: boolean;
      appeals?: ModerationAppeal[];
      detail?: unknown;
    };

    if (!response.ok || !json.ok) {
      return { appeals: [], error: readDetail(json, "Could not load appeals.") };
    }

    return { appeals: Array.isArray(json.appeals) ? json.appeals : [] };
  } catch {
    return { appeals: [], error: "Could not load appeals." };
  }
}

export async function resolveAdminAppeal(
  appealId: string,
  decision: AppealDecision,
  reviewNote: string,
): Promise<{ ok: boolean; error?: string }> {
  const backendUrl = getBackendUrl();
  const headers = await getAuthHeaders();

  if (!backendUrl || !headers) {
    return { ok: false, error: "Admin access required." };
  }

  try {
    const response = await fetch(`${backendUrl}/admin/appeals/${encodeURIComponent(appealId)}/resolve`, {
      method: "POST",
      headers,
      body: JSON.stringify({ decision, review_note: reviewNote }),
    });
    const json = (await response.json().catch(() => ({}))) as { ok?: boolean; detail?: unknown };

    if (!response.ok || !json.ok) {
      return { ok: false, error: readDetail(json, "Could not resolve appeal.") };
    }

    return { ok: true };
  } catch {
    return { ok: false, error: "Could not resolve appeal." };
  }
}
