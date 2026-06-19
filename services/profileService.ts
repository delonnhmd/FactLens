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
import { generateFallbackUsername, getUsernameValidationError, normalizeUsername, USERNAME_MAX_LENGTH } from "../utils/username";
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
  error?: string;
}

export const USERNAME_TAKEN_MESSAGE = "Username is already taken";
export const USERNAME_NOT_AVAILABLE_MESSAGE = "Username is not available";
const FALLBACK_USERNAME_MESSAGE = "That username was taken, so Verifact created a fallback username for you.";

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

function isDuplicateProfileIdError(message: string, code?: string): boolean {
  const normalizedMessage = message.toLowerCase();

  return (
    (code === "23505" || normalizedMessage.includes("duplicate")) &&
    (normalizedMessage.includes("profiles_pkey") ||
      normalizedMessage.includes("profiles_id_key") ||
      normalizedMessage.includes("id"))
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

function getDisplayName(user: SupabaseUser, username: string): string {
  return (
    readMetadataString(user, "displayName") ||
    readMetadataString(user, "full_name") ||
    readMetadataString(user, "username") ||
    getEmailPrefix(user) ||
    username
  );
}

function withUserIdSuffix(username: string, userId: string): string {
  const suffix = userId.replace(/-/g, "").slice(-6).toLowerCase() || "000000";
  const normalizedUsername = normalizeUsername(username) || "user";
  const maxBaseLength = Math.max(3, USERNAME_MAX_LENGTH - suffix.length - 1);

  return `${normalizedUsername.slice(0, maxBaseLength)}_${suffix}`.slice(0, USERNAME_MAX_LENGTH);
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
      error: "Could not check username availability right now.",
    };
  }

  try {
    const { data: sessionData } = currentUserId ? await supabase.auth.getSession() : { data: { session: null } };
    const accessToken = sessionData.session?.access_token;
    const response = await fetch(
      `${backendUrl}/auth/username-availability?username=${encodeURIComponent(normalizedUsername)}`,
      {
        headers: accessToken
          ? {
              Authorization: `Bearer ${accessToken}`,
            }
          : undefined,
      },
    );
    const json = (await response.json().catch(() => ({}))) as {
      ok?: boolean;
      available?: boolean;
      normalized_username?: string;
      message?: string;
      detail?: unknown;
    };

    if (!response.ok || !json.ok || typeof json.available !== "boolean") {
      const detail = typeof json.detail === "string" ? json.detail : null;

      return {
        available: false,
        normalizedUsername,
        error: json.message || detail || "Could not check username availability right now.",
      };
    }

    return {
      available: json.available,
      normalizedUsername: json.normalized_username || normalizedUsername,
      error: json.available ? undefined : json.message || USERNAME_TAKEN_MESSAGE,
    };
  } catch {
    return {
      available: false,
      normalizedUsername,
      error: "Could not check username availability right now.",
    };
  }
}

async function syncProfileForUser(profile: Profile, user: SupabaseUser): Promise<ProfileResult> {
  const updates: Partial<Pick<Profile, "username" | "verified" | "public_profile_slug">> & { updated_at?: string } = {};
  const normalizedUsername = normalizeUsername(profile.username) || getPreferredUsername(user);
  let message: string | undefined;

  if (normalizedUsername && normalizedUsername !== profile.username) {
    const usernameLookup = await getProfileByUsername(normalizedUsername);

    if (usernameLookup.error) {
      return { profile, error: usernameLookup.error };
    }

    if (usernameLookup.profile && usernameLookup.profile.id !== user.id) {
      updates.username = withUserIdSuffix(normalizedUsername, user.id);
      message = FALLBACK_USERNAME_MESSAGE;
      console.log("PHASE 3 STEP 15 fallback username used", {
        userId: user.id,
        username: updates.username,
      });
    } else {
      updates.username = normalizedUsername;
    }
  }

  // PHASE 3 STEP 22
  // PHASE 3 STEP 28
  if (getUserVerifiedForProfile(user) && !profile.verified) {
    updates.verified = true;
  }

  // PHASE 5 STEP 1E
  if (!profile.public_profile_slug) {
    updates.public_profile_slug = generateProfileSlug(normalizedUsername, user.id);
  }

  if (Object.keys(updates).length === 0) {
    return { profile };
  }

  const { data, error } = await supabase
    .from("profiles")
    .update({
      ...updates,
      ...(updates.username ? { display_name: updates.username } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id)
    .select()
    .single();

  if (error) {
    return { profile, error: getProfileErrorMessage(error.message, error.code) };
  }

  return { profile: mapProfileRowToProfile(data as ProfileRow), message };
}

async function insertProfileForUser(
  user: SupabaseUser,
  username: string,
  displayName: string,
): Promise<ProfileResult> {
  const finalUsername = normalizeUsername(username);
  const validationError = getUsernameValidationError(username);

  if (validationError || !finalUsername) {
    return { profile: null, error: validationError || "Username must be 3-20 characters." };
  }

  const { data, error } = await supabase
    .from("profiles")
    .insert({
      id: user.id,
      username: finalUsername,
      display_name: finalUsername,
      // PHASE 5 STEP 1E
      public_profile_slug: generateProfileSlug(finalUsername, user.id),
      profile_visibility: "public",
      // PHASE 3 STEP 22
      // PHASE 3 STEP 28
      verified: getUserVerifiedForProfile(user),
    })
    .select()
    .single();

  if (error) {
    if (isDuplicateProfileIdError(error.message, error.code)) {
      const existingProfile = await getProfile(user.id);

      if (existingProfile.profile) {
        return syncProfileForUser(existingProfile.profile, user);
      }
    }

    return {
      profile: null,
      error: getProfileErrorMessage(error.message, error.code),
    };
  }

  console.log("PHASE 3 STEP 15 profile created", { userId: user.id, username: finalUsername });
  console.log("[profile] ensure profile result:", user.id);
  console.log("[profile] ensure result:", user.id);

  return {
    profile: mapProfileRowToProfile(data as ProfileRow),
  };
}

export async function createProfile(
  userId: string,
  username: string,
  displayName?: string,
): Promise<ProfileResult> {
  const normalizedUsername = normalizeUsername(username);
  const validationError = getUsernameValidationError(username);

  if (validationError || !normalizedUsername) {
    return { profile: null, error: validationError || "Username must be 3-20 characters." };
  }

  const { data, error } = await supabase
    .from("profiles")
    .insert({
      id: userId,
      username: normalizedUsername,
      display_name: normalizedUsername,
      // PHASE 5 STEP 1E
      public_profile_slug: generateProfileSlug(normalizedUsername, userId),
      profile_visibility: "public",
      // PHASE 3 STEP 28
      verified: APP_CONFIG.REQUIRE_EMAIL_VERIFICATION ? false : true,
    })
    .select()
    .single();

  if (error) {
    return {
      profile: null,
      error: getProfileErrorMessage(error.message, error.code),
    };
  }

  return {
    profile: mapProfileRowToProfile(data as ProfileRow),
  };
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
  const displayName = getDisplayName(user, preferredUsername);
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

  return insertProfileForUser(user, preferredUsername, displayName);
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

  const { data, error } = await supabase
    .from("profiles")
    .update({
      ...normalizedUpdates,
      ...(updates.username !== undefined && normalizedUsername
        ? { display_name: normalizedUsername }
        : {}),
    })
    .eq("id", userId)
    .select()
    .single();

  if (error) {
    return {
      profile: null,
      error: getProfileErrorMessage(error.message, error.code, USERNAME_NOT_AVAILABLE_MESSAGE),
    };
  }

  return {
    profile: mapProfileRowToProfile(data as ProfileRow),
  };
}
