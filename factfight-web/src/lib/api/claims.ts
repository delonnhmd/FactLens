import "server-only";

import { z } from "zod";

import { mapClaimRow, mapPublicAuthorRow } from "@/lib/api/claim-mappers";
import { createPublicClient } from "@/lib/supabase/public";
import type { PublicClaim } from "@/lib/types/claim";
import { evidenceTypeValues, type PublicEvidence } from "@/lib/types/evidence";
import type { FeedClaimsPage } from "@/lib/types/feed";
import type { PublicClaimAuthor } from "@/lib/types/profile";
import type { ClaimSeoMetadata, SitemapClaimEntry } from "@/lib/types/seo";
import { FEED_PAGE_SIZE, MAX_FEED_PAGE } from "@/lib/utils/pagination";
import { getSafeExternalUrl } from "@/lib/utils/urls";

export const CLAIM_SELECT_COLUMNS = [
  "id",
  "author_id",
  "title",
  "description",
  "source_url",
  "video_url",
  "image_url",
  "thumbnail_url",
  "category",
  "sub_category",
  "politician_tag",
  "created_at",
  "claim_type",
  "status",
  "current_phase",
  "mode",
  "expires_at",
  "vote_accept_until",
  "score_lock_at",
  "votes_true",
  "votes_fake",
  "votes_unsure",
  "total_votes",
  "final_score",
  "min_votes_required",
  "ai_status",
  "ai_confidence",
  "ai_summary",
  "source_quality",
  "source_score",
  "source_domain",
  "source_count",
  "source_supports_claim",
  "source_support_summary",
  "evidence_count",
  "topic_cluster_id",
] as const;

export const PUBLIC_AUTHOR_SELECT_COLUMNS = [
  "id",
  "username",
  "display_name",
  "avatar_url",
  "verified",
] as const;

export const CLAIM_VISIBILITY_FILTERS = Object.freeze([
  Object.freeze({ column: "is_deleted", value: false }),
  Object.freeze({ column: "is_hidden", value: false }),
  Object.freeze({ column: "hidden", value: false }),
  Object.freeze({ column: "safety_status", value: "APPROVED" }),
]);

const claimSelect = CLAIM_SELECT_COLUMNS.join(",");
const publicAuthorSelect = PUBLIC_AUTHOR_SELECT_COLUMNS.join(",");
const evidenceSelect = [
  "id",
  "claim_id",
  "user_id",
  "evidence_type",
  "url",
  "note",
  "image_url",
  "thumbnail_url",
  "source_quality_label",
  "source_quality_score",
  "source_quality_reason",
  "hidden",
  "created_at",
].join(",");
const seoSelect = [
  "claim_id",
  "version",
  "slug",
  "meta_title",
  "meta_description",
  "keywords",
  "og_title",
  "og_description",
  "generated_at",
].join(",");

const claimIdSchema = z.uuid();
const publicIdentifierSchema = z.string().trim().min(1).max(120).regex(/^[a-z0-9-]+$/i);
const pageSchema = z.number().int().min(1).max(MAX_FEED_PAGE);

const nullableText = z.preprocess(
  (value) => (typeof value === "string" && value.trim() ? value.trim() : null),
  z.string().nullable(),
);
const nullableDate = z.preprocess((value) => {
  if (typeof value !== "string" || Number.isNaN(new Date(value).getTime())) {
    return null;
  }
  return value;
}, z.string().nullable());
const nullableNumber = z.preprocess((value) => {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : null;
}, z.number().nullable());

const rawSeoSchema = z.looseObject({
  claim_id: z.uuid(),
  version: z.enum(["creation", "finalization"]),
  slug: z.string().trim().min(1).max(120).regex(/^[a-z0-9-]+$/),
  meta_title: z.string().trim().min(1).max(200),
  meta_description: z.string().trim().min(1).max(500),
  keywords: z.preprocess(
    (value) => (Array.isArray(value) ? value.filter((item) => typeof item === "string") : []),
    z.array(z.string().trim().min(1).max(100)).max(20),
  ),
  og_title: z.string().trim().min(1).max(200),
  og_description: z.string().trim().min(1).max(500),
  generated_at: nullableDate,
});

const rawEvidenceSchema = z.looseObject({
  id: z.uuid(),
  user_id: z.preprocess(
    (value) => (typeof value === "string" && claimIdSchema.safeParse(value).success ? value : null),
    z.string().nullable(),
  ),
  evidence_type: z.enum(evidenceTypeValues),
  url: z.preprocess(
    (value) => (typeof value === "string" ? getSafeExternalUrl(value) : null),
    z.string().nullable(),
  ),
  note: z.preprocess((value) => (typeof value === "string" ? value.trim() : ""), z.string().max(2_000)),
  image_url: nullableText,
  thumbnail_url: nullableText,
  source_quality_label: nullableText,
  source_quality_score: nullableNumber,
  source_quality_reason: nullableText,
  created_at: nullableDate,
});

export class ClaimReadError extends Error {
  constructor() {
    super("Claims are temporarily unavailable. Please try again.");
    this.name = "ClaimReadError";
  }
}

export interface PublicClaimPageData {
  readonly claim: PublicClaim;
  readonly evidence: readonly PublicEvidence[];
  readonly seo: ClaimSeoMetadata | null;
}

export interface PublicHomeClaims {
  readonly recent: readonly PublicClaim[];
  readonly trending: readonly PublicClaim[];
}

export function isValidClaimId(value: string): boolean {
  return claimIdSchema.safeParse(value).success;
}

export function isValidPublicIdentifier(value: string): boolean {
  return publicIdentifierSchema.safeParse(value).success;
}

async function getAuthorsById(authorIds: readonly string[]): Promise<Map<string, PublicClaimAuthor>> {
  const uniqueAuthorIds = [...new Set(authorIds)].filter((id) => claimIdSchema.safeParse(id).success);

  if (uniqueAuthorIds.length === 0) {
    return new Map();
  }

  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("profiles")
    .select(publicAuthorSelect)
    .in("id", uniqueAuthorIds);

  if (error) {
    throw new ClaimReadError();
  }

  const authors = new Map<string, PublicClaimAuthor>();

  for (const row of data ?? []) {
    const author = mapPublicAuthorRow(row);
    if (author) {
      authors.set(author.id, author);
    }
  }

  return authors;
}

export function applyClaimVisibilityFilters<T>(query: T): T {
  let filteredQuery = query as T & { eq(column: string, value: string | boolean): T };

  for (const filter of CLAIM_VISIBILITY_FILTERS) {
    filteredQuery = filteredQuery.eq(filter.column, filter.value) as typeof filteredQuery;
  }

  return filteredQuery as T;
}

async function mapClaimRows(rows: readonly Record<string, unknown>[]): Promise<readonly PublicClaim[]> {
  const authorIds = rows
    .map((row) => (typeof row.author_id === "string" ? row.author_id : null))
    .filter((id): id is string => Boolean(id));
  const authors = await getAuthorsById(authorIds);

  return Object.freeze(
    rows
      .map((row) => {
        const authorId = typeof row.author_id === "string" ? row.author_id : "";
        return mapClaimRow(row, authors.get(authorId));
      })
      .filter((claim): claim is PublicClaim => claim !== null),
  );
}

async function readClaimList(orderColumn: "created_at" | "total_votes", limit: number): Promise<readonly PublicClaim[]> {
  const supabase = createPublicClient();
  let query = supabase.from("claims").select(claimSelect);
  query = applyClaimVisibilityFilters(query);

  const { data, error } = await query
    .order(orderColumn, { ascending: false, nullsFirst: false })
    .limit(Math.max(1, Math.min(20, limit)));

  if (error) {
    throw new ClaimReadError();
  }

  return mapClaimRows((data ?? []) as unknown as Record<string, unknown>[]);
}

export async function getPublicHomeClaims(): Promise<PublicHomeClaims> {
  const [recent, trending] = await Promise.all([
    readClaimList("created_at", 6),
    readClaimList("total_votes", 6),
  ]);

  return Object.freeze({ recent, trending });
}

export async function getFeedClaims(requestedPage: number, blockedAuthorIds: readonly string[] = []): Promise<FeedClaimsPage> {
  const pageResult = pageSchema.safeParse(requestedPage);
  const page = pageResult.success ? pageResult.data : 1;
  const offset = (page - 1) * FEED_PAGE_SIZE;
  const supabase = createPublicClient();

  let query = supabase.from("claims").select(claimSelect, { count: "exact" });
  query = applyClaimVisibilityFilters(query);
  const validBlockedIds = [...new Set(blockedAuthorIds)].filter(isValidClaimId).slice(0, 1_000);
  if (validBlockedIds.length > 0) {
    query = query.not("author_id", "in", `(${validBlockedIds.join(",")})`);
  }

  const { data, error, count } = await query
    .order("created_at", { ascending: false })
    .range(offset, offset + FEED_PAGE_SIZE - 1);

  if (error) {
    throw new ClaimReadError();
  }

  const rawRows = (data ?? []) as unknown as Record<string, unknown>[];
  const claims = await mapClaimRows(rawRows);

  return Object.freeze({
    claims,
    page,
    pageSize: FEED_PAGE_SIZE,
    hasPreviousPage: page > 1,
    hasNextPage: count === null ? rawRows.length === FEED_PAGE_SIZE : offset + rawRows.length < count,
  });
}

async function resolveClaimId(identifier: string): Promise<string | null> {
  const normalized = identifier.trim().toLowerCase();

  if (!isValidPublicIdentifier(normalized)) {
    return null;
  }

  if (isValidClaimId(normalized)) {
    return normalized;
  }

  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("claim_seo")
    .select("claim_id")
    .eq("slug", normalized)
    .order("generated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data || typeof data.claim_id !== "string") {
    return null;
  }

  return claimIdSchema.safeParse(data.claim_id).success ? data.claim_id : null;
}

export async function getClaimById(id: string): Promise<PublicClaim | null> {
  if (!isValidClaimId(id)) {
    return null;
  }

  const supabase = createPublicClient();
  let query = supabase.from("claims").select(claimSelect).eq("id", id);
  query = applyClaimVisibilityFilters(query);

  const { data, error } = await query.maybeSingle();

  if (error) {
    throw new ClaimReadError();
  }

  if (!data) {
    return null;
  }

  const claims = await mapClaimRows([data as unknown as Record<string, unknown>]);
  return claims[0] ?? null;
}

export async function getClaimByIdentifier(identifier: string): Promise<PublicClaim | null> {
  const claimId = await resolveClaimId(identifier);
  return claimId ? getClaimById(claimId) : null;
}

function mapSeoRow(row: unknown): ClaimSeoMetadata | null {
  const result = rawSeoSchema.safeParse(row);

  if (!result.success) {
    return null;
  }

  return Object.freeze({
    claimId: result.data.claim_id,
    slug: result.data.slug,
    metaTitle: result.data.meta_title,
    metaDescription: result.data.meta_description,
    keywords: Object.freeze(result.data.keywords),
    openGraphTitle: result.data.og_title,
    openGraphDescription: result.data.og_description,
    version: result.data.version,
    generatedAt: result.data.generated_at,
  });
}

export async function getClaimSeoById(claimId: string): Promise<ClaimSeoMetadata | null> {
  if (!isValidClaimId(claimId)) {
    return null;
  }

  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("claim_seo")
    .select(seoSelect)
    .eq("claim_id", claimId)
    .order("generated_at", { ascending: false });

  if (error) {
    return null;
  }

  const rows = (data ?? []).map(mapSeoRow).filter((row): row is ClaimSeoMetadata => row !== null);
  return rows.find((row) => row.version === "finalization") ?? rows[0] ?? null;
}

async function getEvidenceByClaimId(claimId: string): Promise<readonly PublicEvidence[]> {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("evidence")
    .select(evidenceSelect)
    .eq("claim_id", claimId)
    .eq("hidden", false)
    .order("created_at", { ascending: false });

  if (error) {
    return Object.freeze([]);
  }

  const parsedRows = (data ?? [])
    .map((row) => rawEvidenceSchema.safeParse(row))
    .filter((result) => result.success)
    .map((result) => result.data);
  const contributorIds = parsedRows
    .map((row) => row.user_id)
    .filter((id): id is string => Boolean(id));
  const contributors = await getAuthorsById(contributorIds);

  return Object.freeze(
    parsedRows.map((row) =>
      Object.freeze({
        id: row.id,
        contributorId: row.user_id,
        contributorName: row.user_id
          ? contributors.get(row.user_id)?.displayName ?? "FactFight contributor"
          : "FactFight contributor",
        type: row.evidence_type,
        url: row.url,
        note: row.note,
        imageUrl: row.image_url,
        thumbnailUrl: row.thumbnail_url,
        sourceQualityLabel: row.source_quality_label,
        sourceQualityScore: row.source_quality_score,
        sourceQualityReason: row.source_quality_reason,
        createdAt: row.created_at,
      }),
    ),
  );
}

export async function getClaimPageData(identifier: string): Promise<PublicClaimPageData | null> {
  const claim = await getClaimByIdentifier(identifier);

  if (!claim) {
    return null;
  }

  const [evidence, seo] = await Promise.all([
    getEvidenceByClaimId(claim.id),
    getClaimSeoById(claim.id),
  ]);

  return Object.freeze({ claim, evidence, seo });
}

export async function getClaimsByTopicId(topicId: string, limit = 100): Promise<readonly PublicClaim[]> {
  if (!isValidClaimId(topicId)) {
    return Object.freeze([]);
  }

  const supabase = createPublicClient();
  let query = supabase.from("claims").select(claimSelect).eq("topic_cluster_id", topicId);
  query = applyClaimVisibilityFilters(query);

  const { data, error } = await query
    .order("created_at", { ascending: false })
    .limit(Math.max(1, Math.min(100, limit)));

  if (error) {
    throw new ClaimReadError();
  }

  return mapClaimRows((data ?? []) as unknown as Record<string, unknown>[]);
}

export async function getClaimsByAuthorId(authorId: string, limit = 100): Promise<readonly PublicClaim[]> {
  if (!isValidClaimId(authorId)) {
    return Object.freeze([]);
  }

  const supabase = createPublicClient();
  let query = supabase.from("claims").select(claimSelect).eq("author_id", authorId);
  query = applyClaimVisibilityFilters(query);

  const { data, error } = await query
    .order("created_at", { ascending: false })
    .limit(Math.max(1, Math.min(100, limit)));

  if (error) {
    throw new ClaimReadError();
  }

  return mapClaimRows((data ?? []) as unknown as Record<string, unknown>[]);
}

export async function getClaimsByIds(claimIds: readonly string[]): Promise<readonly PublicClaim[]> {
  const validIds = [...new Set(claimIds)].filter(isValidClaimId).slice(0, 100);
  if (validIds.length === 0) return Object.freeze([]);

  const supabase = createPublicClient();
  let query = supabase.from("claims").select(claimSelect).in("id", validIds);
  query = applyClaimVisibilityFilters(query);
  const { data, error } = await query.limit(validIds.length);

  if (error) throw new ClaimReadError();

  const claims = await mapClaimRows((data ?? []) as unknown as Record<string, unknown>[]);
  const claimById = new Map(claims.map((claim) => [claim.id, claim]));
  return Object.freeze(validIds.map((id) => claimById.get(id)).filter((claim): claim is PublicClaim => Boolean(claim)));
}

export interface ClaimSearchOptions {
  readonly category?: string;
  readonly status?: "OPEN_VOTING" | "FINALIZED_TRUE" | "FINALIZED_FAKE" | "NEEDS_MORE_EVIDENCE";
}

export async function searchPublicClaims(
  searchText: string,
  options: ClaimSearchOptions = {},
): Promise<readonly PublicClaim[]> {
  const normalizedSearch = searchText.trim().replace(/\s+/g, " ").toLowerCase().slice(0, 100);
  const supabase = createPublicClient();
  let query = supabase.from("claims").select(claimSelect);
  query = applyClaimVisibilityFilters(query);

  const { data, error } = await query.order("created_at", { ascending: false }).limit(250);

  if (error) {
    throw new ClaimReadError();
  }

  const rows = ((data ?? []) as unknown as Record<string, unknown>[]).filter((row) => {
    if (normalizedSearch) {
      const matches = [row.title, row.description, row.source_url, row.category, row.politician_tag]
        .filter((value): value is string => typeof value === "string")
        .some((value) => value.toLowerCase().includes(normalizedSearch));
      if (!matches) return false;
    }

    if (options.category && row.category !== options.category) return false;

    if (options.status === "OPEN_VOTING") {
      return ["OPEN", "ACTIVE", "EARLY_VERDICT", "PENDING"].includes(String(row.status ?? ""));
    }

    if (options.status && row.status !== options.status) return false;
    return true;
  });

  return mapClaimRows(rows.slice(0, 50));
}

export async function getSitemapClaimEntries(): Promise<readonly SitemapClaimEntry[]> {
  const supabase = createPublicClient();
  let claimQuery = supabase.from("claims").select("id,updated_at");
  claimQuery = applyClaimVisibilityFilters(claimQuery);

  const { data: claimRows, error: claimError } = await claimQuery
    .order("updated_at", { ascending: false })
    .limit(5_000);

  if (claimError) {
    throw new ClaimReadError();
  }

  const { data: seoRows } = await supabase
    .from("claim_seo")
    .select("claim_id,slug,version,generated_at")
    .order("generated_at", { ascending: false })
    .limit(5_000);

  const preferredSlugByClaimId = new Map<string, { slug: string; final: boolean }>();

  for (const row of seoRows ?? []) {
    if (
      typeof row.claim_id !== "string" ||
      typeof row.slug !== "string" ||
      !publicIdentifierSchema.safeParse(row.slug).success
    ) {
      continue;
    }

    const isFinal = row.version === "finalization";
    const current = preferredSlugByClaimId.get(row.claim_id);
    if (!current || (isFinal && !current.final)) {
      preferredSlugByClaimId.set(row.claim_id, { slug: row.slug, final: isFinal });
    }
  }

  return Object.freeze(
    (claimRows ?? [])
      .filter((row) => typeof row.id === "string" && claimIdSchema.safeParse(row.id).success)
      .map((row) =>
        Object.freeze({
          id: row.id,
          slug: preferredSlugByClaimId.get(row.id)?.slug ?? null,
          updatedAt:
            typeof row.updated_at === "string" && !Number.isNaN(new Date(row.updated_at).getTime())
              ? row.updated_at
              : null,
        }),
      ),
  );
}
