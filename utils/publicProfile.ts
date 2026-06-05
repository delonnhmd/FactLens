// PHASE 5 STEP 1E
export type ProfileVisibility = "public" | "private";

export function normalizeProfileSlug(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

export function generateProfileSlug(username: string, userId?: string): string {
  const baseSlug = normalizeProfileSlug(username) || "user";
  const suffix = userId?.replace(/-/g, "").slice(-6).toLowerCase();

  return suffix ? `${baseSlug}-${suffix}`.slice(0, 48) : baseSlug;
}

export function isValidAvatarUrl(input: string): boolean {
  const trimmedInput = input.trim();

  if (!trimmedInput) {
    return true;
  }

  try {
    const parsedUrl = new URL(trimmedInput);
    return parsedUrl.protocol === "http:" || parsedUrl.protocol === "https:";
  } catch {
    return false;
  }
}

export function sanitizeBio(input: string): string {
  return input
    .replace(/[<>]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160);
}

export function normalizeProfileVisibility(input: string | null | undefined): ProfileVisibility {
  return input === "private" ? "private" : "public";
}
