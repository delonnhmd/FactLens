// PHASE 3 STEP 15
export function normalizeUsername(input: string | null | undefined): string {
  const cleaned = (input ?? "")
    .trim()
    .replace(/^@+/, "")
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "")
    .slice(0, 24);

  return cleaned.length >= 3 ? cleaned : "";
}

export function generateFallbackUsername(email: string | null | undefined, userId: string): string {
  const emailPrefix = normalizeUsername((email ?? "").split("@")[0]);
  const baseUsername = emailPrefix || "user";
  const suffix = userId.replace(/-/g, "").slice(-6).toLowerCase() || "000000";
  const maxBaseLength = Math.max(3, 24 - suffix.length - 1);

  return `${baseUsername.slice(0, maxBaseLength)}_${suffix}`.slice(0, 24);
}
