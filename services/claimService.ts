// PHASE 3 STEP 3
import { supabase } from "../lib/supabase";
import { DEFAULT_VERIFICATION_MODE, getVerificationModeConfig } from "../constants/verificationConfig";
import { generateClaimShareUrl, generateClaimSlug } from "./claimLinks";
import { getExpiresAt, getVoteWindowClosesAt } from "./claimVoting";
import { calculateTrendingScore } from "./trending";
import { detectVideoPlatform, getYouTubeThumbnailUrl } from "../utils/videoUrl";
import {
  buildVerificationResponse,
  calculateClaimVerificationResult,
  getVerificationVerdictReason,
  getVerdictPublishesAt,
  mapVerificationVerdictToStatus,
} from "./verificationEngine";
import type { Claim, ClaimStatus, AiCheck } from "../types/claim";
import type { SourceQuality, VerificationMode, VerificationVote } from "../types/verification";
import type { User as AppUser } from "../types/user";
import type { Profile } from "./profileService";

type ClaimAiStatus = AiCheck["status"];

// PHASE 3 STEP 9
export type ClaimFeedFilter =
  | "ALL"
  | "OPEN_VOTING"
  | "COMMUNITY_TRUE"
  | "COMMUNITY_FAKE"
  | "NEEDS_MORE_EVIDENCE"
  | "FLAGGED"
  | "HAS_IMAGE"
  | "HAS_VIDEO";

export interface ClaimSearchFilters {
  category?: string | null;
  filter?: ClaimFeedFilter;
  limit?: number;
}

// PHASE 3 STEP 10
interface AutomaticVerdictResult {
  status: Extract<ClaimStatus, "COMMUNITY_TRUE" | "COMMUNITY_FAKE" | "NEEDS_MORE_EVIDENCE">;
  resultLabel: string;
  reason: string;
  totalVotes: number;
}

interface ClaimProfileRow {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  verified: boolean;
  reputation_score: number;
  votes_cast?: number | null;
  accuracy_rate?: number | null;
  trust_tier?: string | null;
  trust_weight_override?: number | null;
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
  // PHASE 3 STEP 10
  verdict_reason: string | null;
  verdict_calculated_at: string | null;
  total_votes: number | null;
  // PHASE 3 STEP 17
  mode?: string | null;
  current_phase?: number | null;
  vote_accept_until?: string | null;
  score_lock_at?: string | null;
  published_at?: string | null;
  phase4_locked?: boolean | null;
  early_verdict_fired?: boolean | null;
  suspicious_activity?: boolean | null;
  weighted_community_score?: number | null;
  final_score?: number | null;
  min_votes_required?: number | null;
  expected_participation?: number | null;
  source_count?: number | null;
  source_quality?: string | null;
  red_flags?: string[] | null;
  ai_summary?: string | null;
  created_at: string;
  expires_at: string;
  updated_at: string;
  profiles?: ClaimProfileRow | ClaimProfileRow[] | null;
}

interface VerificationVoteRow {
  id: string;
  user_id: string;
  vote_type: string;
  vote_value: number | null;
  trust_weight: number | null;
  accepted: boolean | null;
  suspicious: boolean | null;
  rejected_reason: string | null;
  created_at: string;
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

const DEFAULT_CLAIM_LIMIT = 50;
// PHASE 3 STEP 11
export const DEFAULT_CLAIMS_PAGE_SIZE = 20;

const CLAIM_SELECT = `
  *,
  profiles:author_id (
    id,
    username,
    display_name,
    avatar_url,
    verified,
    reputation_score,
    votes_cast,
    accuracy_rate,
    trust_tier,
    trust_weight_override,
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

// PHASE 3 STEP 17
function mapVerificationMode(mode: string | null | undefined): VerificationMode {
  return mode === "production" ? "production" : "test";
}

function mapSourceQuality(sourceQuality: string | null | undefined): SourceQuality {
  if (
    sourceQuality === "official" ||
    sourceQuality === "mainstream" ||
    sourceQuality === "blog" ||
    sourceQuality === "unknown"
  ) {
    return sourceQuality;
  }

  return "unknown";
}

function mapTrustTier(tier: string | null | undefined): AppUser["trustTier"] {
  if (
    tier === "new" ||
    tier === "regular" ||
    tier === "verified" ||
    tier === "high_accuracy" ||
    tier === "expert"
  ) {
    return tier;
  }

  return "new";
}

// PHASE 3 STEP 9
function cleanSearchTerm(query: string): string {
  return query
    .trim()
    .replace(/[%,()]/g, " ")
    .replace(/\s+/g, " ");
}

function getSearchExpression(query: string): string {
  const searchTerm = cleanSearchTerm(query);
  return [
    `title.ilike.%${searchTerm}%`,
    `description.ilike.%${searchTerm}%`,
    `source_url.ilike.%${searchTerm}%`,
    `category.ilike.%${searchTerm}%`,
  ].join(",");
}

// PHASE 3 STEP 10
export function calculateAutomaticVerdict(
  claim: Pick<Claim, "id" | "createdAt" | "aiCheck" | "votesTrue" | "votesFake" | "votesUnsure">,
): AutomaticVerdictResult {
  const verificationResult = calculateClaimVerificationResult(claim);
  const status = mapVerificationVerdictToStatus(verificationResult.verdict);
  const labels: Record<AutomaticVerdictResult["status"], string> = {
    COMMUNITY_TRUE: "Community Says True",
    COMMUNITY_FAKE: "Community Says Fake",
    NEEDS_MORE_EVIDENCE: "Needs More Evidence",
  };

  return {
    status,
    resultLabel: labels[status],
    reason: getVerificationVerdictReason(verificationResult),
    totalVotes: claim.votesTrue + claim.votesFake + claim.votesUnsure,
  };
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
    votesCast: profile?.votes_cast ?? 0,
    accuracyRate: profile?.accuracy_rate ?? null,
    trustTier: mapTrustTier(profile?.trust_tier),
    trustWeightOverride: profile?.trust_weight_override ?? null,
  };
}

export function mapClaimRowToClaim(row: ClaimRow): Claim {
  const author = mapAuthor(row);
  const videoUrl = row.video_url ?? "";
  // PHASE 3 STEP 8
  const videoPlatform = videoUrl ? detectVideoPlatform(videoUrl) : null;
  const youtubeThumbnailUrl = videoUrl ? getYouTubeThumbnailUrl(videoUrl) : null;
  // PHASE 3 STEP 10
  const totalVotes = row.total_votes ?? (row.votes_true ?? 0) + (row.votes_fake ?? 0) + (row.votes_unsure ?? 0);
  // PHASE 3 STEP 17
  const mode = mapVerificationMode(row.mode);
  const modeConfig = getVerificationModeConfig(mode);
  const voteAcceptUntil = row.vote_accept_until ?? getVoteWindowClosesAt(row.created_at, mode);
  const scoreLockAt = row.score_lock_at ?? row.expires_at ?? getVerdictPublishesAt(row.created_at, mode);
  const aiCheck = {
    status: mapAiStatus(row.ai_status),
    confidence: row.ai_confidence,
    reason: row.ai_reason,
  };
  const engineResult = calculateClaimVerificationResult(
    {
      id: row.id,
      createdAt: row.created_at,
      aiCheck,
      votesTrue: row.votes_true ?? 0,
      votesFake: row.votes_fake ?? 0,
      votesUnsure: row.votes_unsure ?? 0,
    },
    mode,
  );

  return {
    id: row.id,
    slug: row.slug ?? generateClaimSlug(row.title),
    shareUrl: row.share_url ?? generateClaimShareUrl(row.id),
    title: row.title,
    description: row.description,
    sourceUrl: row.source_url,
    media: {
      imageUrl: row.image_url,
      videoUrl: videoUrl && videoPlatform !== "YouTube" ? videoUrl : null,
      youtubeUrl: videoUrl && videoPlatform === "YouTube" ? videoUrl : null,
      videoPlatform,
      youtubeThumbnailUrl,
    },
    aiCheck,
    category: row.category ?? "Other",
    votesTrue: row.votes_true ?? 0,
    votesFake: row.votes_fake ?? 0,
    votesUnsure: row.votes_unsure ?? 0,
    // PHASE 3 STEP 10
    totalVotes,
    verdictReason: row.verdict_reason ?? null,
    verdictCalculatedAt: row.verdict_calculated_at ?? null,
    mode,
    currentPhase: row.current_phase ?? engineResult.current_phase,
    voteAcceptUntil,
    scoreLockAt,
    publishedAt: row.published_at ?? null,
    phase4Locked: row.phase4_locked ?? engineResult.phase4_locked,
    earlyVerdictFired: row.early_verdict_fired ?? engineResult.early_verdict_fired,
    suspiciousActivity: row.suspicious_activity ?? engineResult.suspicious_activity,
    weightedCommunityScore: row.weighted_community_score ?? engineResult.weighted_community_score,
    finalScore: row.final_score ?? engineResult.final_score,
    minVotesRequired: row.min_votes_required ?? modeConfig.minVotes,
    expectedParticipation: row.expected_participation ?? modeConfig.expectedParticipation,
    sourceCount: row.source_count ?? 0,
    sourceQuality: mapSourceQuality(row.source_quality),
    redFlags: row.red_flags ?? [],
    aiSummary: row.ai_summary ?? row.ai_reason ?? null,
    status: mapStatus(row.status),
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    userVote: null,
    evidence: [],
    // PHASE 3 STEP 5
    evidenceCount: row.evidence_count ?? 0,
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
  // PHASE 3 STEP 17
  const mode = DEFAULT_VERIFICATION_MODE;
  const modeConfig = getVerificationModeConfig(mode);
  const scoreLockAt = getExpiresAt(createdAt, mode);

  return {
    author_id: input.authorId,
    created_at: createdAt,
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
    // PHASE 3 STEP 10
    total_votes: 0,
    verdict_reason: null,
    verdict_calculated_at: null,
    status: "OPEN",
    ai_status: "PENDING",
    ai_confidence: null,
    ai_reason: null,
    report_count: 0,
    evidence_count: 0,
    is_flagged: false,
    mode,
    current_phase: 0,
    vote_accept_until: getVoteWindowClosesAt(createdAt, mode),
    score_lock_at: scoreLockAt,
    published_at: null,
    phase4_locked: false,
    early_verdict_fired: false,
    suspicious_activity: false,
    weighted_community_score: 0.5,
    final_score: 0.5,
    min_votes_required: modeConfig.minVotes,
    expected_participation: modeConfig.expectedParticipation,
    source_count: 0,
    source_quality: "unknown",
    red_flags: [],
    ai_summary: null,
    expires_at: scoreLockAt,
  };
}

// PHASE 3 STEP 17
function mapVoteRowToVerificationVote(row: VerificationVoteRow): VerificationVote {
  return {
    id: row.id,
    userId: row.user_id,
    vote: row.vote_type === "TRUE" ? "TRUE" : row.vote_type === "FAKE" ? "FAKE" : "NOT_SURE",
    createdAt: row.created_at,
    voteValue: row.vote_value,
    trustWeight: row.trust_weight ?? 1,
    manualTrustWeight: row.trust_weight ?? 1,
    accepted: row.accepted ?? true,
    suspicious: row.suspicious ?? false,
    rejectedReason: row.rejected_reason,
  };
}

async function fetchVerificationVotesForClaim(claimId: string): Promise<{ votes: VerificationVote[]; error?: string }> {
  const { data, error } = await supabase
    .from("votes")
    .select("id,user_id,vote_type,vote_value,trust_weight,accepted,suspicious,rejected_reason,created_at")
    .eq("claim_id", claimId);

  if (error) {
    return {
      votes: [],
      error: getClaimServiceErrorMessage(error.message),
    };
  }

  return {
    votes: ((data ?? []) as VerificationVoteRow[])
      .filter((vote) => vote.accepted ?? true)
      .map(mapVoteRowToVerificationVote),
  };
}

export async function fetchClaims(): Promise<ClaimsResult> {
  return fetchLatestClaims();
}

// PHASE 3 STEP 9
export async function fetchLatestClaims(limit = DEFAULT_CLAIM_LIMIT): Promise<ClaimsResult> {
  // PHASE 3 STEP 11
  return fetchLatestClaimsPage(limit, 0);
}

// PHASE 3 STEP 11
export async function fetchLatestClaimsPage(
  limit = DEFAULT_CLAIMS_PAGE_SIZE,
  offset = 0,
): Promise<ClaimsResult> {
  const { data, error } = await supabase
    .from("claims")
    .select(CLAIM_SELECT)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

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

// PHASE 3 STEP 9
export async function searchClaims(query: string, filters: ClaimSearchFilters = {}): Promise<ClaimsResult> {
  // PHASE 3 STEP 11
  return searchClaimsPage(query, filters, filters.limit ?? DEFAULT_CLAIM_LIMIT, 0);
}

// PHASE 3 STEP 11
export async function searchClaimsPage(
  query: string,
  filters: ClaimSearchFilters = {},
  limit = DEFAULT_CLAIMS_PAGE_SIZE,
  offset = 0,
): Promise<ClaimsResult> {
  const searchTerm = cleanSearchTerm(query);
  let request = supabase.from("claims").select(CLAIM_SELECT);

  if (searchTerm) {
    request = request.or(getSearchExpression(searchTerm));
  }

  if (filters.category) {
    request = request.eq("category", filters.category);
  }

  if (filters.filter === "OPEN_VOTING") {
    request = request.eq("status", "OPEN").gt("vote_accept_until", new Date().toISOString());
  }

  if (
    filters.filter === "COMMUNITY_TRUE" ||
    filters.filter === "COMMUNITY_FAKE" ||
    filters.filter === "NEEDS_MORE_EVIDENCE"
  ) {
    request = request.eq("status", filters.filter);
  }

  if (filters.filter === "FLAGGED") {
    request = request.eq("is_flagged", true);
  }

  if (filters.filter === "HAS_IMAGE") {
    request = request.not("image_url", "is", null);
  }

  if (filters.filter === "HAS_VIDEO") {
    request = request.not("video_url", "is", null);
  }

  const { data, error } = await request
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

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

// PHASE 3 STEP 9
export async function fetchClaimsByCategory(category: string): Promise<ClaimsResult> {
  const { data, error } = await supabase
    .from("claims")
    .select(CLAIM_SELECT)
    .eq("category", category)
    .order("created_at", { ascending: false })
    .limit(DEFAULT_CLAIM_LIMIT);

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

// PHASE 3 STEP 9
export async function fetchClaimsByStatus(status: ClaimStatus): Promise<ClaimsResult> {
  const { data, error } = await supabase
    .from("claims")
    .select(CLAIM_SELECT)
    .eq("status", status)
    .order("created_at", { ascending: false })
    .limit(DEFAULT_CLAIM_LIMIT);

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

// PHASE 3 STEP 9
export async function fetchTrendingClaims(limit = 100): Promise<ClaimsResult> {
  // PHASE 3 STEP 11
  return fetchTrendingClaimsPage(limit, 0);
}

// PHASE 3 STEP 11
export async function fetchTrendingClaimsPage(
  limit = DEFAULT_CLAIMS_PAGE_SIZE,
  offset = 0,
): Promise<ClaimsResult> {
  const { data, error } = await supabase
    .from("claims")
    .select(CLAIM_SELECT)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    return {
      claims: [],
      error: getClaimServiceErrorMessage(error.message),
    };
  }

  const claims = ((data ?? []) as ClaimRow[])
    .map(mapClaimRowToClaim)
    .sort((first, second) => calculateTrendingScore(second) - calculateTrendingScore(first));

  return {
    claims,
  };
}

// PHASE 3 STEP 10
export async function finalizeExpiredClaim(claimId: string): Promise<ClaimResult> {
  const latestClaimResult = await fetchClaimById(claimId);

  if (latestClaimResult.error || !latestClaimResult.claim) {
    return latestClaimResult;
  }

  const latestClaim = latestClaimResult.claim;

  if (
    latestClaim.status === "COMMUNITY_TRUE" ||
    latestClaim.status === "COMMUNITY_FAKE" ||
    latestClaim.status === "NEEDS_MORE_EVIDENCE"
  ) {
    return latestClaimResult;
  }

  const votesResult = await fetchVerificationVotesForClaim(claimId);

  if (votesResult.error) {
    return {
      claim: latestClaim,
      error: votesResult.error,
    };
  }

  const verificationResponse = buildVerificationResponse(latestClaim, votesResult.votes);
  const scoreLockPassed = new Date(latestClaim.scoreLockAt).getTime() <= Date.now();
  const shouldPublish = scoreLockPassed || verificationResponse.early_verdict_fired;
  const publishedStatus = mapVerificationVerdictToStatus(verificationResponse.verdict);
  const verdictReason =
    verificationResponse.vote_count < latestClaim.minVotesRequired
      ? "Minimum vote requirement was not met."
      : getVerificationVerdictReason(verificationResponse);
  const updateRow = {
    current_phase: verificationResponse.current_phase,
    phase4_locked: verificationResponse.phase4_locked,
    early_verdict_fired: verificationResponse.early_verdict_fired,
    suspicious_activity: verificationResponse.suspicious_activity,
    weighted_community_score: verificationResponse.weighted_community_score,
    final_score: verificationResponse.final_score,
    total_votes: verificationResponse.vote_count,
    ...(verificationResponse.phase4_locked && !shouldPublish ? { status: "VOTING_CLOSED" } : {}),
    ...(shouldPublish
      ? {
          status: publishedStatus,
          verdict_reason: verdictReason,
          verdict_calculated_at: new Date().toISOString(),
          published_at: new Date().toISOString(),
          phase4_locked: true,
        }
      : {}),
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase.from("claims").update(updateRow).eq("id", claimId);

  if (error) {
    return {
      claim: latestClaim,
      error: getClaimServiceErrorMessage(error.message, "save"),
    };
  }

  const refreshedClaim = await fetchClaimById(claimId);

  if (refreshedClaim.error || !refreshedClaim.claim) {
    return refreshedClaim;
  }

  return {
    claim: refreshedClaim.claim,
  };
}

// PHASE 3 STEP 10
export async function finalizeExpiredClaims(claims: Claim[]): Promise<ClaimsResult> {
  const finalizedClaims = await Promise.all(
    claims.map(async (claim) => {
      if (
        claim.status === "COMMUNITY_TRUE" ||
        claim.status === "COMMUNITY_FAKE" ||
        claim.status === "NEEDS_MORE_EVIDENCE"
      ) {
        return claim;
      }

      const result = await finalizeExpiredClaim(claim.id);

      if (result.error) {
        throw new Error(result.error);
      }

      return result.claim ?? claim;
    }),
  );

  return {
    claims: finalizedClaims,
  };
}

// PHASE 3 STEP 10
export async function refreshClaimVerdict(claimId: string): Promise<ClaimResult> {
  return finalizeExpiredClaim(claimId);
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
