export function getSafeInternalDestination(
  value: string | null | undefined,
  fallback = "/feed",
): string {
  if (
    !value ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("\\") ||
    /[\u0000-\u001f]/.test(value)
  ) {
    return fallback;
  }

  return value;
}
