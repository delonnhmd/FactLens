// PHASE 3 STEP 3
// PHASE 3 STEP 24
// PHASE 3 STEP 25
// PHASE 3 STEP 26
// PHASE 3 STEP 27
// PHASE 3 STEP 28
// PHASE 3 STEP 29
// PHASE 3 STEP 32
// PHASE 4 STEP 6
// PHASE 4 STEP 7
// PHASE 4 STEP 9
// PHASE 4 STEP 10
// PHASE 4 STEP 12
// PHASE 4 STEP 13
// PHASE 4 STEP 17
// PHASE 4 STEP 18
// PHASE 4 STEP 22
// PHASE 5 STEP 4
// PHASE 5 STEP 6
import { supabase } from "../lib/supabase";
import { APP_CONFIG } from "../constants/appConfig";
import { VERIFICATION_MODE, getVerificationModeConfig } from "../constants/verificationConfig";
import { generateClaimShareUrl, generateClaimSlug } from "./claimLinks";
import { calculateTrendingScore } from "./trending";
import { detectVideoPlatform, getYouTubeThumbnailUrl } from "../utils/videoUrl";
import { normalizeUrl } from "../utils/url";
import { cleanSourceReviewText, formatErrorForDisplay, getDebugErrorParts } from "../utils/debugError";
import {
  createClaimTiming,
  createProductionModeTiming,
  createTestModeTiming,
  getScoreLockAt,
  getVoteAcceptUntil,
} from "../utils/verificationTiming";
import {
  buildVerificationResponse,
  calculateClaimVerificationResult,
  getVerificationVerdictReason,
  mapVerificationVerdictToStatus,
} from "./verificationEngine";
import type { Claim, ClaimStatus, AiCheck, ClaimType } from "../types/claim";
import type { SourceQuality, VerificationMode, VerificationVote } from "../types/verification";
import type { User as AppUser } from "../types/user";
import { ensureProfileForUser, type Profile } from "./profileService";
import { getDisplayRankTitle, parseBadgeList } from "../utils/reputation";
import { normalizeProfileVisibility } from "../utils/publicProfile";
import { uploadClaimImage, type PickedOptimizedImage } from "./imageUploadService";

type ClaimAiStatus = AiCheck["status"];

// PHASE 3 STEP 9
export type ClaimFeedFilter =
  | "ALL"
  | "OPEN_VOTING"
  | "FINALIZED_TRUE"
  | "FINALIZED_FAKE"
  | "INSUFFICIENT_DATA"
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
  // PHASE 4 STEP 26
  status: Extract<
    ClaimStatus,
    "FINALIZED_TRUE" | "FINALIZED_FAKE" | "INSUFFICIENT_DATA" | "NEEDS_MORE_EVIDENCE" | "COMMUNITY_TRUE" | "COMMUNITY_FAKE"
  >;
  resultLabel: string;
  reason: string;
  totalVotes: number;
}

interface ClaimProfileRow {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  // PHASE 5 STEP 1E
  bio?: string | null;
  public_profile_slug?: string | null;
  profile_visibility?: string | null;
  verified: boolean;
  reputation_score: number;
  votes_cast?: number | null;
  accuracy_rate?: number | null;
  trust_tier?: string | null;
  trust_weight_override?: number | null;
  // PHASE 5 STEP 1
  trust_score?: number | null;
  rank_title?: string | null;
  correct_votes?: number | null;
  incorrect_votes?: number | null;
  evidence_count?: number | null;
  helpful_evidence_count?: number | null;
  suspicious_flags?: number | null;
  reputation_points?: number | null;
  badge_list?: unknown;
  last_active_at?: string | null;
  highest_rank_achieved?: string | null;
  monthly_reputation_points?: number | null;
  monthly_reset_at?: string | null;
  is_deleted?: boolean | null;
  deleted_at?: string | null;
  created_at?: string | null;
}

export interface ClaimRow {
  id?: string | null;
  author_id?: string | null;
  title?: string | null;
  description?: string | null;
  source_url?: string | null;
  video_url: string | null;
  image_url: string | null;
  // PHASE 5 STEP 6
  image_path?: string | null;
  thumbnail_url?: string | null;
  category: string | null;
  // PHASE 5 election positioning UI
  sub_category?: string | null;
  politician_tag?: string | null;
  slug: string | null;
  share_url: string | null;
  votes_true: number | null;
  votes_fake: number | null;
  votes_unsure: number | null;
  status: string | null;
  // PHASE 4 STEP 7
  claim_type?: string | null;
  ai_status: string | null;
  ai_confidence: number | null;
  ai_reason: string | null;
  report_count: number | null;
  evidence_count: number | null;
  evidence_used_count?: number | null;
  is_flagged: boolean | null;
  // PHASE 3 STEP 10
  verdict_reason: string | null;
  verdict_calculated_at: string | null;
  total_votes: number | null;
  // PHASE 3 STEP 17
  mode?: string | null;
  current_phase?: number | null;
  // PHASE 4 STEP 26
  vote_window_minutes?: number | null;
  vote_window_end?: string | null;
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
  source_domain?: string | null;
  source_score?: number | null;
  source_reason?: string | null;
  // PHASE 4 STEP 22
  source_read_status?: string | null;
  source_page_title?: string | null;
  source_supports_claim?: boolean | null;
  source_support_summary?: string | null;
  // PHASE 5 STEP 3
  hidden?: boolean | null;
  hidden_reason?: string | null;
  hidden_at?: string | null;
  red_flags?: unknown;
  ai_summary?: string | null;
  created_at?: string | null;
  expires_at: string | null;
  updated_at?: string | null;
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
  // PHASE 5 STEP 6
  imagePath?: string | null;
  thumbnailUrl?: string | null;
  imageAsset?: PickedOptimizedImage | null;
  category?: string;
  // PHASE 5 election positioning UI
  subCategory?: string | null;
  politicianTag?: string | null;
  profile?: Profile | null;
}

export interface ClaimUpdates {
  title?: string;
  description?: string;
  sourceUrl?: string;
  videoUrl?: string | null;
  imageUrl?: string | null;
  // PHASE 5 STEP 6
  imagePath?: string | null;
  thumbnailUrl?: string | null;
  category?: string;
  // PHASE 5 election positioning UI
  subCategory?: string | null;
  politicianTag?: string | null;
  slug?: string | null;
  shareUrl?: string | null;
  status?: ClaimStatus;
}

interface ClaimResult {
  claim: Claim | null;
  error?: string;
}

export interface ClaimsResult {
  ok?: boolean;
  claims: Claim[];
  error?: string;
  errorMessage?: string;
  errorCode?: string;
  errorDetails?: string;
  errorHint?: string;
  rawError?: unknown;
}

const DEFAULT_CLAIM_LIMIT = 50;
export const CLAIMS_LOAD_ERROR_MESSAGE =
  "Unable to load claims right now. Please pull to refresh or try again shortly.";
// PHASE 3 STEP 11
export const DEFAULT_CLAIMS_PAGE_SIZE = 20;
const CLAIM_PROFILE_SELECT =
  "id,username,display_name,verified,reputation_score,avatar_url,bio,public_profile_slug,profile_visibility,votes_cast,accuracy_rate,trust_tier,trust_weight_override,trust_score,rank_title,correct_votes,incorrect_votes,evidence_count,helpful_evidence_count,suspicious_flags,reputation_points,badge_list,last_active_at,highest_rank_achieved,monthly_reputation_points,monthly_reset_at,is_deleted,deleted_at,created_at";
// BUG FIX - claim detail author profile join
const CLAIM_PROFILE_SAFE_SELECT =
  "id,username,display_name,verified,reputation_score,avatar_url,public_profile_slug,profile_visibility,trust_tier,trust_score,rank_title,reputation_points,badge_list,highest_rank_achieved";

interface SupabaseErrorLike {
  code?: string;
  message: string;
  details?: string | null;
  hint?: string | null;
}

function logClaimsFetchError(error: SupabaseErrorLike) {
  console.log("[claims fetch error]", {
    code: error.code,
    message: error.message,
    details: error.details,
    hint: error.hint,
  });
}

function logClaimsFetchErrorFull(error: unknown) {
  console.log("[CLAIMS FETCH ERROR FULL]", JSON.stringify(error, null, 2));
}

function logClaimFinalizeWarning(claimId: string, error: SupabaseErrorLike) {
  console.log("[claims finalize warning]", {
    claimId,
    code: error.code,
    message: error.message,
    details: error.details,
    hint: error.hint,
  });
}

// PHASE 5 STEP 1
async function processClaimReputation(claimId: string) {
  const { error } = await supabase.rpc("process_claim_reputation", {
    target_claim_id: claimId,
  });

  if (error) {
    console.log("[claims reputation warning]", {
      claimId,
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });
  }
}

function getClaimLoadError(error: unknown): string {
  logClaimsFetchErrorFull(error);
  logClaimsFetchError(error as SupabaseErrorLike);
  // PHASE 4 STEP 24
  void getDebugErrorParts(error);
  return "Could not load claim details.";
}

function getClaimsErrorResult(error: unknown, prefix = "Could not load claims"): ClaimsResult {
  const parts = getDebugErrorParts(error);
  const message = prefix === "Claim mapping failed" ? `${prefix}: ${parts.message}` : parts.message;

  console.log("[CLAIMS FETCH ERROR FULL]", formatErrorForDisplay(error));

  return {
    ok: false,
    claims: [],
    // PHASE 4 STEP 24
    error: CLAIMS_LOAD_ERROR_MESSAGE,
    errorMessage: message,
    errorCode: parts.code,
    errorDetails: parts.details,
    errorHint: parts.hint,
    rawError: error,
  };
}

function getClaimsSuccessResult(rows: ClaimRow[]): ClaimsResult {
  const claims = rows.map((row) => mapClaimRowToClaim(row));

  return {
    ok: true,
    claims,
  };
}

// PHASE 4 STEP 13
function removeUndefinedValues<T extends Record<string, unknown>>(payload: T): T {
  return Object.fromEntries(
    Object.entries(payload).filter(([, value]) => value !== undefined),
  ) as T;
}

// PHASE 4 STEP 13
function formatSupabaseMutationError(error: SupabaseErrorLike): string {
  // PHASE 4 STEP 24
  console.log("[create claim] friendly error from Supabase:", getDebugErrorParts(error));
  // URGENT DEBUG - create claim image insert
  const message = error.message || "";
  const details = error.details || "";
  const hint = error.hint || "";
  const combined = `${message} ${details} ${hint}`.toLowerCase();

  if (combined.includes("source_url") || combined.includes("source url")) {
    return "Please add a source URL.";
  }

  if (combined.includes("row-level security") || combined.includes("rls") || combined.includes("policy")) {
    return "You must be logged in to create a claim.";
  }

  if (combined.includes("schema cache") || combined.includes("image_path") || combined.includes("thumbnail_url")) {
    return "Could not save claim right now.";
  }

  return "Could not save claim. Please try again.";
}

// PHASE 4 STEP 12
function getUniqueAuthorIds(rows: ClaimRow[]): string[] {
  return Array.from(
    new Set(
      rows
        .map((row) => row.author_id)
        .filter((authorId): authorId is string => Boolean(authorId)),
    ),
  );
}

// PHASE 4 STEP 12
function mapProfileToClaimProfile(profile: Profile): ClaimProfileRow {
  return {
    id: profile.id,
    username: profile.username,
    display_name: profile.display_name,
    avatar_url: profile.avatar_url,
    // PHASE 5 STEP 1E
    bio: profile.bio,
    public_profile_slug: profile.public_profile_slug,
    profile_visibility: profile.profile_visibility,
    verified: profile.verified,
    reputation_score: profile.reputation_score,
    votes_cast: profile.votes_cast,
    accuracy_rate: profile.accuracy_rate,
    trust_tier: profile.trust_tier,
    trust_weight_override: profile.trust_weight_override,
    // PHASE 5 STEP 1
    trust_score: profile.trust_score,
    rank_title: profile.rank_title,
    correct_votes: profile.correct_votes,
    incorrect_votes: profile.incorrect_votes,
    evidence_count: profile.evidence_count,
    helpful_evidence_count: profile.helpful_evidence_count,
    suspicious_flags: profile.suspicious_flags,
    reputation_points: profile.reputation_points,
    badge_list: profile.badge_list,
    last_active_at: profile.last_active_at,
    highest_rank_achieved: profile.highest_rank_achieved,
    monthly_reputation_points: profile.monthly_reputation_points,
    monthly_reset_at: profile.monthly_reset_at,
    is_deleted: profile.is_deleted,
    deleted_at: profile.deleted_at,
    created_at: profile.created_at,
  };
}

// PHASE 4 STEP 12
async function mergeAuthorProfilesIntoRows(rows: ClaimRow[]): Promise<ClaimRow[]> {
  const authorIds = getUniqueAuthorIds(rows);
  console.log("[claims] author ids:", authorIds);

  if (authorIds.length === 0) {
    console.log("[claims] profiles loaded:", 0);
    return rows;
  }

  const profileResult = await supabase
    .from("profiles")
    .select(CLAIM_PROFILE_SELECT)
    .in("id", authorIds);
  let profiles = (profileResult.data ?? []) as ClaimProfileRow[];
  let profileError = profileResult.error;

  if (profileError) {
    console.log("[claims] profiles load error:", {
      code: profileError.code,
      message: profileError.message,
      details: profileError.details,
      hint: profileError.hint,
    });

    // BUG FIX - claim detail author profile join
    // Some deployed databases may not yet have newer profile columns such as
    // is_deleted/deleted_at. Retry with only the safe public author-card fields
    // instead of rendering every author without a contributor identity.
    const safeResult = await supabase
      .from("profiles")
      .select(CLAIM_PROFILE_SAFE_SELECT)
      .in("id", authorIds);

    profiles = (safeResult.data ?? []) as ClaimProfileRow[];
    profileError = safeResult.error;

    if (profileError) {
      console.log("[claims] safe profiles load error:", {
        code: profileError.code,
        message: profileError.message,
        details: profileError.details,
        hint: profileError.hint,
      });
      return rows;
    }
  }

  console.log("[claims] profiles loaded:", profiles.length);
  const profilesById = new Map(profiles.map((profile) => [profile.id, profile]));

  return rows.map((row) => {
    const profile = row.author_id ? profilesById.get(row.author_id) ?? null : null;
    console.log("CLAIM_AUTHOR_ID", row.author_id);
    console.log("AUTHOR_PROFILE", profile);
    console.log("[claim map] author profile:", profile);

    return profile ? { ...row, profiles: profile } : row;
  });
}

// PHASE 4 STEP 12
async function getClaimsSuccessResultWithProfiles(rows: ClaimRow[]): Promise<ClaimsResult> {
  return getClaimsSuccessResult(await mergeAuthorProfilesIntoRows(rows));
}

// PHASE 4 STEP 12
function attachAuthorProfile(row: ClaimRow, profile?: Profile | null): ClaimRow {
  return profile ? { ...row, profiles: mapProfileToClaimProfile(profile) } : row;
}

function getClaimServiceErrorMessage(message: string, action: "load" | "save" | "delete" = "load"): string {
  const normalizedMessage = message.toLowerCase();

  if (normalizedMessage.includes("row-level security")) {
    return action === "load" ? "You are not allowed to load this claim." : "You are not allowed to save this claim.";
  }

  if (action === "save") {
    return "Could not create claim right now.";
  }

  if (action === "delete") {
    return "Could not delete claim right now.";
  }

  if (VERIFICATION_MODE === "test" || process.env.NODE_ENV !== "production") {
    console.log("[claims load friendly error]", message);
    return CLAIMS_LOAD_ERROR_MESSAGE;
  }

  return CLAIMS_LOAD_ERROR_MESSAGE;
}

function mapStatus(status: string | null): ClaimStatus {
  if (
    status === "PENDING" ||
    status === "ACTIVE" ||
    status === "EARLY_VERDICT" ||
    status === "FINALIZED_TRUE" ||
    status === "FINALIZED_FAKE" ||
    status === "INSUFFICIENT_DATA" ||
    status === "LOCKED" ||
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

// PHASE 4 STEP 26
function isTerminalClaimStatus(status: ClaimStatus): boolean {
  return (
    status === "FINALIZED_TRUE" ||
    status === "FINALIZED_FAKE" ||
    status === "INSUFFICIENT_DATA" ||
    status === "NEEDS_MORE_EVIDENCE" ||
    status === "COMMUNITY_TRUE" ||
    status === "COMMUNITY_FAKE"
  );
}

// PHASE 4 STEP 26
function getPublishedStatus(result: ReturnType<typeof buildVerificationResponse>): ClaimStatus {
  if (!result.min_votes_met) {
    return "INSUFFICIENT_DATA";
  }

  return mapVerificationVerdictToStatus(result.verdict);
}

function mapAiStatus(status: string | null): ClaimAiStatus {
  if (
    status === "PENDING" ||
    // PHASE 4 STEP 1
    status === "LOW_RISK" ||
    status === "MEDIUM_RISK" ||
    // PHASE 4 STEP 4
    status === "HIGH_RISK" ||
    status === "LIKELY_TRUE" ||
    status === "LIKELY_FAKE" ||
    status === "NEEDS_MORE_EVIDENCE" ||
    // PHASE 4 STEP 7
    status === "NOT_FACT_CHECKABLE" ||
    // PHASE 4 STEP 3
    status === "ERROR"
  ) {
    return status;
  }

  return "PENDING";
}

// PHASE 4 STEP 7
function mapClaimType(claimType: string | null | undefined): ClaimType {
  if (
    claimType === "FACTUAL" ||
    claimType === "OPINION" ||
    claimType === "SATIRE" ||
    claimType === "QUESTION" ||
    claimType === "PROMOTION" ||
    claimType === "UNCLEAR"
  ) {
    return claimType;
  }

  return "UNCLEAR";
}

// PHASE 3 STEP 17
function mapVerificationMode(mode: string | null | undefined): VerificationMode {
  // PHASE 4 STEP 26
  if (mode === "test" || mode === "production") {
    return mode;
  }

  return VERIFICATION_MODE;
}

// PHASE 4 STEP 17
const ALLOWED_SOURCE_QUALITIES = ["official", "mainstream", "specialized", "social", "blog", "unknown"];

function mapSourceQuality(sourceQuality: string | null | undefined): SourceQuality {
  const normalizedSourceQuality = sourceQuality?.trim().toLowerCase();

  return normalizedSourceQuality && ALLOWED_SOURCE_QUALITIES.includes(normalizedSourceQuality)
    ? normalizedSourceQuality
    : "unknown";
}

// PHASE 4 STEP 22
function mapSourceReadStatus(sourceReadStatus: string | null | undefined): Claim["sourceReadStatus"] {
  const normalizedStatus = sourceReadStatus?.trim().toLowerCase();

  if (normalizedStatus === "read" || normalizedStatus === "failed" || normalizedStatus === "not_read") {
    return normalizedStatus;
  }

  return "not_read";
}

function isValidDateString(value: string | null | undefined): value is string {
  return Boolean(value && Number.isFinite(new Date(value).getTime()));
}

function getClaimExpiresAt(row: ClaimRow, fallbackScoreLockAt: string): string {
  return isValidDateString(row.expires_at) ? row.expires_at : fallbackScoreLockAt;
}

function mapStringList(value: unknown): string[] {
  // PHASE 4 STEP 6
  if (Array.isArray(value)) {
    return value.map((item) => String(item)).filter(Boolean);
  }

  if (typeof value === "string") {
    const trimmedValue = value.trim();

    if (!trimmedValue) {
      return [];
    }

    try {
      const parsed = JSON.parse(trimmedValue) as unknown;
      return Array.isArray(parsed) ? parsed.map((item) => String(item)).filter(Boolean) : [trimmedValue];
    } catch {
      return [trimmedValue];
    }
  }

  return [];
}

function mapTrustTier(tier: string | null | undefined): AppUser["trustTier"] {
  if (
    tier === "new" ||
    tier === "new_user" ||
    tier === "regular" ||
    tier === "verified" ||
    tier === "high_accuracy" ||
    tier === "expert" ||
    // PHASE 5 STEP 1
    tier === "LOW_TRUST" ||
    tier === "BASIC" ||
    tier === "TRUSTED" ||
    tier === "HIGH_TRUST"
  ) {
    return tier;
  }

  return "BASIC";
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
  // PHASE 4 STEP 26
  const status =
    !verificationResult.min_votes_met && verificationResult.time_remaining_seconds === 0
      ? "INSUFFICIENT_DATA"
      : mapVerificationVerdictToStatus(verificationResult.verdict);
  const labels: Record<AutomaticVerdictResult["status"], string> = {
    FINALIZED_TRUE: "Finalized True",
    FINALIZED_FAKE: "Finalized Fake",
    INSUFFICIENT_DATA: "Insufficient Data",
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
  // PHASE 4 STEP 12
  const authorId = row.author_id ?? "unknown-author";
  const profile = getEmbeddedProfile(row);
  const isDeleted = Boolean(profile?.is_deleted);
  const username = isDeleted ? "deleted_user" : profile?.username ?? "contributor";
  const displayName = isDeleted ? "Deleted User" : profile?.display_name || profile?.username || "Verifact contributor";
  const createdAt = row.created_at ?? new Date().toISOString();
  // PHASE 5 STEP 1
  const badgeList = parseBadgeList(profile?.badge_list);
  const trustScore = profile?.trust_score ?? 50;
  const rankTitle = getDisplayRankTitle({
    trustScore,
    rankTitle: profile?.rank_title,
    highestRankAchieved: profile?.highest_rank_achieved,
  });

  return {
    id: authorId,
    username,
    displayName,
    avatar: profile?.avatar_url ?? null,
    // PHASE 5 STEP 1E
    bio: isDeleted ? null : profile?.bio ?? null,
    publicProfileSlug: isDeleted ? null : profile?.public_profile_slug ?? username,
    profileVisibility: isDeleted ? "private" : normalizeProfileVisibility(profile?.profile_visibility),
    verified: isDeleted ? false : profile?.verified ?? false,
    reputationScore: profile?.reputation_points ?? profile?.reputation_score ?? 0,
    joinedAt: profile?.created_at ?? createdAt,
    votesCast: profile?.votes_cast ?? 0,
    accuracyRate: profile?.accuracy_rate ?? null,
    trustTier: mapTrustTier(profile?.trust_tier),
    trustWeightOverride: profile?.trust_weight_override ?? null,
    trustScore,
    rankTitle,
    highestRankAchieved: profile?.highest_rank_achieved ?? rankTitle,
    reputationPoints: profile?.reputation_points ?? profile?.reputation_score ?? 0,
    monthlyReputationPoints: profile?.monthly_reputation_points ?? 0,
    correctVotes: profile?.correct_votes ?? 0,
    incorrectVotes: profile?.incorrect_votes ?? 0,
    evidenceCount: profile?.evidence_count ?? 0,
    helpfulEvidenceCount: profile?.helpful_evidence_count ?? 0,
    suspiciousFlags: profile?.suspicious_flags ?? 0,
    badgeList,
    lastActiveAt: profile?.last_active_at ?? null,
    isDeleted,
    deletedAt: profile?.deleted_at ?? null,
  };
}

function mapClaimRowToClaimStrict(row: ClaimRow): Claim {
  // PHASE 3 STEP 26
  const createdAt = row.created_at ?? new Date().toISOString();
  const claimId = row.id ?? `local-${createdAt}`;
  const title = row.title ?? "";
  const description = row.description ?? "";
  const sourceUrl = row.source_url ?? "";
  const author = mapAuthor(row);
  const videoUrl = row.video_url ?? "";
  // PHASE 3 STEP 8
  const videoPlatform = videoUrl ? detectVideoPlatform(videoUrl) : null;
  const youtubeThumbnailUrl = videoUrl ? getYouTubeThumbnailUrl(videoUrl) : null;
  // PHASE 3 STEP 10
  const votesTrue = row.votes_true ?? 0;
  const votesFake = row.votes_fake ?? 0;
  const votesUnsure = row.votes_unsure ?? 0;
  const totalVotes = row.total_votes ?? votesTrue + votesFake + votesUnsure;
  // PHASE 3 STEP 17
  const mode = mapVerificationMode(row.mode);
  const modeConfig = getVerificationModeConfig(mode);
  // PHASE 3 STEP 22
  const voteAcceptUntil = getVoteAcceptUntil(row);
  const scoreLockAt = getScoreLockAt(row);
  const expiresAt = isValidDateString(row.expires_at) ? row.expires_at : scoreLockAt;
  // PHASE 4 STEP 26
  const voteWindowEnd = isValidDateString(row.vote_window_end) ? row.vote_window_end : voteAcceptUntil;
  const voteWindowMinutes =
    row.vote_window_minutes ??
    Math.max(0, Math.round((new Date(voteWindowEnd).getTime() - new Date(createdAt).getTime()) / (60 * 1000)));
  const aiFlags = mapStringList(row.red_flags);
  // PHASE 4 STEP 6
  // PHASE 4 STEP 7
  const aiStatus = mapAiStatus(row.ai_status);
  const aiConfidence = row.ai_confidence ?? null;
  const claimType = mapClaimType(row.claim_type);
  const sourceQuality = mapSourceQuality(row.source_quality);
  const sourceCount = row.source_count ?? 0;
  // PHASE 4 STEP 9
  const sourceDomain = row.source_domain ?? null;
  const sourceScore = row.source_score ?? null;
  const sourceReason = cleanSourceReviewText(row.source_reason, null);
  // PHASE 4 STEP 22
  const sourceReadStatus = mapSourceReadStatus(row.source_read_status);
  const sourcePageTitle = row.source_page_title ?? null;
  const sourceSupportsClaim = typeof row.source_supports_claim === "boolean" ? row.source_supports_claim : null;
  const sourceSupportSummary = cleanSourceReviewText(row.source_support_summary);
  // PHASE 4 STEP 10
  const evidenceUsedCount = row.evidence_used_count ?? 0;
  const aiSummary = cleanSourceReviewText(row.ai_summary ?? row.ai_reason, null);
  // PHASE 3 STEP 25
  const aiCheck = {
    status: aiStatus,
    confidence: aiConfidence,
    reason: row.ai_reason ?? null,
    riskLabel: null,
    flags: aiFlags,
    missingEvidence: [],
    sourceNotes: row.ai_summary ?? null,
    checkedAt: null,
  };
  const engineResult = calculateClaimVerificationResult(
    {
      id: claimId,
      createdAt,
      aiCheck,
      votesTrue,
      votesFake,
      votesUnsure,
    },
    mode,
  );

  return {
    id: claimId,
    slug: row.slug ?? generateClaimSlug(title),
    shareUrl: row.share_url ?? generateClaimShareUrl(claimId),
    title,
    description,
    sourceUrl,
    media: {
      imageUrl: row.image_url,
      // PHASE 5 STEP 6
      imagePath: row.image_path ?? null,
      thumbnailUrl: row.thumbnail_url ?? row.image_url ?? null,
      videoUrl: videoUrl && videoPlatform !== "YouTube" ? videoUrl : null,
      youtubeUrl: videoUrl && videoPlatform === "YouTube" ? videoUrl : null,
      videoPlatform,
      youtubeThumbnailUrl,
    },
    aiCheck,
    aiStatus,
    aiConfidence,
    claimType,
    category: row.category ?? "Other",
    // PHASE 5 election positioning UI
    subCategory: row.sub_category ?? null,
    politicianTag: row.politician_tag ?? null,
    votesTrue,
    votesFake,
    votesUnsure,
    // PHASE 3 STEP 10
    totalVotes,
    verdictReason: row.verdict_reason ?? null,
    verdictCalculatedAt: row.verdict_calculated_at ?? null,
    mode,
    currentPhase: row.current_phase ?? engineResult.current_phase,
    voteWindowMinutes,
    voteWindowEnd,
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
    sourceCount,
    sourceQuality,
    sourceDomain,
    sourceScore,
    sourceReason,
    sourceReadStatus,
    sourcePageTitle,
    sourceSupportsClaim,
    sourceSupportSummary,
    evidenceUsedCount,
    redFlags: aiFlags,
    aiSummary,
    status: mapStatus(row.status),
    // PHASE 5 STEP 3
    hidden: Boolean(row.hidden),
    hiddenReason: row.hidden_reason ?? null,
    hiddenAt: row.hidden_at ?? null,
    createdAt,
    // PHASE 3 STEP 22
    // PHASE 3 STEP 25
    expiresAt,
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
    authorReputation: author.reputationScore,
    authorAvatarUrl: author.avatar,
    author,
  };
}

function createFallbackClaim(row: ClaimRow, error: unknown): Claim {
  const createdAt = row.created_at ?? new Date().toISOString();
  const claimId = row.id ?? `broken-${createdAt}`;
  const mode = mapVerificationMode(row.mode);
  const fallbackTiming = mode === "production" ? createProductionModeTiming(createdAt) : createTestModeTiming(createdAt);
  const scoreLockAt = row.score_lock_at ?? fallbackTiming.scoreLockAt;
  const voteAcceptUntil = row.vote_accept_until ?? row.vote_window_end ?? fallbackTiming.voteAcceptUntil;
  const voteWindowEnd = row.vote_window_end ?? voteAcceptUntil;
  const fallbackAuthor: AppUser = {
    id: row.author_id ?? "unknown-author",
    username: "contributor",
    displayName: "Verifact contributor",
    avatar: null,
    verified: false,
    reputationScore: 0,
    joinedAt: createdAt,
    votesCast: 0,
    accuracyRate: null,
    trustTier: "BASIC",
    trustWeightOverride: null,
    // PHASE 5 STEP 1
    trustScore: 50,
    rankTitle: "Claim Checker",
    highestRankAchieved: "Claim Checker",
    reputationPoints: 0,
    monthlyReputationPoints: 0,
    correctVotes: 0,
    incorrectVotes: 0,
    evidenceCount: 0,
    helpfulEvidenceCount: 0,
    suspiciousFlags: 0,
    badgeList: [],
    lastActiveAt: null,
  };

  console.log("[claim mapping failed]", {
    error: formatErrorForDisplay(error),
    row,
  });

  return {
    id: claimId,
    slug: row.slug ?? generateClaimSlug(row.title ?? "Claim unavailable"),
    shareUrl: row.share_url ?? generateClaimShareUrl(claimId),
    title: row.title ?? "Claim unavailable",
    description: "This claim is temporarily unavailable.",
    sourceUrl: row.source_url ?? "",
    media: {
      imageUrl: row.image_url ?? null,
      // PHASE 5 STEP 6
      imagePath: row.image_path ?? null,
      thumbnailUrl: row.thumbnail_url ?? row.image_url ?? null,
      videoUrl: row.video_url ?? null,
      youtubeUrl: null,
      videoPlatform: null,
      youtubeThumbnailUrl: null,
    },
    aiCheck: {
      status: "PENDING",
      confidence: null,
      reason: null,
      riskLabel: null,
      flags: [],
      missingEvidence: [],
      sourceNotes: null,
      checkedAt: null,
    },
    aiStatus: "PENDING",
    aiConfidence: null,
    claimType: mapClaimType(row.claim_type),
    category: row.category ?? "Other",
    // PHASE 5 election positioning UI
    subCategory: row.sub_category ?? null,
    politicianTag: row.politician_tag ?? null,
    votesTrue: row.votes_true ?? 0,
    votesFake: row.votes_fake ?? 0,
    votesUnsure: row.votes_unsure ?? 0,
    totalVotes: row.total_votes ?? 0,
    verdictReason: row.verdict_reason ?? null,
    verdictCalculatedAt: row.verdict_calculated_at ?? null,
    mode,
    currentPhase: row.current_phase ?? 0,
    voteWindowMinutes: row.vote_window_minutes ?? fallbackTiming.voteWindowMinutes,
    voteWindowEnd,
    voteAcceptUntil,
    scoreLockAt,
    publishedAt: row.published_at ?? null,
    phase4Locked: row.phase4_locked ?? false,
    earlyVerdictFired: row.early_verdict_fired ?? false,
    suspiciousActivity: row.suspicious_activity ?? false,
    weightedCommunityScore: row.weighted_community_score ?? 0.5,
    finalScore: row.final_score ?? 0.5,
    minVotesRequired: row.min_votes_required ?? fallbackTiming.minVotesRequired,
    expectedParticipation: row.expected_participation ?? fallbackTiming.expectedParticipation,
    sourceCount: row.source_count ?? 0,
    sourceQuality: mapSourceQuality(row.source_quality),
    sourceDomain: row.source_domain ?? null,
    sourceScore: row.source_score ?? null,
    sourceReason: cleanSourceReviewText(row.source_reason, null),
    // PHASE 4 STEP 22
    sourceReadStatus: mapSourceReadStatus(row.source_read_status),
    sourcePageTitle: row.source_page_title ?? null,
    sourceSupportsClaim: typeof row.source_supports_claim === "boolean" ? row.source_supports_claim : null,
    sourceSupportSummary: cleanSourceReviewText(row.source_support_summary),
    evidenceUsedCount: row.evidence_used_count ?? 0,
    redFlags: [],
    aiSummary: cleanSourceReviewText(row.ai_summary ?? row.ai_reason, null),
    status: mapStatus(row.status ?? "OPEN"),
    // PHASE 5 STEP 3
    hidden: Boolean(row.hidden),
    hiddenReason: row.hidden_reason ?? null,
    hiddenAt: row.hidden_at ?? null,
    createdAt,
    expiresAt: row.expires_at ?? scoreLockAt,
    userVote: null,
    evidence: [],
    evidenceCount: row.evidence_count ?? 0,
    reports: [],
    reportCount: row.report_count ?? 0,
    isFlagged: row.is_flagged ?? false,
    authorId: fallbackAuthor.id,
    authorUsername: fallbackAuthor.username,
    authorDisplayName: fallbackAuthor.displayName,
    authorVerified: false,
    authorReputation: fallbackAuthor.reputationScore,
    authorAvatarUrl: fallbackAuthor.avatar,
    author: fallbackAuthor,
  };
}

export function mapClaimRowToClaim(row: ClaimRow): Claim {
  // PHASE 3 STEP 27
  try {
    return mapClaimRowToClaimStrict(row);
  } catch (error) {
    return createFallbackClaim(row, error);
  }
}

export function mapClaimToInsert(input: CreateClaimInput, authorId: string) {
  const normalizedSourceUrl = normalizeUrl(input.sourceUrl);
  const safeSourceUrl = normalizedSourceUrl || (APP_CONFIG.TEST_MODE ? "https://www.pennyfloat.com" : "");
  const normalizedVideoUrl = input.videoUrl ? normalizeUrl(input.videoUrl) : "";
  const trimmedVideoUrl = normalizedVideoUrl || null;
  // PHASE 5 election positioning UI
  const category = input.category?.trim() || "Other";
  const subCategory = category === "Politics" ? input.subCategory?.trim() || null : null;
  const politicianTag =
    category === "Politics" && subCategory === "Politician" ? input.politicianTag?.trim() || null : null;
  // PHASE 4 STEP 26
  const timing = createClaimTiming(VERIFICATION_MODE);
  const createdAt = timing.createdAt;
  console.log("[url] normalized source url:", safeSourceUrl);
  console.log("[url] normalized source:", safeSourceUrl);
  console.log("[createClaim] production timing:", timing);

  const payload = removeUndefinedValues({
    author_id: authorId,
    created_at: createdAt,
    title: input.title.trim(),
    description: input.description.trim(),
    source_url: safeSourceUrl,
    video_url: trimmedVideoUrl,
    // URGENT DEBUG - create claim image insert
    // Image upload is optional and happens after insert once the claim id exists.
    // Do not send new image columns during initial insert; stale PostgREST schemas
    // can reject the whole claim before the optional image flow starts.
    ...(input.imageUrl ? { image_url: input.imageUrl } : {}),
    ...(input.imagePath ? { image_path: input.imagePath } : {}),
    ...(input.thumbnailUrl ? { thumbnail_url: input.thumbnailUrl } : {}),
    category,
    // PHASE 5 election positioning UI
    sub_category: subCategory,
    politician_tag: politicianTag,
    slug: generateClaimSlug(input.title),
    votes_true: 0,
    votes_fake: 0,
    votes_unsure: 0,
    // PHASE 3 STEP 10
    total_votes: 0,
    verdict_reason: null,
    verdict_calculated_at: null,
    status: "ACTIVE",
    ai_status: "PENDING",
    // PHASE 4 STEP 7
    claim_type: "UNCLEAR",
    ai_confidence: null,
    ai_reason: null,
    report_count: 0,
    evidence_count: 0,
    evidence_used_count: 0,
    is_flagged: false,
    mode: timing.mode,
    current_phase: 1,
    vote_window_minutes: timing.voteWindowMinutes,
    vote_window_end: timing.voteWindowEnd,
    vote_accept_until: timing.voteAcceptUntil,
    score_lock_at: timing.scoreLockAt,
    published_at: null,
    phase4_locked: false,
    early_verdict_fired: false,
    suspicious_activity: false,
    weighted_community_score: 0,
    final_score: 0,
    min_votes_required: timing.minVotesRequired,
    expected_participation: timing.expectedParticipation,
    source_count: 0,
    source_quality: "unknown",
    // PHASE 4 STEP 9
    source_domain: null,
    source_score: null,
    source_reason: null,
    red_flags: [],
    ai_summary: null,
    expires_at: timing.expiresAt,
  });

  console.log("[create claim] insert payload:", payload);
  console.log("CREATE_CLAIM_PAYLOAD", payload);

  return payload;
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
  // PHASE 3 STEP 27
  try {
    return await fetchLatestClaimsPage(limit, 0);
  } catch (error) {
    return getClaimsErrorResult(error);
  }
}

// PHASE 3 STEP 26
export async function fetchLatestClaimsDebug(): Promise<ClaimsResult> {
  try {
    const { data, error } = await supabase
      .from("claims")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) {
      return getClaimsErrorResult(error);
    }

    console.log("[claims debug count]", data?.length);
    console.log("[claims debug first row]", data?.[0]);

    return getClaimsSuccessResult(await mergeAuthorProfilesIntoRows((data ?? []) as ClaimRow[]));
  } catch (error) {
    return getClaimsErrorResult(error, "Claim mapping failed");
  }
}

// PHASE 3 STEP 11
export async function fetchLatestClaimsPage(
  limit = DEFAULT_CLAIMS_PAGE_SIZE,
  offset = 0,
): Promise<ClaimsResult> {
  // PHASE 4 STEP 12
  // PHASE 3 STEP 27
  try {
    console.log("CLAIMS_FETCH_START", { limit, offset });

    const { data, error, status, statusText } = await supabase
      .from("claims")
      .select("*")
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    console.log("CLAIMS_RESPONSE", data);
    console.log("CLAIMS_RESPONSE_META", {
      status,
      statusText,
      count: data?.length ?? 0,
      firstClaimId: data?.[0]?.id ?? null,
    });
    console.log("CLAIMS_ERROR", error);

    if (error) {
      return getClaimsErrorResult(error);
    }

    return await getClaimsSuccessResultWithProfiles((data ?? []) as ClaimRow[]);
  } catch (error) {
    return getClaimsErrorResult(error, "Claim mapping failed");
  }
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
  // PHASE 4 STEP 12
  try {
    const { data, error } = await supabase
      .from("claims")
      .select("*")
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      return getClaimsErrorResult(error);
    }

    const searchTerm = cleanSearchTerm(query).toLowerCase();
    const filteredRows = ((data ?? []) as ClaimRow[]).filter((row) => {
      const rowMatchesQuery =
        !searchTerm ||
        [row.title, row.description, row.source_url, row.category]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(searchTerm));

      if (!rowMatchesQuery) {
        return false;
      }

      if (filters.category && row.category !== filters.category) {
        return false;
      }

      if (
        filters.filter === "FINALIZED_TRUE" ||
        filters.filter === "FINALIZED_FAKE" ||
        filters.filter === "INSUFFICIENT_DATA" ||
        filters.filter === "COMMUNITY_TRUE" ||
        filters.filter === "COMMUNITY_FAKE" ||
        filters.filter === "NEEDS_MORE_EVIDENCE"
      ) {
        return row.status === filters.filter;
      }

      if (filters.filter === "OPEN_VOTING") {
        return row.status === "OPEN" || row.status === "ACTIVE" || row.status === "EARLY_VERDICT";
      }

      if (filters.filter === "FLAGGED") {
        return Boolean(row.is_flagged);
      }

      if (filters.filter === "HAS_IMAGE") {
        return Boolean(row.image_url);
      }

      if (filters.filter === "HAS_VIDEO") {
        return Boolean(row.video_url);
      }

      return true;
    });

    return await getClaimsSuccessResultWithProfiles(filteredRows);
  } catch (error) {
    return getClaimsErrorResult(error, "Claim mapping failed");
  }
}

// PHASE 3 STEP 9
export async function fetchClaimsByCategory(category: string): Promise<ClaimsResult> {
  // PHASE 3 STEP 29
  try {
    const { data, error } = await supabase
      .from("claims")
      .select("*")
      .eq("category", category)
      .order("created_at", { ascending: false })
      .limit(DEFAULT_CLAIM_LIMIT);

    if (error) {
      return getClaimsErrorResult(error);
    }

    return await getClaimsSuccessResultWithProfiles((data ?? []) as ClaimRow[]);
  } catch (error) {
    return getClaimsErrorResult(error, "Claim mapping failed");
  }
}

// PHASE 3 STEP 9
export async function fetchClaimsByStatus(status: ClaimStatus): Promise<ClaimsResult> {
  // PHASE 3 STEP 29
  try {
    const { data, error } = await supabase
      .from("claims")
      .select("*")
      .eq("status", status)
      .order("created_at", { ascending: false })
      .limit(DEFAULT_CLAIM_LIMIT);

    if (error) {
      return getClaimsErrorResult(error);
    }

    return await getClaimsSuccessResultWithProfiles((data ?? []) as ClaimRow[]);
  } catch (error) {
    return getClaimsErrorResult(error, "Claim mapping failed");
  }
}

// PHASE 3 STEP 9
export async function fetchTrendingClaims(limit = 100): Promise<ClaimsResult> {
  // PHASE 3 STEP 27
  try {
    return await fetchTrendingClaimsPage(limit, 0);
  } catch (error) {
    return getClaimsErrorResult(error);
  }
}

// PHASE 3 STEP 11
export async function fetchTrendingClaimsPage(
  limit = DEFAULT_CLAIMS_PAGE_SIZE,
  offset = 0,
): Promise<ClaimsResult> {
  // PHASE 4 STEP 12
  try {
    const { data, error } = await supabase
      .from("claims")
      .select("*")
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      return getClaimsErrorResult(error);
    }

    const result = await getClaimsSuccessResultWithProfiles((data ?? []) as ClaimRow[]);

    return {
      ok: true,
      claims: result.claims.sort((first, second) => calculateTrendingScore(second) - calculateTrendingScore(first)),
    };
  } catch (error) {
    return getClaimsErrorResult(error, "Claim mapping failed");
  }
}

// PHASE 3 STEP 10
export async function finalizeExpiredClaim(claimId: string): Promise<ClaimResult> {
  const latestClaimResult = await fetchClaimById(claimId);

  if (latestClaimResult.error || !latestClaimResult.claim) {
    return latestClaimResult;
  }

  const latestClaim = latestClaimResult.claim;

  if (isTerminalClaimStatus(latestClaim.status)) {
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
  // PHASE 4 STEP 26
  const voteWindowClosed = new Date(latestClaim.voteAcceptUntil).getTime() <= Date.now();
  const shouldPublish = scoreLockPassed;
  const publishedStatus = getPublishedStatus(verificationResponse);
  const finalizedAt = new Date().toISOString();
  const verdictReason =
    !verificationResponse.min_votes_met
      ? "Minimum vote requirement was not met."
      : getVerificationVerdictReason(verificationResponse);
  const interimStatus: ClaimStatus =
    verificationResponse.early_verdict_fired && !shouldPublish
      ? "EARLY_VERDICT"
      : verificationResponse.phase4_locked || voteWindowClosed
        ? "LOCKED"
        : "ACTIVE";
  const updateRow = {
    current_phase: verificationResponse.current_phase,
    phase4_locked: verificationResponse.phase4_locked,
    early_verdict_fired: verificationResponse.early_verdict_fired,
    suspicious_activity: verificationResponse.suspicious_activity,
    weighted_community_score: verificationResponse.weighted_community_score,
    final_score: verificationResponse.final_score,
    total_votes: verificationResponse.vote_count,
    ...(!shouldPublish ? { status: interimStatus } : {}),
    ...(shouldPublish
      ? {
          status: publishedStatus,
          verdict_reason: verdictReason,
          verdict_calculated_at: finalizedAt,
          published_at: finalizedAt,
          phase4_locked: true,
        }
      : {}),
    updated_at: new Date().toISOString(),
  };
  const localFinalizedClaim: Claim = {
    ...latestClaim,
    currentPhase: verificationResponse.current_phase,
    phase4Locked: shouldPublish ? true : verificationResponse.phase4_locked,
    earlyVerdictFired: verificationResponse.early_verdict_fired,
    suspiciousActivity: verificationResponse.suspicious_activity,
    weightedCommunityScore: verificationResponse.weighted_community_score,
    finalScore: verificationResponse.final_score,
    totalVotes: verificationResponse.vote_count,
    ...(!shouldPublish ? { status: interimStatus } : {}),
    ...(shouldPublish
      ? {
          status: publishedStatus,
          verdictReason,
          verdictCalculatedAt: finalizedAt,
          publishedAt: finalizedAt,
        }
      : {}),
  };

  const { error } = await supabase.from("claims").update(updateRow).eq("id", claimId);

  if (error) {
    // PHASE 3 STEP 25
    // Client-side verdict saving is best-effort. RLS can block this for non-authors,
    // but the feed should still render the fetched claim.
    logClaimFinalizeWarning(claimId, error);
    // PHASE 5 STEP 1
    if (shouldPublish) {
      const { error: rpcError } = await supabase.rpc("finalize_expired_claim", {
        target_claim_id: claimId,
      });

      if (rpcError) {
        logClaimFinalizeWarning(claimId, rpcError);
      } else {
        await processClaimReputation(claimId);
        const refreshedAfterRpc = await fetchClaimById(claimId);

        if (refreshedAfterRpc.claim) {
          return refreshedAfterRpc;
        }
      }
    }

    return {
      claim: localFinalizedClaim,
    };
  }

  // PHASE 5 STEP 1
  if (shouldPublish) {
    await processClaimReputation(claimId);
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
  const now = Date.now();
  const finalizedClaims = await Promise.all(
    claims.map(async (claim) => {
      if (isTerminalClaimStatus(claim.status)) {
        return claim;
      }

      const result = await finalizeExpiredClaim(claim.id);

      if (result.error) {
        console.log("[claims finalize warning]", {
          claimId: claim.id,
          message: result.error,
        });
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
  // PHASE 3 STEP 29
  // PHASE 3 STEP 32
  // PHASE 4 STEP 12
  const { data, error } = await supabase.from("claims").select("*").eq("id", id).single();

  if (error) {
    return {
      claim: null,
      error: getClaimLoadError(error),
    };
  }

  const [rowWithProfile] = await mergeAuthorProfilesIntoRows(data ? [data as ClaimRow] : []);

  return {
    claim: rowWithProfile ? mapClaimRowToClaim(rowWithProfile) : null,
  };
}

export async function createClaim(input: CreateClaimInput): Promise<ClaimResult> {
  // PHASE 3 STEP 29
  // PHASE 4 STEP 13
  // PHASE 4 STEP 13B
  const { data: userData, error: userError } = await supabase.auth.getUser();
  const user = userData?.user;

  if (userError || !user) {
    console.log("[create claim] auth user error:", userError);
    return {
      claim: null,
      error: "Please log in to post.",
    };
  }

  console.log("[create claim] auth user id:", user.id);
  console.log("[create claim] input image selected:", Boolean(input.imageAsset));

  const profileResult = await ensureProfileForUser(user);
  console.log("[create claim] profile exists:", Boolean(profileResult.profile), {
    profileId: profileResult.profile?.id,
    profileError: profileResult.error,
  });

  if (profileResult.error || !profileResult.profile) {
    return {
      claim: null,
      error: profileResult.error ?? "Profile required to post.",
    };
  }

  const authorProfile = profileResult.profile;
  const payload = mapClaimToInsert(input, user.id);
  const { data, error } = await supabase.from("claims").insert(payload).select("*").single();
  console.log("CREATE_CLAIM_DATA", data);

  if (error) {
    console.log("[create claim] error:", error);
    console.log("CREATE_CLAIM_ERROR", error);
    console.log("[create claim] insert error:", {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });

    return {
      claim: null,
      error: formatSupabaseMutationError(error),
    };
  }

  const insertedRow = data as ClaimRow;
  const insertedClaimId = insertedRow.id;

  if (!insertedClaimId) {
    return {
      claim: mapClaimRowToClaim(attachAuthorProfile(insertedRow, authorProfile)),
      error: "Claim was saved, but Supabase did not return a claim id.",
    };
  }

  const shareUrl = generateClaimShareUrl(insertedClaimId);
  const mediaUpdatePayload: Record<string, unknown> = {
    share_url: shareUrl,
  };

  // PHASE 5 STEP 6
  if (input.imageAsset) {
    try {
      console.log("[create claim] image upload start:", {
        claimId: insertedClaimId,
        userId: user.id,
      });
      const uploadedImage = await uploadClaimImage(user.id, insertedClaimId, input.imageAsset);
      console.log("[create claim] image upload complete:", uploadedImage);
      mediaUpdatePayload.image_url = uploadedImage.imageUrl;
      mediaUpdatePayload.image_path = uploadedImage.imagePath;
      mediaUpdatePayload.thumbnail_url = uploadedImage.thumbnailUrl;
    } catch (uploadError) {
      console.log("[create claim] image upload warning:", uploadError);
      console.log("CREATE_CLAIM_IMAGE_UPLOAD_ERROR", uploadError);
    }
  }

  const { data: updatedData, error: shareUpdateError } = await supabase
    .from("claims")
    .update(mediaUpdatePayload)
    .eq("id", insertedClaimId)
    .select("*")
    .single();

  if (shareUpdateError) {
    console.log("[create claim] share url update error:", {
      claimId: insertedClaimId,
      code: shareUpdateError.code,
      message: shareUpdateError.message,
      details: shareUpdateError.details,
      hint: shareUpdateError.hint,
    });
  }

  const refreshedClaim = await fetchClaimById(insertedClaimId);

  if (refreshedClaim.claim) {
    return refreshedClaim;
  }

  if (refreshedClaim.error) {
    console.log("[create claim] refetch warning:", {
      claimId: insertedClaimId,
      error: refreshedClaim.error,
    });
  }

  return {
    claim: mapClaimRowToClaim(
      attachAuthorProfile((updatedData as ClaimRow | null) ?? { ...insertedRow, share_url: shareUrl }, authorProfile),
    ),
  };
}

export async function updateClaim(id: string, updates: ClaimUpdates): Promise<ClaimResult> {
  const updateRow = {
    ...(updates.title !== undefined ? { title: updates.title.trim() } : {}),
    ...(updates.description !== undefined ? { description: updates.description.trim() } : {}),
    ...(updates.sourceUrl !== undefined ? { source_url: normalizeUrl(updates.sourceUrl) } : {}),
    ...(updates.videoUrl !== undefined ? { video_url: updates.videoUrl ? normalizeUrl(updates.videoUrl) : null } : {}),
    ...(updates.imageUrl !== undefined ? { image_url: updates.imageUrl } : {}),
    // PHASE 5 STEP 6
    ...(updates.imagePath !== undefined ? { image_path: updates.imagePath } : {}),
    ...(updates.thumbnailUrl !== undefined ? { thumbnail_url: updates.thumbnailUrl } : {}),
    ...(updates.category !== undefined ? { category: updates.category.trim() || "Other" } : {}),
    // PHASE 5 election positioning UI
    ...(updates.subCategory !== undefined ? { sub_category: updates.subCategory?.trim() || null } : {}),
    ...(updates.politicianTag !== undefined ? { politician_tag: updates.politicianTag?.trim() || null } : {}),
    ...(updates.slug !== undefined ? { slug: updates.slug } : {}),
    ...(updates.shareUrl !== undefined ? { share_url: updates.shareUrl } : {}),
    ...(updates.status !== undefined ? { status: updates.status } : {}),
  };

  // PHASE 3 STEP 29
  const { data, error } = await supabase.from("claims").update(updateRow).eq("id", id).select("*").single();

  if (error) {
    return {
      claim: null,
      error: getClaimServiceErrorMessage(error.message, "save"),
    };
  }

  const [rowWithProfile] = await mergeAuthorProfilesIntoRows(data ? [data as ClaimRow] : []);

  return {
    claim: rowWithProfile ? mapClaimRowToClaim(rowWithProfile) : null,
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
