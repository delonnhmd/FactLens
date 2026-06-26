// PHASE 3 STEP 2
// PHASE 3 STEP 15
// PHASE 3 STEP 22
// PHASE 3 STEP 28
// PHASE 3 STEP 29
// PHASE 5 STEP 4
// PHASE 5 STEP 6
import type { User as SupabaseUser } from "@supabase/supabase-js";
import { APP_CONFIG } from "../constants/appConfig";
import { getBackendUrl } from "../constants/apiConfig";
import { supabase } from "../lib/supabase";
import { generateFallbackUsername, getUsernameValidationError, normalizeUsername } from "../utils/username";
import type { VerificationUserRole } from "../types/verification";
import { parseBadgeList, type ReputationBadge } from "../utils/reputation";
import {
  generateProfileSlug,
  isValidAvatarUrl,
  normalizeProfileVisibility,
  sanitizeBio,
  type ProfileVisibility,
} from "../utils/publicProfile";

export interface Profile {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  avatar_path: string | null;
  // PHASE 5 STEP 1E
  bio: string | null;
  public_profile_slug: string | null;
  profile_visibility: ProfileVisibility;
  verified: boolean;
  reputation_score: number;
  // PHASE 3 STEP 17
  votes_cast: number;
  accuracy_rate: number | null;
  trust_tier: VerificationUserRole;
  trust_weight_override: number | null;
  // PHASE 5 STEP 1
  trust_score: number;
  rank_title: string;
  correct_votes: number;
  incorrect_votes: number;
  evidence_count: number;
  helpful_evidence_count: number;
  suspicious_flags: number;
  reputation_points: number;
  badge_list: ReputationBadge[];
  last_active_at: string | null;
  highest_rank_achieved: string;
  monthly_reputation_points: number;
  monthly_reset_at: string | null;
  is_admin: boolean;
  is_suspended: boolean;
  suspended_at: string | null;
  suspended_by: string | null;
  suspension_reason: string | null;
  is_deleted: boolean;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

type ProfileRow = {
  id: string;
  username: string;
  username_normalized?: string | null;
  display_name?: string | null;
  avatar_url?: string | null;
  avatar_path?: string | null;
  // PHASE 5 STEP 1E
  bio?: string | null;
  public_profile_slug?: string | null;
  profile_visibility?: string | null;
  verified?: boolean | null;
  reputation_score?: number | null;
  votes_cast?: number | null;
  accuracy_rate?: number | null;
  trust_tier?: VerificationUserRole | null;
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
  is_admin?: boolean | null;
  is_suspended?: boolean | null;
  suspended_at?: string | null;
  suspended_by?: string | null;
  suspension_reason?: string | null;
  is_deleted?: boolean | null;
  deleted_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type ProfileUpdates = Partial<Pick<Profile, "username" | "display_name" | "avatar_url" | "avatar_path" | "bio" | "profile_visibility">>;

export interface ProfileResult {
  profile: Profile | null;
  error?: string;
  message?: string;
}

export interface UsernameAvailabilityResult {
  available: boolean;
  normalizedUsername: string;
  reserved?: boolean;
  warning?: string;
  error?: string;
}

export const USERNAME_TAKEN_MESSAGE = "Username is already taken";
export const USERNAME_NOT_AVAILABLE_MESSAGE = "Username is not available";

// PHASE 3 STEP 28
function getUserVerifiedForProfile(user: SupabaseUser): boolean {
  return APP_CONFIG.REQUIRE_EMAIL_VERIFICATION ? Boolean(user.email_confirmed_at) : true;
}

function readMetadataString(user: SupabaseUser, key: string): string | undefined {
  const value = user.user_metadata?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function isDuplicateUsernameError(message: string, code?: string): boolean {
  const normalizedMessage = message.toLowerCase();

  return (
    (code === "23505" || normalizedMessage.includes("duplicate")) &&
    (normalizedMessage.includes("username") ||
      normalizedMessage.includes("username_normalized") ||
      normalizedMessage.includes("display_name") ||
      normalizedMessage.includes("profiles_username_key") ||
      normalizedMessage.includes("profiles_username_normalized_unique") ||
      normalizedMessage.includes("profiles_display_name_normalized_unique"))
  );
}

function isMissingUsernameNormalizedColumn(message: string, code?: string): boolean {
  const normalizedMessage = message.toLowerCase();

  return code === "42703" || (normalizedMessage.includes("username_normalized") && normalizedMessage.includes("column"));
}

function getProfileErrorMessage(message: string, code?: string, duplicateMessage = USERNAME_TAKEN_MESSAGE): string {
  if (isDuplicateUsernameError(message, code)) {
    return duplicateMessage;
  }

  return "Could not load your profile right now.";
}

function getProfileLoadErrorMessage(): string {
  return "Could not load your profile right now.";
}

// PHASE 3 STEP 18C
function mapProfileRowToProfile(row: ProfileRow): Profile {
  const isDeleted = Boolean(row.is_deleted);

  return {
    id: row.id,
    username: isDeleted ? "deleted_user" : row.username,
    display_name: isDeleted ? "Deleted User" : row.display_name ?? null,
    avatar_url: isDeleted ? null : row.avatar_url ?? null,
    avatar_path: isDeleted ? null : row.avatar_path ?? null,
    // PHASE 5 STEP 1E
    bio: isDeleted ? null : row.bio ?? null,
    public_profile_slug: isDeleted ? null : row.public_profile_slug ?? generateProfileSlug(row.username, row.id),
    profile_visibility: isDeleted ? "private" : normalizeProfileVisibility(row.profile_visibility),
    verified: Boolean(row.verified),
    reputation_score: row.reputation_score ?? 0,
    votes_cast: row.votes_cast ?? 0,
    accuracy_rate: row.accuracy_rate ?? null,
    // PHASE 5 STEP 1
    trust_tier: row.trust_tier ?? "BASIC",
    trust_weight_override: row.trust_weight_override ?? null,
    trust_score: row.trust_score ?? 50,
    rank_title: row.rank_title ?? "Claim Checker",
    correct_votes: row.correct_votes ?? 0,
    incorrect_votes: row.incorrect_votes ?? 0,
    evidence_count: row.evidence_count ?? 0,
    helpful_evidence_count: row.helpful_evidence_count ?? 0,
    suspicious_flags: row.suspicious_flags ?? 0,
    reputation_points: row.reputation_points ?? row.reputation_score ?? 0,
    badge_list: parseBadgeList(row.badge_list),
    last_active_at: row.last_active_at ?? null,
    highest_rank_achieved: row.highest_rank_achieved ?? row.rank_title ?? "Claim Checker",
    monthly_reputation_points: row.monthly_reputation_points ?? 0,
    monthly_reset_at: row.monthly_reset_at ?? null,
    is_admin: Boolean(row.is_admin),
    is_suspended: Boolean(row.is_suspended),
    suspended_at: row.suspended_at ?? null,
    suspended_by: row.suspended_by ?? null,
    suspension_reason: row.suspension_reason ?? null,
    is_deleted: isDeleted,
    deleted_at: row.deleted_at ?? null,
    created_at: row.created_at ?? "",
    updated_at: row.updated_at ?? "",
  };
}

function getEmailPrefix(user: SupabaseUser): string {
  return user.email?.split("@")[0] || "user";
}

function getPreferredUsername(user: SupabaseUser): string {
  return (
    normalizeUsername(readMetadataString(user, "username")) ||
    normalizeUsername(getEmailPrefix(user)) ||
    generateFallbackUsername(user.email, user.id)
  );
}

export async function checkUsernameAvailability(
  username: string,
  currentUserId?: string,
): Promise<UsernameAvailabilityResult> {
  const validationError = getUsernameValidationError(username);
  const normalizedUsername = normalizeUsername(username);

  if (validationError || !normalizedUsername) {
    return {
      available: false,
      normalizedUsername,
      error: validationError || "Username must be 3-20 characters.",
    };
  }

  const backendUrl = getBackendUrl();

  if (!backendUrl) {
    return {
      available: false,
      normalizedUsername,
      error: "We could not verify this username right now. Please try again.",
    };
  }

  try {
    const response = await fetch(`${backendUrl}/identity/check-username`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ username: normalizedUsername }),
    });
    const json = (await response.json().catch(() => ({}))) as {
      available?: boolean;
      reserved?: boolean;
      normalized_key?: string;
      message?: string;
      warning?: string;
      detail?: unknown;
    };

    if (!response.ok || typeof json.available !== "boolean") {
      const detail = typeof json.detail === "string" ? json.detail : null;

      return {
        available: false,
        normalizedUsername,
        reserved: Boolean(json.reserved),
        error: json.message || detail || "We could not verify this username right now. Please try again.",
      };
    }

    if (json.reserved) {
      return {
        available: false,
        normalizedUsername,
        reserved: true,
        error:
          json.message ||
          "This username is reserved. If you represent this person or organization, please apply for verification.",
      };
    }

    const identityResult: UsernameAvailabilityResult = {
      available: json.available,
      normalizedUsername,
      reserved: Boolean(json.reserved),
      warning: json.warning,
    };

    if (!currentUserId || !identityResult.available) {
      return identityResult;
    }

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      const legacyResponse = await fetch(
        `${backendUrl}/auth/username-availability?username=${encodeURIComponent(normalizedUsername)}`,
        {
          headers: accessToken
            ? {
                Authorization: `Bearer ${accessToken}`,
              }
            : undefined,
        },
      );
      const legacyJson = (await legacyResponse.json().catch(() => ({}))) as {
        ok?: boolean;
        available?: boolean;
        normalized_username?: string;
        message?: string;
      };

      if (legacyResponse.ok && legacyJson.ok && typeof legacyJson.available === "boolean" && !legacyJson.available) {
        return {
          available: false,
          normalizedUsername: legacyJson.normalized_username || normalizedUsername,
          reserved: false,
          error: legacyJson.message || USERNAME_TAKEN_MESSAGE,
        };
      }
    } catch {
      return identityResult;
    }

    return identityResult;
  } catch {
    return {
      available: false,
      normalizedUsername,
      error: "We could not verify this username right now. Please try again.",
    };
  }
}

type BackendProfileResponse = {
  ok?: boolean;
  profile?: ProfileRow | null;
  detail?: unknown;
  error?: unknown;
  message?: unknown;
};

function getBackendProfileError(json: BackendProfileResponse, fallback: string): string {
  if (typeof json.detail === "string" && json.detail.trim()) {
    return json.detail.trim();
  }

  if (typeof json.message === "string" && json.message.trim()) {
    return json.message.trim();
  }

  if (typeof json.error === "string" && json.error.trim()) {
    return json.error.trim();
  }

  return fallback;
}

async function getBackendAccessToken(): Promise<string | null> {
  const { data: sessionData } = await supabase.auth.getSession();
  return sessionData.session?.access_token ?? null;
}

async function saveProfileThroughBackend(
  path: "/profile/ensure" | "/profile",
  method: "POST" | "PATCH",
  body: Record<string, unknown>,
  fallbackError: string,
): Promise<ProfileResult> {
  const backendUrl = getBackendUrl();

  if (!backendUrl) {
    return { profile: null, error: fallbackError };
  }

  const accessToken = await getBackendAccessToken();

  if (!accessToken) {
    return { profile: null, error: "Please log in to update your profile." };
  }

  try {
    const response = await fetch(`${backendUrl}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(body),
    });
    const json = (await response.json().catch(() => ({}))) as BackendProfileResponse;

    if (!response.ok || !json.ok || !json.profile) {
      return {
        profile: null,
        error: getBackendProfileError(json, fallbackError),
      };
    }

    return {
      profile: mapProfileRowToProfile(json.profile),
    };
  } catch {
    return { profile: null, error: fallbackError };
  }
}

async function ensureProfileThroughBackend(user: SupabaseUser, username?: string): Promise<ProfileResult> {
  const preferredUsername = normalizeUsername(username) || getPreferredUsername(user);

  return saveProfileThroughBackend(
    "/profile/ensure",
    "POST",
    {
      username: preferredUsername,
      display_name: preferredUsername,
    },
    "Could not save your profile right now.",
  );
}

async function syncProfileForUser(profile: Profile, user: SupabaseUser): Promise<ProfileResult> {
  const normalizedUsername = normalizeUsername(profile.username) || getPreferredUsername(user);
  const needsBackendSync =
    normalizedUsername !== profile.username ||
    (getUserVerifiedForProfile(user) && !profile.verified) ||
    !profile.public_profile_slug;

  if (!needsBackendSync) {
    return { profile };
  }

  const result = await ensureProfileThroughBackend(user, normalizedUsername);

  if (result.error) {
    return { profile, error: result.error };
  }

  return result.profile ? result : { profile };
}

async function insertProfileForUser(
  user: SupabaseUser,
  username: string,
): Promise<ProfileResult> {
  const finalUsername = normalizeUsername(username);
  const validationError = getUsernameValidationError(username);

  if (validationError || !finalUsername) {
    return { profile: null, error: validationError || "Username must be 3-20 characters." };
  }

  const result = await ensureProfileThroughBackend(user, finalUsername);

  if (!result.error) {
    console.log("PHASE 3 STEP 15 profile created", { userId: user.id, username: finalUsername });
    console.log("[profile] ensure profile result:", user.id);
    console.log("[profile] ensure result:", user.id);
  }

  return result;
}

export async function createProfile(
  userId: string,
  username: string,
  _displayName?: string,
): Promise<ProfileResult> {
  const normalizedUsername = normalizeUsername(username);
  const validationError = getUsernameValidationError(username);

  if (validationError || !normalizedUsername) {
    return { profile: null, error: validationError || "Username must be 3-20 characters." };
  }

  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user || data.user.id !== userId) {
    return { profile: null, error: "Please log in to create your profile." };
  }

  return ensureProfileThroughBackend(data.user, normalizedUsername);
}

export async function getProfile(userId: string): Promise<ProfileResult> {
  // PHASE 3 STEP 18C
  const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();

  if (error) {
    return {
      profile: null,
      error: getProfileLoadErrorMessage(),
    };
  }

  return {
    profile: data ? mapProfileRowToProfile(data as ProfileRow) : null,
  };
}

export async function getProfileByUsername(username: string): Promise<ProfileResult> {
  const normalizedUsername = normalizeUsername(username);

  if (!normalizedUsername) {
    return { profile: null };
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("username_normalized", normalizedUsername)
    .maybeSingle();

  if (error) {
    if (isMissingUsernameNormalizedColumn(error.message, error.code)) {
      const fallbackResult = await supabase
        .from("profiles")
        .select("*")
        .eq("username", normalizedUsername)
        .maybeSingle();

      if (!fallbackResult.error) {
        return {
          profile: fallbackResult.data ? mapProfileRowToProfile(fallbackResult.data as ProfileRow) : null,
        };
      }
    }

    return {
      profile: null,
      error: getProfileLoadErrorMessage(),
    };
  }

  return {
    profile: data ? mapProfileRowToProfile(data as ProfileRow) : null,
  };
}

export async function ensureProfileForUser(user: SupabaseUser): Promise<ProfileResult> {
  const existingProfile = await getProfile(user.id);

  if (existingProfile.error) {
    return existingProfile;
  }

  if (existingProfile.profile) {
    if (existingProfile.profile.is_deleted) {
      return { profile: existingProfile.profile, error: "This account has been deleted." };
    }

    const result = await syncProfileForUser(existingProfile.profile, user);
    console.log("[profile] ensure profile result:", result.profile?.id);
    console.log("[profile] ensure result:", result.profile?.id);
    return result;
  }

  console.log("PHASE 3 STEP 15 profile missing", { userId: user.id });

  const preferredUsername = getPreferredUsername(user);
  const usernameLookup = await getProfileByUsername(preferredUsername);

  if (usernameLookup.error) {
    return usernameLookup;
  }

  if (usernameLookup.profile?.id === user.id) {
    const result = await syncProfileForUser(usernameLookup.profile, user);
    console.log("[profile] ensure profile result:", result.profile?.id);
    console.log("[profile] ensure result:", result.profile?.id);
    return result;
  }

  if (usernameLookup.profile && usernameLookup.profile.id !== user.id) {
    return { profile: null, error: USERNAME_TAKEN_MESSAGE };
  }

  return insertProfileForUser(user, preferredUsername);
}

export async function updateProfile(userId: string, updates: ProfileUpdates): Promise<ProfileResult> {
  const normalizedUsername = updates.username !== undefined ? normalizeUsername(updates.username) : undefined;
  const usernameValidationError =
    updates.username !== undefined ? getUsernameValidationError(updates.username) : "";

  if (updates.avatar_url !== undefined && updates.avatar_url && !isValidAvatarUrl(updates.avatar_url)) {
    return { profile: null, error: "Avatar URL must be a valid URL." };
  }

  if (typeof updates.bio === "string" && updates.bio.length > 160) {
    return { profile: null, error: "Bio must be 160 characters or fewer." };
  }

  const normalizedUpdates = {
    ...updates,
    ...(updates.username !== undefined ? { username: normalizedUsername } : {}),
    ...(updates.username !== undefined && normalizedUsername
      ? { public_profile_slug: generateProfileSlug(normalizedUsername, userId) }
      : {}),
    ...(updates.bio !== undefined ? { bio: sanitizeBio(updates.bio ?? "") } : {}),
    ...(updates.profile_visibility !== undefined
      ? { profile_visibility: normalizeProfileVisibility(updates.profile_visibility) }
      : {}),
    updated_at: new Date().toISOString(),
  };

  if (updates.username !== undefined && (usernameValidationError || !normalizedUpdates.username)) {
    return { profile: null, error: usernameValidationError || "Username must be 3-20 characters." };
  }

  if (updates.username !== undefined && normalizedUsername) {
    const availability = await checkUsernameAvailability(normalizedUsername, userId);

    if (!availability.available) {
      return {
        profile: null,
        error: availability.error === USERNAME_TAKEN_MESSAGE ? USERNAME_NOT_AVAILABLE_MESSAGE : availability.error,
      };
    }
  }

  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError || !userData.user || userData.user.id !== userId) {
    return { profile: null, error: "Please log in to update your profile." };
  }

  return saveProfileThroughBackend(
    "/profile",
    "PATCH",
    normalizedUpdates,
    "Could not update your profile right now.",
  );
}
