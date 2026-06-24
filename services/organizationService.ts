import { supabase } from "../lib/supabase";
import { normalizeProfileSlug } from "../utils/publicProfile";

export interface OrganizationProfile {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  avatarUrl: string | null;
  verified: boolean;
  createdAt: string | null;
}

interface OrganizationRow {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  avatar_url?: string | null;
  verified?: boolean | null;
  created_at?: string | null;
}

export async function fetchOrganizationBySlug(slug: string): Promise<{ organization: OrganizationProfile | null; error?: string }> {
  const normalizedSlug = normalizeProfileSlug(slug);

  if (!normalizedSlug) {
    return { organization: null, error: "Organization not found." };
  }

  const { data, error } = await supabase
    .from("organizations")
    .select("id,name,slug,description,avatar_url,verified,created_at")
    .eq("slug", normalizedSlug)
    .maybeSingle();

  if (error) {
    console.log("[organization] load error:", {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });
    return { organization: null, error: "Could not load organization." };
  }

  const row = data as OrganizationRow | null;

  return {
    organization: row
      ? {
          id: row.id,
          name: row.name,
          slug: row.slug,
          description: row.description ?? null,
          avatarUrl: row.avatar_url ?? null,
          verified: Boolean(row.verified),
          createdAt: row.created_at ?? null,
        }
      : null,
    error: row ? undefined : "Organization not found.",
  };
}
