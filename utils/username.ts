// PHASE 3 STEP 15
export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 20;
const USERNAME_ALLOWED_PATTERN = /^[a-z0-9_]+$/;

function stripUsernamePrefix(input: string): string {
  return input.trim().replace(/^@+/, "");
}

export function normalizeUsername(input: string | null | undefined): string {
  const cleaned = stripUsernamePrefix(input ?? "").toLowerCase();

  if (
    cleaned.length < USERNAME_MIN_LENGTH ||
    cleaned.length > USERNAME_MAX_LENGTH ||
    !USERNAME_ALLOWED_PATTERN.test(cleaned)
  ) {
    return "";
  }

  return cleaned;
}

export function getUsernameValidationError(input: string | null | undefined): string {
  const trimmed = stripUsernamePrefix(input ?? "");

  if (!trimmed) {
    return "Username is required.";
  }

  if (trimmed.length < USERNAME_MIN_LENGTH || trimmed.length > USERNAME_MAX_LENGTH) {
    return "Username must be 3-20 characters.";
  }

  if (!USERNAME_ALLOWED_PATTERN.test(trimmed.toLowerCase())) {
    return "Username can only use letters, numbers, and underscores.";
  }

  return "";
}

export function generateFallbackUsername(email: string | null | undefined, userId: string): string {
  const emailPrefix = normalizeUsername((email ?? "").split("@")[0]);
  const baseUsername = emailPrefix || "user";
  const suffix = userId.replace(/-/g, "").slice(-6).toLowerCase() || "000000";
  const maxBaseLength = Math.max(USERNAME_MIN_LENGTH, USERNAME_MAX_LENGTH - suffix.length - 1);

  return `${baseUsername.slice(0, maxBaseLength)}_${suffix}`.slice(0, USERNAME_MAX_LENGTH);
}
