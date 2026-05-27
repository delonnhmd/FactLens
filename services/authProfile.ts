// PHASE 3 STEP 1
import type { User as SupabaseUser } from "@supabase/supabase-js";

interface AuthProfile {
  email: string;
  username: string;
  displayName: string;
  avatar: string | null;
  initial: string;
}

function readMetadataString(user: SupabaseUser | null, key: string): string | undefined {
  const value = user?.user_metadata?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export function getAuthProfile(user: SupabaseUser | null): AuthProfile {
  const email = user?.email ?? "";
  const emailName = email.split("@")[0] || "user";
  const username = readMetadataString(user, "username") ?? emailName;
  const displayName = readMetadataString(user, "displayName") ?? readMetadataString(user, "full_name") ?? username;
  const avatar = readMetadataString(user, "avatar_url") ?? readMetadataString(user, "avatar") ?? null;
  const initial = displayName.slice(0, 1).toUpperCase() || "U";

  return {
    email,
    username,
    displayName,
    avatar,
    initial,
  };
}
