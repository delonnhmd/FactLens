// PHASE 3 STEP 2
import { supabase } from "../lib/supabase";

export interface Profile {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  verified: boolean;
  reputation_score: number;
  created_at: string;
  updated_at: string;
}

export type ProfileUpdates = Partial<Pick<Profile, "username" | "display_name" | "avatar_url">>;

interface ProfileResult {
  profile: Profile | null;
  error?: string;
}

function getProfileErrorMessage(message: string, code?: string): string {
  const normalizedMessage = message.toLowerCase();

  if (code === "23505" || normalizedMessage.includes("duplicate") || normalizedMessage.includes("profiles_username_key")) {
    return "Username already taken.";
  }

  return "We could not load your profile. Please try again.";
}

export async function createProfile(
  userId: string,
  username: string,
  displayName?: string,
): Promise<ProfileResult> {
  const trimmedUsername = username.trim();
  const trimmedDisplayName = displayName?.trim() || trimmedUsername;

  const { data, error } = await supabase
    .from("profiles")
    .insert({
      id: userId,
      username: trimmedUsername,
      display_name: trimmedDisplayName,
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

export async function updateProfile(userId: string, updates: ProfileUpdates): Promise<ProfileResult> {
  const { data, error } = await supabase
    .from("profiles")
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
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
