// PHASE 5 STEP 1E
// PHASE 5 STEP 4
import { supabase } from "../lib/supabase";
import { normalizeProfileSlug, normalizeProfileVisibility, type ProfileVisibility } from "../utils/publicProfile";
import { getDisplayRankTitle, parseBadgeList, type ReputationBadge } from "../utils/reputation";
import { getReviewSafeDisplayName, getReviewSafeUsername, normalizeUsername } from "../utils/username";

export interface PublicProfileCard {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  bio: string | null;
  publicProfileSlug: string | null;
  profileVisibility: ProfileVisibility;
  rankTitle: string;
  highestRankAchieved: string;
  reputationPoints: number;
  monthlyReputationPoints: number;
  badgeList: ReputationBadge[];
  evidenceCount: number;
  correctVotes: number;
  createdAt: string | null;
  isDeleted: boolean;
}

interface PublicProfileRow {
  id: string;
  username: string;
  display_name?: string | null;
  avatar_url?: string | null;
  bio?: string | null;
  public_profile_slug?: string | null;
  profile_visibility?: string | null;
  trust_score?: number | null;
  rank_title?: string | null;
  highest_rank_achieved?: string | null;
  reputation_points?: number | null;
  monthly_reputation_points?: number | null;
  badge_list?: unknown;
  evidence_count?: number | null;
  correct_votes?: number | null;
  created_at?: string | null;
  is_deleted?: boolean | null;
  deleted_at?: string | null;
}

export interface PublicProfileResult {
  profile: PublicProfileCard | null;
  status?: 404 | 500;
  error?: string;
}

const PUBLIC_PROFILE_SELECT =
  "id,username,display_name,avatar_url,bio,public_profile_slug,profile_visibility,trust_score,rank_title,highest_rank_achieved,reputation_points,monthly_reputation_points,badge_list,evidence_count,correct_votes,created_at,is_deleted,deleted_at";

function isUuid(input: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.trim());
}

function mapPublicProfileRow(row: PublicProfileRow): PublicProfileCard {
  const isDeleted = Boolean(row.is_deleted);
  const visibility = normalizeProfileVisibility(row.profile_visibility);
  const username = getReviewSafeUsername(row.username, row.id);
  const rankTitle = getDisplayRankTitle({
    trustScore: row.trust_score ?? 50,
    rankTitle: row.rank_title,
    highestRankAchieved: row.highest_rank_achieved,
  });

  return {
    id: row.id,
    username: isDeleted ? "deleted_user" : username,
    displayName: isDeleted ? "Deleted User" : getReviewSafeDisplayName(row.display_name, row.username, row.id),
    avatarUrl: isDeleted ? null : row.avatar_url ?? null,
    bio: visibility === "private" || isDeleted ? null : row.bio ?? null,
    publicProfileSlug: isDeleted ? null : row.public_profile_slug ?? username,
    profileVisibility: isDeleted ? "private" : visibility,
    rankTitle,
    highestRankAchieved: row.highest_rank_achieved ?? rankTitle,
    reputationPoints: visibility === "private" || isDeleted ? 0 : row.reputation_points ?? 0,
    monthlyReputationPoints: visibility === "private" || isDeleted ? 0 : row.monthly_reputation_points ?? 0,
    badgeList: isDeleted ? [] : parseBadgeList(row.badge_list),
    evidenceCount: visibility === "private" || isDeleted ? 0 : row.evidence_count ?? 0,
    correctVotes: visibility === "private" || isDeleted ? 0 : row.correct_votes ?? 0,
    createdAt: visibility === "private" || isDeleted ? null : row.created_at ?? null,
    isDeleted,
  };
}

export async function fetchPublicProfileBySlug(slugOrUsername: string): Promise<PublicProfileResult> {
  const trimmedIdentifier = slugOrUsername.trim();
  const normalizedSlug = normalizeProfileSlug(trimmedIdentifier);
  const normalizedUsername = normalizeUsername(trimmedIdentifier);
  const profileId = isUuid(trimmedIdentifier) ? trimmedIdentifier : "";

  if (!profileId && !normalizedSlug && !normalizedUsername) {
    return { profile: null, status: 404, error: "Contributor profile unavailable" };
  }

  const profileFilters = [
    ...(profileId ? [`id.eq.${profileId}`] : []),
    ...(normalizedSlug ? [`public_profile_slug.eq.${normalizedSlug}`] : []),
    ...(normalizedUsername ? [`username.eq.${normalizedUsername}`] : []),
  ];

  const { data, error } = await supabase
    .from("profiles")
    .select(PUBLIC_PROFILE_SELECT)
    .or(profileFilters.join(","))
    .limit(1);

  if (error) {
    console.log("[public profile] load error:", {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });
    return { profile: null, status: 500, error: "Could not load profile" };
  }

  const row = Array.isArray(data) ? data[0] : null;

  return {
    profile: row ? mapPublicProfileRow(row as PublicProfileRow) : null,
    status: row ? undefined : 404,
    error: row ? undefined : "Contributor profile unavailable",
  };
}
