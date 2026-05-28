// PHASE 3 STEP 2
// PHASE 3 STEP 15
import type { User as SupabaseUser } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import { generateFallbackUsername, normalizeUsername } from "../utils/username";
import type { VerificationUserRole } from "../types/verification";

export interface Profile {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  verified: boolean;
  reputation_score: number;
  // PHASE 3 STEP 17
  votes_cast: number;
  accuracy_rate: number | null;
  trust_tier: VerificationUserRole;
  trust_weight_override: number | null;
  created_at: string;
  updated_at: string;
}

export type ProfileUpdates = Partial<Pick<Profile, "username" | "display_name" | "avatar_url">>;

export interface ProfileResult {
  profile: Profile | null;
  error?: string;
  message?: string;
}

const FALLBACK_USERNAME_MESSAGE = "That username was taken, so FactLens created a fallback username for you.";

function readMetadataString(user: SupabaseUser, key: string): string | undefined {
  const value = user.user_metadata?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function isDuplicateUsernameError(message: string, code?: string): boolean {
  const normalizedMessage = message.toLowerCase();

  return (
    (code === "23505" || normalizedMessage.includes("duplicate")) &&
    (normalizedMessage.includes("username") || normalizedMessage.includes("profiles_username_key"))
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

function getProfileErrorMessage(message: string, code?: string): string {
  if (isDuplicateUsernameError(message, code)) {
    return "Username already taken.";
  }

  return "We could not load your profile. Please try again.";
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
  const maxBaseLength = Math.max(3, 24 - suffix.length - 1);

  return `${normalizedUsername.slice(0, maxBaseLength)}_${suffix}`.slice(0, 24);
}

async function syncProfileForUser(profile: Profile, user: SupabaseUser): Promise<ProfileResult> {
  const updates: Partial<Pick<Profile, "username" | "verified">> & { updated_at?: string } = {};
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

  if (user.email_confirmed_at && !profile.verified) {
    updates.verified = true;
  }

  if (Object.keys(updates).length === 0) {
    return { profile };
  }

  const { data, error } = await supabase
    .from("profiles")
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id)
    .select()
    .single();

  if (error) {
    return { profile, error: getProfileErrorMessage(error.message, error.code) };
  }

  return { profile: data as Profile, message };
}

async function insertProfileForUser(
  user: SupabaseUser,
  username: string,
  displayName: string,
): Promise<ProfileResult> {
  const finalUsername = normalizeUsername(username);

  if (!finalUsername) {
    return { profile: null, error: "Username must be at least 3 characters." };
  }

  const { data, error } = await supabase
    .from("profiles")
    .insert({
      id: user.id,
      username: finalUsername,
      display_name: displayName.trim() || finalUsername,
      verified: Boolean(user.email_confirmed_at),
      reputation_score: 0,
      votes_cast: 0,
      accuracy_rate: null,
      trust_tier: "new",
      trust_weight_override: null,
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

  return {
    profile: data as Profile,
  };
}

export async function createProfile(
  userId: string,
  username: string,
  displayName?: string,
): Promise<ProfileResult> {
  const normalizedUsername = normalizeUsername(username);

  if (!normalizedUsername) {
    return { profile: null, error: "Username must be at least 3 characters." };
  }

  const { data, error } = await supabase
    .from("profiles")
    .insert({
      id: userId,
      username: normalizedUsername,
      display_name: displayName?.trim() || normalizedUsername,
      votes_cast: 0,
      accuracy_rate: null,
      trust_tier: "new",
      trust_weight_override: null,
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
    profile: data as Profile,
  };
}

export async function getProfile(userId: string): Promise<ProfileResult> {
  const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();

  if (error) {
    return {
      profile: null,
      error: getProfileErrorMessage(error.message, error.code),
    };
  }

  return {
    profile: (data as Profile | null) ?? null,
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
    .eq("username", normalizedUsername)
    .maybeSingle();

  if (error) {
    return {
      profile: null,
      error: getProfileErrorMessage(error.message, error.code),
    };
  }

  return {
    profile: (data as Profile | null) ?? null,
  };
}

export async function ensureProfileForUser(user: SupabaseUser): Promise<ProfileResult> {
  const existingProfile = await getProfile(user.id);

  if (existingProfile.error) {
    return existingProfile;
  }

  if (existingProfile.profile) {
    return syncProfileForUser(existingProfile.profile, user);
  }

  console.log("PHASE 3 STEP 15 profile missing", { userId: user.id });

  const preferredUsername = getPreferredUsername(user);
  const displayName = getDisplayName(user, preferredUsername);
  const usernameLookup = await getProfileByUsername(preferredUsername);

  if (usernameLookup.error) {
    return usernameLookup;
  }

  if (usernameLookup.profile?.id === user.id) {
    return syncProfileForUser(usernameLookup.profile, user);
  }

  let finalUsername = preferredUsername;
  let fallbackMessage: string | undefined;

  if (usernameLookup.profile && usernameLookup.profile.id !== user.id) {
    finalUsername = withUserIdSuffix(preferredUsername, user.id);
    fallbackMessage = FALLBACK_USERNAME_MESSAGE;
    console.log("PHASE 3 STEP 15 fallback username used", {
      userId: user.id,
      username: finalUsername,
    });
  }

  const insertResult = await insertProfileForUser(user, finalUsername, displayName);

  if (insertResult.profile || insertResult.error !== "Username already taken.") {
    return {
      ...insertResult,
      message: fallbackMessage ?? insertResult.message,
    };
  }

  const retryUsername = withUserIdSuffix(finalUsername, user.id);
  console.log("PHASE 3 STEP 15 fallback username used", {
    userId: user.id,
    username: retryUsername,
  });

  const retryResult = await insertProfileForUser(user, retryUsername, displayName);

  return {
    ...retryResult,
    message: retryResult.profile ? FALLBACK_USERNAME_MESSAGE : retryResult.message,
  };
}

export async function updateProfile(userId: string, updates: ProfileUpdates): Promise<ProfileResult> {
  const normalizedUpdates = {
    ...updates,
    ...(updates.username !== undefined ? { username: normalizeUsername(updates.username) } : {}),
    updated_at: new Date().toISOString(),
  };

  if (updates.username !== undefined && !normalizedUpdates.username) {
    return { profile: null, error: "Username must be at least 3 characters." };
  }

  const { data, error } = await supabase
    .from("profiles")
    .update(normalizedUpdates)
    .eq("id", userId)
    .select()
    .single();

  if (error) {
    return {
      profile: null,
      error: getProfileErrorMessage(error.message, error.code),
    };
  }

  return {
    profile: data as Profile,
  };
}
