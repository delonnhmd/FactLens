import "server-only";

import { z } from "zod";

import { mapClaimRow, mapPublicAuthorRow } from "@/lib/api/claim-mappers";
import { createClient } from "@/lib/supabase/server";
import type { PublicClaim } from "@/lib/types/claim";
import type { FeedClaimsPage } from "@/lib/types/feed";
import type { PublicClaimAuthor } from "@/lib/types/profile";
import { FEED_PAGE_SIZE, MAX_FEED_PAGE } from "@/lib/utils/pagination";

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
const claimIdSchema = z.uuid();
const pageSchema = z.number().int().min(1).max(MAX_FEED_PAGE);

export class ClaimReadError extends Error {
  constructor() {
    super("Claims are temporarily unavailable. Please try again.");
    this.name = "ClaimReadError";
  }
}

export function isValidClaimId(value: string): boolean {
  return claimIdSchema.safeParse(value).success;
}

async function getAuthorsById(authorIds: readonly string[]): Promise<Map<string, PublicClaimAuthor>> {
  const uniqueAuthorIds = [...new Set(authorIds)].filter((id) => claimIdSchema.safeParse(id).success);

  if (uniqueAuthorIds.length === 0) {
    return new Map();
  }

  const supabase = await createClient();
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

function applyVisibilityFilters<T>(query: T): T {
  let filteredQuery = query as T & { eq(column: string, value: string | boolean): T };

  for (const filter of CLAIM_VISIBILITY_FILTERS) {
    filteredQuery = filteredQuery.eq(filter.column, filter.value) as typeof filteredQuery;
  }

  return filteredQuery as T;
}

export async function getFeedClaims(requestedPage: number): Promise<FeedClaimsPage> {
  const pageResult = pageSchema.safeParse(requestedPage);
  const page = pageResult.success ? pageResult.data : 1;
  const offset = (page - 1) * FEED_PAGE_SIZE;
  const supabase = await createClient();

  let query = supabase.from("claims").select(claimSelect, { count: "exact" });
  query = applyVisibilityFilters(query);

  const { data, error, count } = await query
    .order("created_at", { ascending: false })
    .range(offset, offset + FEED_PAGE_SIZE - 1);

  if (error) {
    throw new ClaimReadError();
  }

  const rawRows = data ?? [];
  const authorIds = rawRows
    .map((row) => (typeof row.author_id === "string" ? row.author_id : null))
    .filter((id): id is string => Boolean(id));
  const authors = await getAuthorsById(authorIds);
  const claims = rawRows
    .map((row) => {
      const authorId = typeof row.author_id === "string" ? row.author_id : "";
      return mapClaimRow(row, authors.get(authorId));
    })
    .filter((claim): claim is PublicClaim => claim !== null);

  return Object.freeze({
    claims: Object.freeze(claims),
    page,
    pageSize: FEED_PAGE_SIZE,
    hasPreviousPage: page > 1,
    hasNextPage: count === null ? rawRows.length === FEED_PAGE_SIZE : offset + rawRows.length < count,
  });
}

export async function getClaimById(id: string): Promise<PublicClaim | null> {
  if (!isValidClaimId(id)) {
    return null;
  }

  const supabase = await createClient();
  let query = supabase.from("claims").select(claimSelect).eq("id", id);
  query = applyVisibilityFilters(query);

  const { data, error } = await query.maybeSingle();

  if (error) {
    throw new ClaimReadError();
  }

  if (!data) {
    return null;
  }

  const authorId = typeof data.author_id === "string" ? data.author_id : "";
  const authors = await getAuthorsById(authorId ? [authorId] : []);

  return mapClaimRow(data, authors.get(authorId));
}
