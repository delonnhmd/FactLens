// PHASE 5 STEP 1D
import { getBackendUrl } from "../constants/apiConfig";
import { supabase } from "../lib/supabase";

export interface ReputationEvent {
  event_type: string;
  points_delta: number;
  trust_delta: number;
  badge_unlocked: string | null;
  rank_before: string | null;
  rank_after: string | null;
  reason: string | null;
  created_at: string;
  claim_id: string | null;
}

export interface ReputationEventsResult {
  events: ReputationEvent[];
  error?: string;
}

export async function fetchReputationEvents(limit = 50): Promise<ReputationEventsResult> {
  const backendUrl = getBackendUrl();

  if (!backendUrl) {
    return { events: [], error: "Could not load reputation activity." };
  }

  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;

  if (!accessToken) {
    return { events: [], error: "Please log in to view reputation activity." };
  }

  try {
    const response = await fetch(`${backendUrl}/profile/reputation-events?limit=${Math.max(1, Math.min(50, limit))}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    const json = (await response.json().catch(() => ({}))) as {
      ok?: boolean;
      events?: ReputationEvent[];
      detail?: unknown;
      error?: string;
    };

    if (!response.ok || !json.ok) {
      const detail = typeof json.detail === "string" ? json.detail : null;
      return {
        events: [],
        error: json.error || detail || "Could not load reputation activity.",
      };
    }

    return {
      events: Array.isArray(json.events) ? json.events : [],
    };
  } catch {
    return { events: [], error: "Could not load reputation activity." };
  }
}
