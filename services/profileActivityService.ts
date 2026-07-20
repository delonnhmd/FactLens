import { getBackendUrl } from "../constants/apiConfig";
import { supabase } from "../lib/supabase";

export type PublicProfileActivityType = "posts" | "replies" | "evidence";

export interface PublicProfilePostActivity {
  id: string;
  title: string;
  descriptionPreview: string;
  imageUrl: string | null;
  thumbnailUrl: string | null;
  category: string | null;
  status: string | null;
  finalVerdict: "TRUE" | "FAKE" | "NEEDS_MORE_EVIDENCE" | null;
  votesTrue: number;
  votesFake: number;
  votesUnsure: number;
  totalVotes: number;
  createdAt: string | null;
}

export interface PublicProfileReplyActivity {
  id: string;
  text: string;
  claimId: string;
  claimTitle: string;
  createdAt: string | null;
  replyCount: number;
  helpfulCount: number;
  anchor: string;
}

export interface PublicProfileEvidenceActivity {
  id: string;
  evidenceType: string;
  note: string;
  sourceUrl: string | null;
  sourceDomain: string | null;
  imageUrl: string | null;
  thumbnailUrl: string | null;
  claimId: string;
  claimTitle: string;
  helpfulCount: number;
  createdAt: string | null;
}

export interface PrivateVoteHistoryItem {
  claimId: string;
  claimTitle: string;
  voteType: "TRUE" | "FAKE" | "UNSURE";
  claimStatus: string | null;
  finalVerdict: "TRUE" | "FAKE" | "NEEDS_MORE_EVIDENCE" | null;
  result: "MATCHED" | "DID_NOT_MATCH" | "PENDING";
  votedAt: string | null;
}

type ActivityResult = {
  posts: PublicProfilePostActivity[];
  replies: PublicProfileReplyActivity[];
  evidence: PublicProfileEvidenceActivity[];
  error?: string;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function asText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asCount(value: unknown): number {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.trunc(number)) : 0;
}

function asFinalVerdict(value: unknown): "TRUE" | "FAKE" | "NEEDS_MORE_EVIDENCE" | null {
  const verdict = asText(value);
  return verdict === "TRUE" || verdict === "FAKE" || verdict === "NEEDS_MORE_EVIDENCE" ? verdict : null;
}

async function getAccessToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

async function requestProfileJson(path: string, requireAuthentication = false): Promise<Record<string, unknown>> {
  const accessToken = await getAccessToken();

  if (requireAuthentication && !accessToken) {
    throw new Error("Log in to view your voting history.");
  }

  const response = await fetch(`${getBackendUrl()}${path}`, {
    headers: {
      Accept: "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
  });
  const payload = asRecord(await response.json().catch(() => ({})));

  if (!response.ok) {
    throw new Error(asText(payload.detail) || asText(payload.message) || "Could not load this activity right now.");
  }

  return payload;
}

export async function fetchPublicProfileActivity(
  identifier: string,
  type: PublicProfileActivityType,
): Promise<ActivityResult> {
  const empty: ActivityResult = { posts: [], replies: [], evidence: [] };

  try {
    const payload = await requestProfileJson(`/profiles/${encodeURIComponent(identifier)}/${type}`);
    const rows = Array.isArray(payload[type]) ? payload[type] : [];

    if (type === "posts") {
      return {
        ...empty,
        posts: rows.map((value) => {
          const row = asRecord(value);
          const voteTotals = asRecord(row.vote_totals);
          return {
            id: asText(row.id),
            title: asText(row.title) || "Untitled claim",
            descriptionPreview: asText(row.description_preview),
            imageUrl: asText(row.image_url) || null,
            thumbnailUrl: asText(row.thumbnail_url) || null,
            category: asText(row.category) || null,
            status: asText(row.status) || null,
            finalVerdict: asFinalVerdict(row.final_verdict),
            votesTrue: asCount(voteTotals.true),
            votesFake: asCount(voteTotals.fake),
            votesUnsure: asCount(voteTotals.unsure),
            totalVotes: asCount(voteTotals.total),
            createdAt: asText(row.created_at) || null,
          };
        }).filter((item) => Boolean(item.id)),
      };
    }

    if (type === "replies") {
      return {
        ...empty,
        replies: rows.map((value) => {
          const row = asRecord(value);
          return {
            id: asText(row.id),
            text: asText(row.text),
            claimId: asText(row.claim_id),
            claimTitle: asText(row.claim_title) || "Untitled claim",
            createdAt: asText(row.created_at) || null,
            replyCount: asCount(row.reply_count),
            helpfulCount: asCount(row.helpful_count),
            anchor: asText(row.anchor),
          };
        }).filter((item) => Boolean(item.id && item.claimId && item.text)),
      };
    }

    return {
      ...empty,
      evidence: rows.map((value) => {
        const row = asRecord(value);
        return {
          id: asText(row.id),
          evidenceType: asText(row.evidence_type) || "UNCLEAR",
          note: asText(row.note),
          sourceUrl: asText(row.source_url) || null,
          sourceDomain: asText(row.source_domain) || null,
          imageUrl: asText(row.image_url) || null,
          thumbnailUrl: asText(row.thumbnail_url) || null,
          claimId: asText(row.claim_id),
          claimTitle: asText(row.claim_title) || "Untitled claim",
          helpfulCount: asCount(row.helpful_count),
          createdAt: asText(row.created_at) || null,
        };
      }).filter((item) => Boolean(item.id && item.claimId)),
    };
  } catch (error) {
    return { ...empty, error: error instanceof Error ? error.message : "Could not load this activity right now." };
  }
}

export async function fetchPrivateVoteHistory(): Promise<{ votes: PrivateVoteHistoryItem[]; error?: string }> {
  try {
    const payload = await requestProfileJson("/profiles/me/votes", true);
    const rows = Array.isArray(payload.votes) ? payload.votes : [];
    const votes = rows.map((value) => {
      const row = asRecord(value);
      const voteType = asText(row.vote_type);
      const result = asText(row.result);
      return {
        claimId: asText(row.claim_id),
        claimTitle: asText(row.claim_title) || "Untitled claim",
        voteType: voteType === "TRUE" || voteType === "FAKE" || voteType === "UNSURE" ? voteType : "UNSURE",
        claimStatus: asText(row.claim_status) || null,
        finalVerdict: asFinalVerdict(row.final_verdict),
        result: result === "MATCHED" || result === "DID_NOT_MATCH" ? result : "PENDING",
        votedAt: asText(row.voted_at) || null,
      } as PrivateVoteHistoryItem;
    }).filter((item) => Boolean(item.claimId));
    return { votes };
  } catch (error) {
    return { votes: [], error: error instanceof Error ? error.message : "Could not load voting history right now." };
  }
}
