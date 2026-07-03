// PHASE 6 STEP 4 — Topic clustering client service (NEW file, additive).
//
// Frontend changes: JS-only, no native modules changed, no app.json changed.
// Deploy with: eas update --channel preview
// Do NOT run eas build — Apple review is in progress.
// Backend changes deploy to Render independently.
//
// Every function here fails soft (returns null / empty) — topic clustering is
// informational and must never block posting, searching, or browsing.
import { getBackendUrl } from "../constants/apiConfig";
import { supabase } from "../lib/supabase";

export type TopicClusterInfo = {
  topic_cluster_id: string;
  topic_label: string;
  claim_count: number;
  cluster_verdict: string;
  total_vote_count: number;
};

export type TopicSearchPreviewClaim = {
  claim_id: string;
  title: string;
  author_display_name: string;
  true_votes: number;
  fake_votes: number;
  verdict_status: string;
};

export type TopicSearchTopic = {
  topic_cluster_id: string;
  topic_label: string;
  slug: string;
  cluster_verdict: string;
  total_true_votes: number;
  total_fake_votes: number;
  total_vote_count: number;
  claim_count: number;
  preview_claims: TopicSearchPreviewClaim[];
};

export type TopicRow = {
  id: string;
  topic_label: string;
  slug: string;
  cluster_verdict: string | null;
  total_true_votes: number;
  total_fake_votes: number;
  total_disputed_votes: number;
  total_vote_count: number;
  claim_count: number;
};

export type TopicClaimsResponse = {
  topic: TopicRow;
  // Raw claim rows in the same shape as existing claim list queries; map with
  // claimService.mapClaimRowToClaim before rendering.
  claims: Record<string, unknown>[];
  total: number;
  offset: number;
  limit: number;
};

async function getAuthHeader(): Promise<Record<string, string>> {
  // Same session/token pattern as claimService.requestClaimEmbedding.
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;
    return accessToken ? { Authorization: `Bearer ${accessToken}` } : {};
  } catch {
    return {};
  }
}

// Post-time cluster awareness for the create screen. Calls the backend
// duplicate/topic check (which reuses one embedding for both answers) and
// returns only the topic_cluster part. Informational only — never blocks.
export async function checkTopicClusterForDraft(
  title: string,
  description: string,
): Promise<TopicClusterInfo | null> {
  const backendUrl = getBackendUrl();
  const safeTitle = title.trim();

  if (!backendUrl || safeTitle.length === 0) {
    return null;
  }

  try {
    const authHeader = await getAuthHeader();
    const response = await fetch(`${backendUrl}/api/claims/check-duplicate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeader,
      },
      body: JSON.stringify({ title: safeTitle, description: description.trim() }),
    });

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as { topic_cluster?: TopicClusterInfo | null };
    return payload.topic_cluster ?? null;
  } catch (error) {
    console.log("[topics] draft cluster check warning:", error);
    return null;
  }
}

// Topic layer of search — returns [] on any failure so the existing claim
// search renders exactly as before.
export async function searchTopics(query: string): Promise<TopicSearchTopic[]> {
  const backendUrl = getBackendUrl();
  const safeQuery = query.trim();

  if (!backendUrl || safeQuery.length < 2) {
    return [];
  }

  try {
    const response = await fetch(`${backendUrl}/api/topics/search?q=${encodeURIComponent(safeQuery)}`);

    if (!response.ok) {
      return [];
    }

    const payload = (await response.json()) as { topics?: TopicSearchTopic[] };
    return Array.isArray(payload.topics) ? payload.topics : [];
  } catch (error) {
    console.log("[topics] search warning:", error);
    return [];
  }
}

// All claims in a cluster for the topic screen.
export async function fetchTopicClaims(
  clusterId: string,
  limit = 20,
  offset = 0,
): Promise<TopicClaimsResponse | null> {
  const backendUrl = getBackendUrl();

  if (!backendUrl || !clusterId.trim()) {
    return null;
  }

  try {
    const response = await fetch(
      `${backendUrl}/api/topics/${encodeURIComponent(clusterId.trim())}/claims?limit=${limit}&offset=${offset}`,
    );

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as TopicClaimsResponse;
  } catch (error) {
    console.log("[topics] claims fetch warning:", error);
    return null;
  }
}
