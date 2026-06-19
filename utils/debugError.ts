// PHASE 3 STEP 27

type DebuggableError = {
  message?: unknown;
  code?: unknown;
  details?: unknown;
  hint?: unknown;
};

function stringifyValue(value: unknown): string {
  if (value === null || value === undefined || value === "") {
    return "";
  }

  if (typeof value === "string") {
    return value;
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export function getDebugErrorParts(error: unknown) {
  const safeError = (error ?? {}) as DebuggableError;
  const fallback = stringifyValue(error);

  return {
    message: stringifyValue(safeError.message) || fallback || "Unknown error",
    code: stringifyValue(safeError.code),
    details: stringifyValue(safeError.details),
    hint: stringifyValue(safeError.hint),
    raw: fallback,
  };
}

export function formatErrorForDisplay(error: unknown): string {
  const parts = getDebugErrorParts(error);

  return [
    parts.message,
    parts.code ? `Code: ${parts.code}` : "",
    parts.details ? `Details: ${parts.details}` : "",
    parts.hint ? `Hint: ${parts.hint}` : "",
    !parts.code && !parts.details && !parts.hint && parts.raw ? parts.raw : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export const SOURCE_REVIEW_UNAVAILABLE_TITLE = "Source review unavailable";
export const SOURCE_REVIEW_UNAVAILABLE_BODY =
  "We could not automatically read this source. You can still submit the claim and the community can review it.";
export const SOURCE_REVIEW_UNAVAILABLE_NOTE = "Some websites block automated reading.";
export const SOURCE_REVIEW_UNAVAILABLE_ERROR =
  "This source could not be automatically reviewed. You can still submit the claim and let the community review it.";

const RAW_ERROR_PATTERNS = [
  /402/i,
  /403/i,
  /payment required/i,
  /forbidden/i,
  /client error/i,
  /requests/i,
  /traceback/i,
  /cloudflare/i,
  /ssl/i,
  /dns/i,
  /timeout/i,
  /timed out/i,
  /exception/i,
  /stack/i,
  /supabase/i,
  /postgrest/i,
  /schema/i,
  /constraint/i,
  /violates/i,
  /relation/i,
  /column/i,
  /https?:\/\//i,
];

export function isRawUserFacingError(value: unknown): boolean {
  const message = stringifyValue(value);

  return RAW_ERROR_PATTERNS.some((pattern) => pattern.test(message));
}

export function cleanUserError(error: unknown): string {
  const message = stringifyValue((error as DebuggableError | null)?.message) || stringifyValue(error);

  if (
    message === "Username is already taken" ||
    message === "Username is not available" ||
    message === "Username must be 3-20 characters." ||
    message === "Username can only use letters, numbers, and underscores."
  ) {
    return message;
  }

  if (isRawUserFacingError(message)) {
    return SOURCE_REVIEW_UNAVAILABLE_ERROR;
  }

  return "Something went wrong. Please try again.";
}

export function cleanSourceReviewText(value: unknown, fallback: string | null = SOURCE_REVIEW_UNAVAILABLE_BODY): string | null {
  const message = stringifyValue(value).trim();

  if (!message) {
    return null;
  }

  if (isRawUserFacingError(message)) {
    return fallback;
  }

  return message;
}
