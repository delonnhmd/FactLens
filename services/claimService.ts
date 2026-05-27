// PHASE 3 STEP 3
import { supabase } from "../lib/supabase";
import { generateClaimShareUrl, generateClaimSlug, isYouTubeUrl } from "./claimLinks";
import { getExpiresAt } from "./claimVoting";
import type { Claim, ClaimStatus, AiCheck } from "../types/claim";
import type { User as AppUser } from "../types/user";
import type { Profile } from "./profileService";

type ClaimAiStatus = AiCheck["status"];

interface ClaimProfileRow {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  verified: boolean;
  reputation_score: number;
  created_at: string;
}

export interface ClaimRow {
  id: string;
  author_id: string;
  title: string;
  description: string;
  source_url: string;
  video_url: string | null;
  image_url: string | null;
  category: string | null;
  slug: string | null;
  share_url: string | null;
  votes_true: number | null;
  votes_fake: number | null;
  votes_unsure: number | null;
  status: string | null;
  ai_status: string | null;
  ai_confidence: number | null;
  ai_reason: string | null;
  report_count: number | null;
  evidence_count: number | null;
  is_flagged: boolean | null;
  created_at: string;
  expires_at: string;
  updated_at: string;
  profiles?: ClaimProfileRow | ClaimProfileRow[] | null;
}

export interface CreateClaimInput {
  authorId: string;
  title: string;
  description: string;
  sourceUrl: string;
  videoUrl?: string;
  imageUrl?: string | null;
  category?: string;
  profile?: Profile | null;
}

export interface ClaimUpdates {
  title?: string;
  description?: string;
  sourceUrl?: string;
  videoUrl?: string | null;
  imageUrl?: string | null;
  category?: string;
  slug?: string | null;
  shareUrl?: string | null;
  status?: ClaimStatus;
}

interface ClaimResult {
  claim: Claim | null;
  error?: string;
}

interface ClaimsResult {
  claims: Claim[];
  error?: string;
}

const CLAIM_SELECT = `
  *,
  profiles:author_id (
    id,
    username,
    display_name,
    avatar_url,
    verified,
    reputation_score,
    created_at
  )
`;

function getClaimServiceErrorMessage(message: string, action: "load" | "save" | "delete" = "load"): string {
  const normalizedMessage = message.toLowerCase();

  if (normalizedMessage.includes("row-level security")) {
    return action === "load" ? "You are not allowed to load this claim." : "You are not allowed to save this claim.";
  }

  if (action === "save") {
    return "We could not save this claim. Please try again.";
  }

  if (action === "delete") {
    return "We could not delete this claim. Please try again.";
  }

  return "We could not load claims right now. Please try again.";
}

function mapStatus(status: string | null): ClaimStatus {
  if (
    status === "OPEN" ||
    status === "VOTING_CLOSED" ||
    status === "COMMUNITY_TRUE" ||
    status === "COMMUNITY_FAKE" ||
    status === "NEEDS_MORE_EVIDENCE"
  ) {
    return status;
  }

  return "OPEN";
}

function mapAiStatus(status: string | null): ClaimAiStatus {
  if (
    status === "PENDING" ||
    status === "LIKELY_TRUE" ||
    status === "LIKELY_FAKE" ||
    status === "NEEDS_MORE_EVIDENCE"
  ) {
    return status;
  }

  return "PENDING";
}

function getEmbeddedProfile(row: ClaimRow): ClaimProfileRow | null {
  if (Array.isArray(row.profiles)) {
    return row.profiles[0] ?? null;
  }

  return row.profiles ?? null;
}

function mapAuthor(row: ClaimRow): AppUser {
  const profile = getEmbeddedProfile(row);
  const username = profile?.username ?? `user_${row.author_id.slice(0, 8)}`;
  const displayName = profile?.display_name || username;

  return {
    id: row.author_id,
    username,
    displayName,
    avatar: profile?.avatar_url ?? null,
    verified: profile?.verified ?? false,
    reputationScore: profile?.reputation_score ?? 0,
    joinedAt: profile?.created_at ?? row.created_at,
  };
}

export function mapClaimRowToClaim(row: ClaimRow): Claim {
  const author = mapAuthor(row);
  const videoUrl = row.video_url ?? "";

  return {
    id: row.id,
    slug: row.slug ?? generateClaimSlug(row.title),
    shareUrl: row.share_url ?? generateClaimShareUrl(row.id),
    title: row.title,
    description: row.description,
    sourceUrl: row.source_url,
    media: {
      imageUrl: row.image_url,
      videoUrl: videoUrl && !isYouTubeUrl(videoUrl) ? videoUrl : null,
      youtubeUrl: videoUrl && isYouTubeUrl(videoUrl) ? videoUrl : null,
    },
    aiCheck: {
      status: mapAiStatus(row.ai_status),
      confidence: row.ai_confidence,
      reason: row.ai_reason,
    },
    category: row.category ?? "Other",
    votesTrue: row.votes_true ?? 0,
    votesFake: row.votes_fake ?? 0,
    votesUnsure: row.votes_unsure ?? 0,
    status: mapStatus(row.status),
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    userVote: null,
    evidence: [],
    reports: [],
    reportCount: row.report_count ?? 0,
    isFlagged: row.is_flagged ?? false,
    authorId: author.id,
    authorUsername: author.username,
    authorDisplayName: author.displayName,
    authorVerified: author.verified,
    author,
  };
}

export function mapClaimToInsert(input: CreateClaimInput) {
  const createdAt = new Date().toISOString();
  const trimmedVideoUrl = input.videoUrl?.trim() || null;

  return {
    author_id: input.authorId,
    title: input.title.trim(),
    description: input.description.trim(),
    source_url: input.sourceUrl.trim(),
    video_url: trimmedVideoUrl,
    image_url: input.imageUrl ?? null,
    category: input.category?.trim() || "Other",
    slug: generateClaimSlug(input.title),
    votes_true: 0,
    votes_fake: 0,
    votes_unsure: 0,
    status: "OPEN",
    ai_status: "PENDING",
    ai_confidence: null,
    ai_reason: null,
    report_count: 0,
    evidence_count: 0,
    is_flagged: false,
    expires_at: getExpiresAt(createdAt),
  };
}

export async function fetchClaims(): Promise<ClaimsResult> {
  const { data, error } = await supabase
    .from("claims")
    .select(CLAIM_SELECT)
    .order("created_at", { ascending: false });

  if (error) {
    return {
      claims: [],
      error: getClaimServiceErrorMessage(error.message),
    };
  }

  return {
    claims: ((data ?? []) as ClaimRow[]).map(mapClaimRowToClaim),
  };
}

export async function fetchClaimById(id: string): Promise<ClaimResult> {
  const { data, error } = await supabase.from("claims").select(CLAIM_SELECT).eq("id", id).maybeSingle();

  if (error) {
    return {
      claim: null,
      error: getClaimServiceErrorMessage(error.message),
    };
  }

  return {
    claim: data ? mapClaimRowToClaim(data as ClaimRow) : null,
  };
}

export async function createClaim(input: CreateClaimInput): Promise<ClaimResult> {
  const { data, error } = await supabase.from("claims").insert(mapClaimToInsert(input)).select(CLAIM_SELECT).single();

  if (error) {
    return {
      claim: null,
      error: getClaimServiceErrorMessage(error.message, "save"),
    };
  }

  const insertedRow = data as ClaimRow;
  const shareUrl = generateClaimShareUrl(insertedRow.id);
  const { data: updatedData } = await supabase
    .from("claims")
    .update({ share_url: shareUrl })
    .eq("id", insertedRow.id)
    .select(CLAIM_SELECT)
    .single();

  return {
    claim: mapClaimRowToClaim((updatedData as ClaimRow | null) ?? { ...insertedRow, share_url: shareUrl }),
  };
}

export async function updateClaim(id: string, updates: ClaimUpdates): Promise<ClaimResult> {
  const updateRow = {
    ...(updates.title !== undefined ? { title: updates.title.trim() } : {}),
    ...(updates.description !== undefined ? { description: updates.description.trim() } : {}),
    ...(updates.sourceUrl !== undefined ? { source_url: updates.sourceUrl.trim() } : {}),
    ...(updates.videoUrl !== undefined ? { video_url: updates.videoUrl?.trim() || null } : {}),
    ...(updates.imageUrl !== undefined ? { image_url: updates.imageUrl } : {}),
    ...(updates.category !== undefined ? { category: updates.category.trim() || "Other" } : {}),
    ...(updates.slug !== undefined ? { slug: updates.slug } : {}),
    ...(updates.shareUrl !== undefined ? { share_url: updates.shareUrl } : {}),
    ...(updates.status !== undefined ? { status: updates.status } : {}),
  };

  const { data, error } = await supabase.from("claims").update(updateRow).eq("id", id).select(CLAIM_SELECT).single();

  if (error) {
    return {
      claim: null,
      error: getClaimServiceErrorMessage(error.message, "save"),
    };
  }

  return {
    claim: mapClaimRowToClaim(data as ClaimRow),
  };
}

export async function deleteClaim(id: string): Promise<{ error?: string }> {
  const { error } = await supabase.from("claims").delete().eq("id", id);

  if (error) {
    return {
      error: getClaimServiceErrorMessage(error.message, "delete"),
    };
  }

  return {};
}
