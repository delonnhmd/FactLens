import { z } from "zod";

import {
  aiStatusValues,
  claimStatusValues,
  claimTypeValues,
  type PublicClaim,
} from "../types/claim";
import type { PublicClaimAuthor } from "../types/profile";
import { getSafeExternalUrl, getSourceDomain } from "../utils/urls";

const nullableText = z.preprocess(
  (value) => (typeof value === "string" && value.trim() ? value.trim() : null),
  z.string().nullable(),
);

const nullableUrl = z.preprocess(
  (value) => (typeof value === "string" ? getSafeExternalUrl(value) : null),
  z.string().nullable(),
);

const nullableNumber = z.preprocess((value) => {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : null;
}, z.number().nullable());

const nullableInteger = z.preprocess((value) => {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.trunc(number)) : null;
}, z.number().int().nullable());

const nullableDate = z.preprocess((value) => {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  return Number.isNaN(new Date(value).getTime()) ? null : value;
}, z.string().nullable());

const rawAuthorSchema = z.looseObject({
  id: z.uuid(),
  username: nullableText,
  display_name: nullableText,
  avatar_url: nullableUrl,
  verified: z.preprocess((value) => value === true, z.boolean()),
});

const rawClaimSchema = z.looseObject({
  id: z.uuid(),
  author_id: z.preprocess(
    (value) => (typeof value === "string" && z.uuid().safeParse(value).success ? value : null),
    z.string().nullable(),
  ),
  title: z.string().trim().min(1).max(2_000),
  description: z.preprocess((value) => (typeof value === "string" ? value.trim() : ""), z.string()),
  source_url: nullableUrl,
  video_url: nullableUrl,
  image_url: nullableUrl,
  thumbnail_url: nullableUrl,
  category: nullableText,
  sub_category: nullableText,
  politician_tag: nullableText,
  created_at: nullableDate,
  claim_type: z.preprocess(
    (value) => (claimTypeValues.includes(value as (typeof claimTypeValues)[number]) ? value : null),
    z.enum(claimTypeValues).nullable(),
  ),
  status: z.preprocess(
    (value) => (claimStatusValues.includes(value as (typeof claimStatusValues)[number]) ? value : null),
    z.enum(claimStatusValues).nullable(),
  ),
  current_phase: nullableInteger,
  mode: nullableText,
  expires_at: nullableDate,
  vote_accept_until: nullableDate,
  score_lock_at: nullableDate,
  votes_true: nullableInteger,
  votes_fake: nullableInteger,
  votes_unsure: nullableInteger,
  total_votes: nullableInteger,
  final_score: nullableNumber,
  min_votes_required: nullableInteger,
  ai_status: z.preprocess(
    (value) => (aiStatusValues.includes(value as (typeof aiStatusValues)[number]) ? value : null),
    z.enum(aiStatusValues).nullable(),
  ),
  ai_confidence: nullableNumber,
  ai_summary: nullableText,
  source_quality: nullableText,
  source_score: nullableNumber,
  source_domain: nullableText,
  source_count: nullableInteger,
  source_supports_claim: z.preprocess(
    (value) => (typeof value === "boolean" ? value : null),
    z.boolean().nullable(),
  ),
  source_support_summary: nullableText,
  evidence_count: nullableInteger,
  topic_cluster_id: z.preprocess(
    (value) => (typeof value === "string" && z.uuid().safeParse(value).success ? value : null),
    z.string().nullable(),
  ),
});

const fallbackAuthor: PublicClaimAuthor = Object.freeze({
  id: "00000000-0000-0000-0000-000000000000",
  username: "contributor",
  displayName: "FactFight contributor",
  avatarUrl: null,
  verified: false,
});

export function mapPublicAuthorRow(row: unknown): PublicClaimAuthor | null {
  const result = rawAuthorSchema.safeParse(row);

  if (!result.success) {
    return null;
  }

  const username = result.data.username ?? "contributor";

  return Object.freeze({
    id: result.data.id,
    username,
    displayName: result.data.display_name ?? username,
    avatarUrl: result.data.avatar_url,
    verified: result.data.verified,
  });
}

export function mapClaimRow(row: unknown, author?: PublicClaimAuthor | null): PublicClaim | null {
  const result = rawClaimSchema.safeParse(row);

  if (!result.success) {
    return null;
  }

  const data = result.data;
  const votesTrue = data.votes_true ?? 0;
  const votesFake = data.votes_fake ?? 0;
  const votesUnsure = data.votes_unsure ?? 0;
  const aggregateCount = votesTrue + votesFake + votesUnsure;

  return Object.freeze({
    id: data.id,
    authorId: data.author_id,
    author: author ?? (data.author_id ? { ...fallbackAuthor, id: data.author_id } : fallbackAuthor),
    title: data.title,
    description: data.description,
    sourceUrl: data.source_url,
    videoUrl: data.video_url,
    imageUrl: data.image_url,
    thumbnailUrl: data.thumbnail_url,
    category: data.category,
    subCategory: data.sub_category,
    politicianTag: data.politician_tag,
    createdAt: data.created_at,
    claimType: data.claim_type,
    status: data.status,
    currentPhase: data.current_phase,
    mode: data.mode,
    expiresAt: data.expires_at,
    voteAcceptUntil: data.vote_accept_until,
    scoreLockAt: data.score_lock_at,
    votes: Object.freeze({
      true: votesTrue,
      fake: votesFake,
      unsure: votesUnsure,
      total: data.total_votes ?? aggregateCount,
    }),
    finalScore: data.final_score,
    minimumVotesRequired: data.min_votes_required,
    aiStatus: data.ai_status,
    aiConfidence: data.ai_confidence,
    aiSummary: data.ai_summary,
    sourceQuality: data.source_quality,
    sourceScore: data.source_score,
    sourceDomain: data.source_domain ?? getSourceDomain(data.source_url),
    sourceCount: data.source_count ?? 0,
    sourceSupportsClaim: data.source_supports_claim,
    sourceSupportSummary: data.source_support_summary,
    evidenceCount: data.evidence_count ?? 0,
    topicClusterId: data.topic_cluster_id,
  });
}
