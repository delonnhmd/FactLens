import "server-only";

import { z } from "zod";

import { RenderApiError, requestPublicRenderJson, requestRenderJson } from "@/lib/api/render-client";
import type {
  LeaderboardData,
  LeaderboardScope,
  ProfileSearchResult,
  PublicProfileDetail,
  TopicSearchResult,
} from "@/lib/types/discovery";
import { getApprovedImageUrl } from "@/lib/utils/images";

const nullableText = z.preprocess(
  (value) => (typeof value === "string" && value.trim() ? value.trim() : null),
  z.string().nullable(),
);
const numeric = z.preprocess((value) => {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}, z.number());
const badgeList = z.preprocess(
  (value) => {
    if (!Array.isArray(value)) return [];
    return value
      .map((badge) => {
        if (typeof badge === "string") return badge;
        if (badge && typeof badge === "object") {
          const row = badge as Record<string, unknown>;
          return [row.label, row.title, row.name, row.id].find(
            (candidate): candidate is string => typeof candidate === "string" && candidate.trim().length > 0,
          );
        }
        return undefined;
      })
      .filter((badge): badge is string => Boolean(badge));
  },
  z.array(z.string().trim().min(1).max(100)).max(30),
);

const leaderboardRowSchema = z.looseObject({
  id: z.uuid(),
  username: z.string().trim().min(1).max(100),
  display_name: nullableText,
  avatar_url: nullableText,
  public_profile_slug: nullableText,
  rank_position: numeric,
  rank_title: nullableText,
  highest_rank_achieved: nullableText,
  reputation_points: numeric,
  monthly_reputation_points: numeric,
  trust_score: numeric,
  badge_list: badgeList,
});
const leaderboardSchema = z.looseObject({
  ok: z.literal(true),
  next_monthly_reset_at: nullableText,
  users: z.array(leaderboardRowSchema),
});

const publicProfileSchema = z.looseObject({
  id: z.uuid(),
  username: z.string().trim().min(1).max(100),
  display_name: nullableText,
  avatar_url: nullableText,
  bio: nullableText,
  public_profile_slug: nullableText,
  profile_visibility: z.preprocess(
    (value) => (value === "private" ? "private" : "public"),
    z.enum(["public", "private"]),
  ),
  rank_title: nullableText,
  reputation_points: numeric,
  monthly_reputation_points: numeric,
  badge_list: badgeList,
  evidence_count: numeric.optional().default(0),
  correct_votes: numeric.optional().default(0),
  created_at: nullableText,
  is_deleted: z.boolean().optional().default(false),
});
const publicProfileResponseSchema = z.looseObject({
  ok: z.boolean(),
  profile: publicProfileSchema.optional(),
  counts: z
    .looseObject({
      claims: numeric,
      replies: numeric,
      evidence: numeric,
    })
    .optional(),
  voting: z
    .looseObject({
      total_votes: numeric,
      finalized_votes: numeric,
      accuracy_percentage: z.preprocess(
        (value) => (value === null || value === undefined ? null : Number(value)),
        z.number().finite().min(0).max(100).nullable(),
      ),
    })
    .optional(),
  reason: z.string().optional(),
});

const mentionSchema = z.looseObject({
  id: z.uuid(),
  username: z.string().trim().min(1).max(100),
  display_name: nullableText,
  avatar_url: nullableText,
  verified: z.boolean().optional().default(false),
  type: z.string().optional(),
});
const mentionResponseSchema = z.looseObject({ results: z.array(mentionSchema) });

const topicSchema = z.looseObject({
  topic_cluster_id: z.uuid(),
  topic_label: z.string().trim().min(1).max(200),
  slug: z.string().trim().min(1).max(120),
  cluster_verdict: z.string().trim().max(50),
  total_vote_count: numeric,
  claim_count: numeric,
});
const topicResponseSchema = z.looseObject({ topics: z.array(topicSchema) });

export class DiscoveryReadError extends Error {
  constructor(message = "This information is temporarily unavailable. Please try again.") {
    super(message);
    this.name = "DiscoveryReadError";
  }
}

export async function getLeaderboard(scope: LeaderboardScope): Promise<LeaderboardData> {
  try {
    const payload = await requestPublicRenderJson(
      `/leaderboard?type=${scope === "monthly" ? "monthly" : "alltime"}&limit=50`,
    );
    const parsed = leaderboardSchema.safeParse(payload);
    if (!parsed.success) throw new DiscoveryReadError();

    return Object.freeze({
      nextMonthlyResetAt: parsed.data.next_monthly_reset_at,
      users: Object.freeze(
        parsed.data.users.map((row, index) =>
          Object.freeze({
            id: row.id,
            username: row.username,
            displayName: row.display_name ?? row.username,
            avatarUrl: getApprovedImageUrl(row.avatar_url),
            profileSlug: row.public_profile_slug ?? row.username,
            rankPosition: Math.max(1, Math.trunc(row.rank_position || index + 1)),
            rankTitle: row.highest_rank_achieved ?? row.rank_title ?? "New Scout",
            points:
              scope === "monthly" ? row.monthly_reputation_points : row.reputation_points,
            trustScore: row.trust_score,
            badges: Object.freeze(row.badge_list),
          }),
        ),
      ),
    });
  } catch (error) {
    if (error instanceof DiscoveryReadError) throw error;
    throw new DiscoveryReadError("The leaderboard is temporarily unavailable. Please try again.");
  }
}

export async function getPublicProfile(
  identifier: string,
  accessToken: string | null = null,
): Promise<PublicProfileDetail | null> {
  const normalized = identifier.trim().replace(/^@+/, "").toLowerCase();
  if (!/^[a-z0-9_-]{1,120}$/.test(normalized)) return null;

  try {
    const path = `/profiles/${encodeURIComponent(normalized)}/summary`;
    const payload = accessToken
      ? await requestRenderJson(path, accessToken, { method: "GET" })
      : await requestPublicRenderJson(path);
    const parsed = publicProfileResponseSchema.safeParse(payload);
    if (!parsed.success) throw new DiscoveryReadError("Could not load this profile right now.");
    if (!parsed.data.ok || !parsed.data.profile) return null;

    const row = parsed.data.profile;
    const privateProfile = row.profile_visibility === "private" || row.is_deleted;
    return Object.freeze({
      id: row.id,
      username: row.is_deleted ? "deleted_user" : row.username,
      displayName: row.is_deleted ? "Deleted user" : row.display_name ?? row.username,
      avatarUrl: row.is_deleted ? null : getApprovedImageUrl(row.avatar_url),
      bio: privateProfile ? null : row.bio,
      publicProfileSlug: row.public_profile_slug ?? row.username,
      profileVisibility: privateProfile ? "private" : "public",
      rankTitle: row.rank_title ?? "New Scout",
      reputationPoints: privateProfile ? 0 : row.reputation_points,
      monthlyReputationPoints: privateProfile ? 0 : row.monthly_reputation_points,
      badges: privateProfile ? Object.freeze([]) : Object.freeze(row.badge_list),
      claimsCount: parsed.data.counts?.claims ?? 0,
      repliesCount: parsed.data.counts?.replies ?? 0,
      evidenceCount: parsed.data.counts?.evidence ?? 0,
      correctVotes: 0,
      totalVotes: parsed.data.voting?.total_votes ?? 0,
      finalizedVotes: parsed.data.voting?.finalized_votes ?? 0,
      accuracyPercentage: parsed.data.voting?.accuracy_percentage ?? null,
      createdAt: privateProfile ? null : row.created_at,
      isDeleted: row.is_deleted,
    });
  } catch (error) {
    if (error instanceof RenderApiError && error.status === 404) return null;
    if (error instanceof DiscoveryReadError) throw error;
    throw new DiscoveryReadError("Could not load this profile right now.");
  }
}

export async function searchProfiles(query: string): Promise<readonly ProfileSearchResult[]> {
  const normalized = query.trim().replace(/^@+/, "").slice(0, 50);
  if (normalized.length < 2) return Object.freeze([]);

  try {
    const payload = await requestPublicRenderJson(
      `/search/mentions?q=${encodeURIComponent(normalized)}&limit=8`,
    );
    const parsed = mentionResponseSchema.safeParse(payload);
    if (!parsed.success) return Object.freeze([]);

    return Object.freeze(
      parsed.data.results
        .filter((row) => !row.type || row.type === "profile" || row.type === "user")
        .map((row) =>
          Object.freeze({
            id: row.id,
            username: row.username,
            displayName: row.display_name ?? row.username,
            avatarUrl: getApprovedImageUrl(row.avatar_url),
            verified: row.verified,
          }),
        ),
    );
  } catch {
    return Object.freeze([]);
  }
}

export async function searchTopics(query: string): Promise<readonly TopicSearchResult[]> {
  const normalized = query.trim().slice(0, 100);
  if (normalized.length < 2) return Object.freeze([]);

  try {
    const payload = await requestPublicRenderJson(`/api/topics/search?q=${encodeURIComponent(normalized)}`);
    const parsed = topicResponseSchema.safeParse(payload);
    if (!parsed.success) return Object.freeze([]);

    return Object.freeze(
      parsed.data.topics.map((row) =>
        Object.freeze({
          id: row.topic_cluster_id,
          label: row.topic_label,
          slug: row.slug,
          verdict: row.cluster_verdict,
          totalVotes: row.total_vote_count,
          claimCount: row.claim_count,
        }),
      ),
    );
  } catch {
    return Object.freeze([]);
  }
}
