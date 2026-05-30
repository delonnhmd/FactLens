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
