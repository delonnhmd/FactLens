import "server-only";

import { z } from "zod";

import { applyClaimVisibilityFilters, getClaimsByTopicId, isValidClaimId } from "@/lib/api/claims";
import { createPublicClient } from "@/lib/supabase/public";
import type { PublicTopic, PublicTopicPageData, TopicVerdict } from "@/lib/types/topic";

const topicSelect = [
  "id",
  "topic_label",
  "slug",
  "meta_title",
  "meta_description",
  "keywords",
  "og_title",
  "cluster_verdict",
  "total_true_votes",
  "total_fake_votes",
  "total_disputed_votes",
  "total_vote_count",
  "claim_count",
  "updated_at",
].join(",");

const publicIdentifierSchema = z.string().trim().min(1).max(120).regex(/^[a-z0-9-]+$/i);
const topicVerdicts = new Set<TopicVerdict>(["TRUE", "FAKE", "DISPUTED", "INSUFFICIENT_DATA"]);

const nullableText = z.preprocess(
  (value) => (typeof value === "string" && value.trim() ? value.trim() : null),
  z.string().nullable(),
);
const nonNegativeInteger = z.preprocess((value) => {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.trunc(number)) : 0;
}, z.number().int().nonnegative());
const nullableDate = z.preprocess((value) => {
  if (typeof value !== "string" || Number.isNaN(new Date(value).getTime())) {
    return null;
  }
  return value;
}, z.string().nullable());

const rawTopicSchema = z.looseObject({
  id: z.uuid(),
  topic_label: z.string().trim().min(1).max(200),
  slug: z.string().trim().min(1).max(120).regex(/^[a-z0-9-]+$/),
  meta_title: nullableText,
  meta_description: nullableText,
  keywords: z.preprocess(
    (value) => (Array.isArray(value) ? value.filter((item) => typeof item === "string") : []),
    z.array(z.string().trim().min(1).max(100)).max(20),
  ),
  og_title: nullableText,
  cluster_verdict: z.preprocess(
    (value) => (topicVerdicts.has(value as TopicVerdict) ? value : "INSUFFICIENT_DATA"),
    z.enum(["TRUE", "FAKE", "DISPUTED", "INSUFFICIENT_DATA"]),
  ),
  total_true_votes: nonNegativeInteger,
  total_fake_votes: nonNegativeInteger,
  total_disputed_votes: nonNegativeInteger,
  total_vote_count: nonNegativeInteger,
  claim_count: nonNegativeInteger,
  updated_at: nullableDate,
});

function mapTopicRow(row: unknown): PublicTopic | null {
  const result = rawTopicSchema.safeParse(row);

  if (!result.success) {
    return null;
  }

  return Object.freeze({
    id: result.data.id,
    label: result.data.topic_label,
    slug: result.data.slug,
    metaTitle: result.data.meta_title,
    metaDescription: result.data.meta_description,
    keywords: Object.freeze(result.data.keywords),
    openGraphTitle: result.data.og_title,
    verdict: result.data.cluster_verdict,
    totalTrueVotes: result.data.total_true_votes,
    totalFakeVotes: result.data.total_fake_votes,
    totalUnsureVotes: result.data.total_disputed_votes,
    totalVotes: result.data.total_vote_count,
    claimCount: result.data.claim_count,
    updatedAt: result.data.updated_at,
  });
}

async function getTopicByIdentifier(identifier: string): Promise<PublicTopic | null> {
  const normalized = identifier.trim().toLowerCase();

  if (!publicIdentifierSchema.safeParse(normalized).success) {
    return null;
  }

  const supabase = createPublicClient();
  let query = supabase.from("claim_topics").select(topicSelect);
  query = isValidClaimId(normalized) ? query.eq("id", normalized) : query.eq("slug", normalized);
  const { data, error } = await query.limit(1).maybeSingle();

  if (error || !data) {
    return null;
  }

  return mapTopicRow(data);
}

export async function getPublicTopicPageData(identifier: string): Promise<PublicTopicPageData | null> {
  const topic = await getTopicByIdentifier(identifier);

  if (!topic) {
    return null;
  }

  const claims = await getClaimsByTopicId(topic.id);

  // A public topic must have at least one claim visible through anonymous RLS.
  // This prevents cluster metadata derived only from hidden content from leaking.
  if (claims.length === 0) {
    return null;
  }

  return Object.freeze({ topic, claims });
}

export async function getSitemapTopics(): Promise<readonly PublicTopic[]> {
  const supabase = createPublicClient();
  let claimQuery = supabase.from("claims").select("topic_cluster_id").not("topic_cluster_id", "is", null);
  claimQuery = applyClaimVisibilityFilters(claimQuery);
  const { data: claimRows, error: claimError } = await claimQuery.limit(5_000);

  if (claimError) {
    return Object.freeze([]);
  }

  const visibleTopicIds = [
    ...new Set(
      (claimRows ?? [])
        .map((row) => row.topic_cluster_id)
        .filter((id): id is string => typeof id === "string" && isValidClaimId(id)),
    ),
  ];

  if (visibleTopicIds.length === 0) {
    return Object.freeze([]);
  }

  const { data, error } = await supabase
    .from("claim_topics")
    .select(topicSelect)
    .in("id", visibleTopicIds)
    .limit(1_000);

  if (error) {
    return Object.freeze([]);
  }

  return Object.freeze((data ?? []).map(mapTopicRow).filter((topic): topic is PublicTopic => topic !== null));
}
