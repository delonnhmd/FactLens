import "server-only";

import { z } from "zod";

import { requestPublicRenderJson, requestRenderJson } from "@/lib/api/render-client";
import { claimStatusValues } from "@/lib/types/claim";
import { evidenceTypeValues } from "@/lib/types/evidence";
import type {
  PublicProfileEvidence,
  PublicProfilePost,
  PublicProfileReply,
} from "@/lib/types/profile-activity";
import { getApprovedImageUrl } from "@/lib/utils/images";
import { getSafeExternalUrl } from "@/lib/utils/urls";

const numeric = z.preprocess((value) => {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}, z.number());
const nullableText = z.preprocess(
  (value) => (typeof value === "string" && value.trim() ? value.trim() : null),
  z.string().nullable(),
);
const nullableDate = z.preprocess(
  (value) =>
    typeof value === "string" && !Number.isNaN(new Date(value).getTime()) ? value : null,
  z.string().nullable(),
);

const postSchema = z.looseObject({
  id: z.uuid(),
  title: z.string().trim().min(1).max(200),
  description_preview: z.string().trim().max(280).default(""),
  image_url: nullableText,
  thumbnail_url: nullableText,
  category: nullableText,
  status: z.enum(claimStatusValues).nullable().optional().default(null),
  final_verdict: z.enum(["TRUE", "FAKE", "NEEDS_MORE_EVIDENCE"]).nullable().optional().default(null),
  vote_totals: z.looseObject({ true: numeric, fake: numeric, unsure: numeric, total: numeric }),
  created_at: nullableDate,
});
const replySchema = z.looseObject({
  id: z.string().trim().min(1).max(100),
  text: z.string().trim().min(1).max(2000),
  claim_id: z.uuid(),
  claim_title: z.string().trim().min(1).max(200),
  created_at: nullableDate,
  reply_count: numeric,
  helpful_count: numeric,
  anchor: z.string().trim().min(1).max(120),
});
const evidenceSchema = z.looseObject({
  id: z.uuid(),
  evidence_type: z.enum(evidenceTypeValues),
  note: z.string().trim().max(2000).default(""),
  source_url: nullableText,
  source_domain: nullableText,
  image_url: nullableText,
  thumbnail_url: nullableText,
  claim_id: z.uuid(),
  claim_title: z.string().trim().min(1).max(200),
  helpful_count: numeric,
  created_at: nullableDate,
});
const postsResponseSchema = z.looseObject({ ok: z.literal(true), posts: z.array(postSchema).max(100) });
const repliesResponseSchema = z.looseObject({ ok: z.literal(true), replies: z.array(replySchema).max(100) });
const evidenceResponseSchema = z.looseObject({ ok: z.literal(true), evidence: z.array(evidenceSchema).max(100) });

async function requestProfileActivity(path: string, accessToken: string | null): Promise<unknown> {
  return accessToken
    ? requestRenderJson(path, accessToken, { method: "GET" })
    : requestPublicRenderJson(path);
}

export async function getPublicProfilePosts(
  identifier: string,
  accessToken: string | null,
): Promise<readonly PublicProfilePost[]> {
  const payload = await requestProfileActivity(`/profiles/${encodeURIComponent(identifier)}/posts`, accessToken);
  const parsed = postsResponseSchema.parse(payload);
  return Object.freeze(
    parsed.posts.map((row) =>
      Object.freeze({
        id: row.id,
        title: row.title,
        descriptionPreview: row.description_preview,
        imageUrl: getApprovedImageUrl(row.image_url),
        thumbnailUrl: getApprovedImageUrl(row.thumbnail_url),
        category: row.category,
        status: row.status,
        finalVerdict: row.final_verdict,
        votes: Object.freeze({
          true: Math.trunc(row.vote_totals.true),
          fake: Math.trunc(row.vote_totals.fake),
          unsure: Math.trunc(row.vote_totals.unsure),
          total: Math.trunc(row.vote_totals.total),
        }),
        createdAt: row.created_at,
      }),
    ),
  );
}

export async function getPublicProfileReplies(
  identifier: string,
  accessToken: string | null,
): Promise<readonly PublicProfileReply[]> {
  const payload = await requestProfileActivity(`/profiles/${encodeURIComponent(identifier)}/replies`, accessToken);
  const parsed = repliesResponseSchema.parse(payload);
  return Object.freeze(
    parsed.replies.map((row) =>
      Object.freeze({
        id: row.id,
        text: row.text,
        claimId: row.claim_id,
        claimTitle: row.claim_title,
        createdAt: row.created_at,
        replyCount: Math.trunc(row.reply_count),
        helpfulCount: Math.trunc(row.helpful_count),
        anchor: row.anchor,
      }),
    ),
  );
}

export async function getPublicProfileEvidence(
  identifier: string,
  accessToken: string | null,
): Promise<readonly PublicProfileEvidence[]> {
  const payload = await requestProfileActivity(`/profiles/${encodeURIComponent(identifier)}/evidence`, accessToken);
  const parsed = evidenceResponseSchema.parse(payload);
  return Object.freeze(
    parsed.evidence.map((row) =>
      Object.freeze({
        id: row.id,
        type: row.evidence_type,
        note: row.note,
        sourceUrl: row.source_url ? getSafeExternalUrl(row.source_url) : null,
        sourceDomain: row.source_domain,
        imageUrl: getApprovedImageUrl(row.image_url),
        thumbnailUrl: getApprovedImageUrl(row.thumbnail_url),
        claimId: row.claim_id,
        claimTitle: row.claim_title,
        helpfulCount: Math.trunc(row.helpful_count),
        createdAt: row.created_at,
      }),
    ),
  );
}
