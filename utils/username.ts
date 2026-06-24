// PHASE 3 STEP 15
export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 20;
const USERNAME_ALLOWED_PATTERN = /^[a-z0-9_]+$/;
const GENERATED_PLACEHOLDER_PATTERN = /^[a-z][a-z0-9]{2,12}_[a-f0-9]{6}$/;

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

function getStableFourDigits(seed: string): string {
  const safeSeed = seed.trim() || "user";
  let hash = 0;

  for (let index = 0; index < safeSeed.length; index += 1) {
    hash = (hash * 31 + safeSeed.charCodeAt(index)) >>> 0;
  }

  return String(1000 + (hash % 9000)).padStart(4, "0");
}

export function generateDefaultUsername(seed: string | null | undefined): string {
  return `user_${getStableFourDigits(seed ?? "")}`;
}

export function generateFallbackUsername(email: string | null | undefined, userId: string): string {
  return generateDefaultUsername(userId || email || "");
}

export function isGeneratedPlaceholderUsername(input: string | null | undefined): boolean {
  const normalized = normalizeUsername(input);

  return Boolean(normalized && GENERATED_PLACEHOLDER_PATTERN.test(normalized));
}

export function getReviewSafeUsername(input: string | null | undefined, seed: string | null | undefined): string {
  const normalized = normalizeUsername(input);

  if (!normalized || isGeneratedPlaceholderUsername(normalized)) {
    return generateDefaultUsername(seed || input || "");
  }

  return normalized;
}

export function getReviewSafeDisplayName(
  displayName: string | null | undefined,
  username: string | null | undefined,
  seed: string | null | undefined,
): string {
  const trimmedDisplayName = (displayName ?? "").trim();

  if (trimmedDisplayName && !isGeneratedPlaceholderUsername(trimmedDisplayName)) {
    return trimmedDisplayName;
  }

  return getReviewSafeUsername(username, seed);
}
