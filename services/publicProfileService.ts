// PHASE 5 STEP 1E
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
}

export interface PublicProfileResult {
  profile: PublicProfileCard | null;
  error?: string;
}

const PUBLIC_PROFILE_SELECT =
  "id,username,display_name,avatar_url,bio,public_profile_slug,profile_visibility,trust_score,rank_title,highest_rank_achieved,reputation_points,monthly_reputation_points,badge_list,evidence_count,correct_votes,created_at";

function mapPublicProfileRow(row: PublicProfileRow): PublicProfileCard {
  const visibility = normalizeProfileVisibility(row.profile_visibility);
  const rankTitle = getDisplayRankTitle({
    trustScore: row.trust_score ?? 50,
    rankTitle: row.rank_title,
    highestRankAchieved: row.highest_rank_achieved,
  });

  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name ?? null,
    avatarUrl: row.avatar_url ?? null,
    bio: visibility === "private" ? null : row.bio ?? null,
    publicProfileSlug: row.public_profile_slug ?? row.username,
    profileVisibility: visibility,
    rankTitle,
    highestRankAchieved: row.highest_rank_achieved ?? rankTitle,
    reputationPoints: visibility === "private" ? 0 : row.reputation_points ?? 0,
    monthlyReputationPoints: visibility === "private" ? 0 : row.monthly_reputation_points ?? 0,
    badgeList: parseBadgeList(row.badge_list),
    evidenceCount: visibility === "private" ? 0 : row.evidence_count ?? 0,
    correctVotes: visibility === "private" ? 0 : row.correct_votes ?? 0,
    createdAt: visibility === "private" ? null : row.created_at ?? null,
  };
}

export async function fetchPublicProfileBySlug(slugOrUsername: string): Promise<PublicProfileResult> {
  const normalizedSlug = normalizeProfileSlug(slugOrUsername);
  const normalizedUsername = normalizeUsername(slugOrUsername);

  if (!normalizedSlug && !normalizedUsername) {
    return { profile: null, error: "Profile not found." };
  }

  const { data, error } = await supabase
    .from("profiles")
    .select(PUBLIC_PROFILE_SELECT)
    .or(`public_profile_slug.eq.${normalizedSlug},username.eq.${normalizedUsername ?? normalizedSlug}`)
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
