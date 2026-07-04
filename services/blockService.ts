// APPLE GUIDELINE 1.2 — user blocking + EULA acceptance (NEW file)
// JS-only change. Deploy: eas update --channel preview
// Do NOT run eas build. Apple review response pending.
// Backend deploys to Render independently.
//
// Follows the existing backend-call pattern from services/accountService.ts
// (bearer token from the Supabase session, getBackendUrl from apiConfig).
import { getBackendUrl } from "../constants/apiConfig";
import { supabase } from "../lib/supabase";

interface BackendJson {
  ok?: boolean;
  blocked_ids?: string[];
  detail?: string;
  error?: string;
}

async function getAccessToken(): Promise<string | null> {
  const { data: sessionData } = await supabase.auth.getSession();
  return sessionData.session?.access_token ?? null;
}

export async function blockUserRequest(
  userId: string,
  sourceClaimId?: string | null,
): Promise<{ ok: boolean; error?: string }> {
  const backendUrl = getBackendUrl();

  if (!backendUrl) {
    return { ok: false, error: "Could not block this user right now." };
  }

  const accessToken = await getAccessToken();

  if (!accessToken) {
    return { ok: false, error: "Please log in to block users." };
  }

  try {
    const response = await fetch(`${backendUrl}/api/users/${encodeURIComponent(userId)}/block`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ source_claim_id: sourceClaimId ?? null }),
    });
    const json = (await response.json().catch(() => ({}))) as BackendJson;

    if (!response.ok || !json.ok) {
      return { ok: false, error: "Could not block this user right now." };
    }

    return { ok: true };
  } catch {
    return { ok: false, error: "Could not block this user right now." };
  }
}

export async function unblockUserRequest(userId: string): Promise<{ ok: boolean; error?: string }> {
  const backendUrl = getBackendUrl();

  if (!backendUrl) {
    return { ok: false, error: "Could not unblock this user right now." };
  }

  const accessToken = await getAccessToken();

  if (!accessToken) {
    return { ok: false, error: "Please log in to unblock users." };
  }

  try {
    const response = await fetch(`${backendUrl}/api/users/${encodeURIComponent(userId)}/block`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    const json = (await response.json().catch(() => ({}))) as BackendJson;

    if (!response.ok || !json.ok) {
      return { ok: false, error: "Could not unblock this user right now." };
    }

    return { ok: true };
  } catch {
    return { ok: false, error: "Could not unblock this user right now." };
  }
}

export async function fetchMyBlockedIds(): Promise<{ blockedIds: string[]; error?: string }> {
  const backendUrl = getBackendUrl();

  if (!backendUrl) {
    return { blockedIds: [], error: "Could not load blocked users right now." };
  }

  const accessToken = await getAccessToken();

  if (!accessToken) {
    return { blockedIds: [] };
  }

  try {
    const response = await fetch(`${backendUrl}/api/users/me/blocks`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    const json = (await response.json().catch(() => ({}))) as BackendJson;

    if (!response.ok || !Array.isArray(json.blocked_ids)) {
      return { blockedIds: [], error: "Could not load blocked users right now." };
    }

    return { blockedIds: json.blocked_ids.map((id) => String(id)) };
  } catch {
    return { blockedIds: [], error: "Could not load blocked users right now." };
  }
}

// Fire-and-forget EULA acceptance after successful signup/login.
// Failure is intentionally silent: acceptance is re-sent on every login
// with the checkbox checked, so a missed call self-heals.
export async function acceptTermsRequest(): Promise<void> {
  const backendUrl = getBackendUrl();

  if (!backendUrl) {
    return;
  }

  const accessToken = await getAccessToken();

  if (!accessToken) {
    // Signup with email confirmation has no session yet — the accept-terms
    // call fires on the first login instead.
    return;
  }

  try {
    await fetch(`${backendUrl}/api/users/me/accept-terms`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
  } catch {
    // fire-and-forget
  }
}

// Used by app/settings/blocked-users.tsx to render names next to ids.
// profiles are publicly readable (018/030 policies), so this reads directly
// through supabase-js like the other profile lookups in this codebase.
export interface BlockedProfileRow {
  id: string;
  username: string | null;
  display_name: string | null;
}

export async function fetchProfilesByIds(
  ids: string[],
): Promise<{ profiles: BlockedProfileRow[]; error?: string }> {
  if (ids.length === 0) {
    return { profiles: [] };
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("id, username, display_name")
    .in("id", ids);

  if (error) {
    return { profiles: [], error: "Could not load blocked users right now." };
  }

  return { profiles: (data ?? []) as BlockedProfileRow[] };
}
