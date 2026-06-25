// PHASE 5 STEP 1E
// PHASE 5 STEP 4
import { supabase } from "../lib/supabase";
import { getBackendUrl } from "../constants/apiConfig";
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
  reason?: "not_found" | "network" | "server_error";
  error?: string;
}

const PUBLIC_PROFILE_SELECT =
  "id,username,display_name,avatar_url,bio,public_profile_slug,profile_visibility,trust_score,rank_title,highest_rank_achieved,reputation_points,monthly_reputation_points,badge_list,evidence_count,correct_votes,created_at,is_deleted,deleted_at";
const PUBLIC_PROFILE_MINIMAL_SELECT = "id,username,display_name,avatar_url,created_at";

function isUuid(input: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.trim());
}

function isNetworkError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? "");
  const normalizedMessage = message.toLowerCase();

  return (
    normalizedMessage.includes("networkerror") ||
    normalizedMessage.includes("failed to fetch") ||
    normalizedMessage.includes("fetch") ||
    normalizedMessage.includes("network")
  );
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

async function queryProfileByField(
  field: "id" | "public_profile_slug" | "username",
  value: string,
): Promise<{ row: PublicProfileRow | null; error: unknown; status?: number }> {
  console.log("Querying profiles with:", { field, value });

  const result = await supabase
    .from("profiles")
    .select(PUBLIC_PROFILE_SELECT)
    .eq(field, value)
    .maybeSingle();
  let data: unknown = result.data;
  let error = result.error;
  let status = result.status;

  if (error && isSchemaCacheError(error)) {
    console.log("[public profile] retrying minimal profile select after schema error:", {
      field,
      value,
      code: error.code,
      message: error.message,
    });

    const fallbackResult = await supabase
      .from("profiles")
      .select(PUBLIC_PROFILE_MINIMAL_SELECT)
      .eq(field, value)
      .maybeSingle();

    data = fallbackResult.data;
    error = fallbackResult.error;
    status = fallbackResult.status;

    if (error && isSchemaCacheError(error) && field !== "id") {
      console.log("[public profile] skipping unavailable lookup field:", field);
      return {
        row: null,
        error: null,
        status,
      };
    }
  }

  console.log("Supabase response status:", status);
  console.log("Supabase data:", JSON.stringify(data));
  console.log("Supabase error:", JSON.stringify(error));

  return {
    row: data ? (data as PublicProfileRow) : null,
    error,
    status,
  };
}

function isSchemaCacheError(error: { code?: string; message?: string; details?: string } | null): boolean {
  const message = `${error?.code ?? ""} ${error?.message ?? ""} ${error?.details ?? ""}`.toLowerCase();

  return (
    message.includes("schema cache") ||
    message.includes("could not find") ||
    message.includes("column") ||
    message.includes("pgrst204")
  );
}

function getProfileFetchError(error: unknown): PublicProfileResult {
  const typedError = error as { code?: string; message?: string; details?: string; hint?: string };

  console.log("[public profile] load error:", {
    code: typedError?.code,
    message: typedError?.message,
    details: typedError?.details,
    hint: typedError?.hint,
  });

  if (typedError?.code === "PGRST301" || typedError?.code === "PGRST116") {
    return {
      profile: null,
      status: 404,
      reason: "not_found",
      error: "Contributor profile unavailable.",
    };
  }

  return {
    profile: null,
    status: 500,
    reason: "server_error",
    error: "Could not load profile. Please try again.",
  };
}

async function fetchPublicProfileFromBackend(
  identifier: string,
  username?: string | null,
): Promise<PublicProfileResult | null> {
  const backendUrl = getBackendUrl();

  if (!backendUrl || !identifier.trim()) {
    return null;
  }

  const params = new URLSearchParams();

  if (username?.trim()) {
    params.set("username", username.trim());
  }

  const url = `${backendUrl}/public-profile/${encodeURIComponent(identifier.trim())}${
    params.toString() ? `?${params.toString()}` : ""
  }`;

  try {
    const response = await fetch(url);
    const json = (await response.json().catch(() => ({}))) as {
      ok?: boolean;
      profile?: PublicProfileRow;
      reason?: string;
      message?: string;
    };

    console.log("[public profile] backend response:", {
      status: response.status,
      ok: json.ok,
      reason: json.reason,
    });

    if (response.ok && json.ok && json.profile) {
      return {
        profile: mapPublicProfileRow(json.profile),
      };
    }

    if (response.ok && json.reason === "not_found") {
      return {
        profile: null,
        status: 404,
        reason: "not_found",
        error: "Contributor profile unavailable.",
      };
    }

    return null;
  } catch (error) {
    console.log("[public profile] backend fetch warning:", error);
    return null;
  }
}

export async function fetchPublicProfileBySlug(
  slugOrUsername: string,
  options: { userId?: string | null; username?: string | null } = {},
): Promise<PublicProfileResult> {
  const trimmedIdentifier = (options.userId || slugOrUsername || options.username || "").trim();
  const fallbackUsername = (options.username || slugOrUsername || "").trim();
  const normalizedSlug = normalizeProfileSlug(slugOrUsername || fallbackUsername);
  const normalizedUsername = normalizeUsername(fallbackUsername);
  const profileId = isUuid(trimmedIdentifier) ? trimmedIdentifier : "";

  if (!profileId && !normalizedSlug && !normalizedUsername) {
    return {
      profile: null,
      status: 404,
      reason: "not_found",
      error: "Contributor profile unavailable.",
    };
  }

  console.log("=== CONTRIBUTOR PAGE DEBUG ===");
  console.log("Fetching contributor profile for:", {
    slugOrUsername,
    profileId,
    normalizedSlug,
    normalizedUsername,
  });

  const backendResult = await fetchPublicProfileFromBackend(trimmedIdentifier, options.username);

  if (backendResult?.profile || backendResult?.reason === "not_found") {
    console.log("=== END DEBUG ===");
    return backendResult;
  }

  const lookups: Array<{ field: "id" | "public_profile_slug" | "username"; value: string }> = [
    ...(profileId ? [{ field: "id" as const, value: profileId }] : []),
    ...(normalizedSlug && normalizedSlug !== profileId
      ? [{ field: "public_profile_slug" as const, value: normalizedSlug }]
      : []),
    ...(normalizedUsername ? [{ field: "username" as const, value: normalizedUsername }] : []),
  ];

  try {
    for (const lookup of lookups) {
      const result = await queryProfileByField(lookup.field, lookup.value);

      if (result.error) {
        console.log("=== END DEBUG ===");
        return getProfileFetchError(result.error);
      }

      if (result.row) {
        console.log("=== END DEBUG ===");
        return {
          profile: mapPublicProfileRow(result.row),
        };
      }
    }

    console.log("No profile found for identifier:", trimmedIdentifier || slugOrUsername || fallbackUsername);
    console.log("=== END DEBUG ===");
    return {
      profile: null,
      status: 404,
      reason: "not_found",
      error: "Contributor profile unavailable.",
    };
  } catch (error) {
    console.log("Unexpected contributor profile error:", error instanceof Error ? error.message : error);
    console.log("=== END DEBUG ===");

    if (isNetworkError(error)) {
      return {
        profile: null,
        status: 500,
        reason: "network",
        error: "Could not connect. Check your internet and try again.",
      };
    }

    return {
      profile: null,
      status: 500,
      reason: "server_error",
      error: "Could not load profile. Please try again.",
    };
  }
}
