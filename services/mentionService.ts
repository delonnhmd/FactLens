import { getBackendUrl } from "../constants/apiConfig";
import { supabase } from "../lib/supabase";
import { extractMentionUsernames } from "../utils/mentions";

export type MentionTargetType = "user" | "organization";

export interface MentionTarget {
  type: MentionTargetType;
  id: string;
  username: string;
  displayName: string;
  rankTitle?: string | null;
  avatarUrl?: string | null;
  verified: boolean;
}

type MentionApiRow = {
  type?: string;
  id?: string;
  username?: string;
  display_name?: string | null;
  rank_title?: string | null;
  avatar_url?: string | null;
  verified?: boolean | null;
};

type MentionSearchResponse = {
  results?: MentionApiRow[];
};

const mentionTargetCache = new Map<string, MentionTarget | null>();

function mapMentionRow(row: MentionApiRow): MentionTarget | null {
  if ((row.type !== "user" && row.type !== "organization") || !row.id || !row.username) {
    return null;
  }

  return {
    type: row.type,
    id: row.id,
    username: row.username,
    displayName: row.display_name || row.username,
    rankTitle: row.rank_title ?? null,
    avatarUrl: row.avatar_url ?? null,
    verified: Boolean(row.verified),
  };
}

async function getAccessToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

export async function searchMentionTargets(query: string, limit = 8): Promise<MentionTarget[]> {
  const backendUrl = getBackendUrl();
  const safeQuery = query.trim().replace(/^@+/, "");

  if (!backendUrl || safeQuery.length < 1) {
    return [];
  }

  const accessToken = await getAccessToken();
  const params = new URLSearchParams({
    q: safeQuery,
    limit: String(limit),
  });

  try {
    const response = await fetch(`${backendUrl}/search/mentions?${params.toString()}`, {
      headers: accessToken
        ? {
            Authorization: `Bearer ${accessToken}`,
          }
        : undefined,
    });

    if (!response.ok) {
      return [];
    }

    const json = (await response.json().catch(() => ({}))) as MentionSearchResponse;

    return (json.results ?? []).map(mapMentionRow).filter((target): target is MentionTarget => Boolean(target));
  } catch {
    return [];
  }
}

export async function resolveMentionTargets(usernames: string[]): Promise<Map<string, MentionTarget>> {
  const resolvedTargets = new Map<string, MentionTarget>();
  const uniqueUsernames = Array.from(new Set(usernames.map((username) => username.toLowerCase()).filter(Boolean)));
  const uncachedUsernames = uniqueUsernames.filter((username) => !mentionTargetCache.has(username));

  await Promise.all(
    uncachedUsernames.map(async (username) => {
      const matches = await searchMentionTargets(username, 8);
      const exactMatch = matches.find((target) => target.username.toLowerCase() === username) ?? null;
      mentionTargetCache.set(username, exactMatch);
    }),
  );

  uniqueUsernames.forEach((username) => {
    const target = mentionTargetCache.get(username);

    if (target) {
      resolvedTargets.set(username, target);
    }
  });

  return resolvedTargets;
}

async function saveMentionTags(targetType: "claim" | "evidence", targetId: string, text: string): Promise<void> {
  const backendUrl = getBackendUrl();
  const mentions = extractMentionUsernames(text);

  if (!backendUrl || !targetId || mentions.length === 0) {
    return;
  }

  const accessToken = await getAccessToken();

  if (!accessToken) {
    return;
  }

  try {
    await fetch(`${backendUrl}/mentions/tags`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        target_type: targetType,
        target_id: targetId,
        text,
      }),
    });
  } catch (error) {
    console.log("[mentions] tag save warning:", error);
  }
}

export function saveClaimMentions(claimId: string, text: string): Promise<void> {
  return saveMentionTags("claim", claimId, text);
}

export function saveEvidenceMentions(evidenceId: string, text: string): Promise<void> {
  return saveMentionTags("evidence", evidenceId, text);
}
