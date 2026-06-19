// PHASE 5 STEP 1E
// PHASE 5 STEP 4
import { supabase } from "../lib/supabase";
import { normalizeProfileSlug, normalizeProfileVisibility, type ProfileVisibility } from "../utils/publicProfile";
import { getDisplayRankTitle, parseBadgeList, type ReputationBadge } from "../utils/reputation";
import { normalizeUsername } from "../utils/username";

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
  error?: string;
}

const PUBLIC_PROFILE_SELECT =
  "id,username,display_name,avatar_url,bio,public_profile_slug,profile_visibility,trust_score,rank_title,highest_rank_achieved,reputation_points,monthly_reputation_points,badge_list,evidence_count,correct_votes,created_at,is_deleted,deleted_at";

function mapPublicProfileRow(row: PublicProfileRow): PublicProfileCard {
  const isDeleted = Boolean(row.is_deleted);
  const visibility = normalizeProfileVisibility(row.profile_visibility);
  const rankTitle = getDisplayRankTitle({
    trustScore: row.trust_score ?? 50,
    rankTitle: row.rank_title,
    highestRankAchieved: row.highest_rank_achieved,
  });

  return {
    id: row.id,
    username: isDeleted ? "deleted_user" : row.username,
    displayName: isDeleted ? "Deleted User" : row.display_name ?? null,
    avatarUrl: isDeleted ? null : row.avatar_url ?? null,
    bio: visibility === "private" || isDeleted ? null : row.bio ?? null,
    publicProfileSlug: isDeleted ? null : row.public_profile_slug ?? row.username,
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
  const normalizedSlug = normalizeProfileSlug(slugOrUsername);
  const normalizedUsername = normalizeUsername(slugOrUsername);

  if (!normalizedSlug && !normalizedUsername) {
    return { profile: null, error: "Profile not found." };
  }

  const profileFilters = [
    ...(normalizedSlug ? [`public_profile_slug.eq.${normalizedSlug}`] : []),
    ...(normalizedUsername ? [`username.eq.${normalizedUsername}`] : []),
  ];

  const { data, error } = await supabase
    .from("profiles")
    .select(PUBLIC_PROFILE_SELECT)
    .or(profileFilters.join(","))
    .maybeSingle();

  if (error) {
    console.log("[public profile] load error:", {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });
    return { profile: null, error: "Could not load this profile." };
  }

  return {
    profile: data ? mapPublicProfileRow(data as PublicProfileRow) : null,
    error: data ? undefined : "Profile not found.",
  };
}
