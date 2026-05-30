// PHASE 3 STEP 28
const WEB_DOMAIN_PATTERN = /^(?:[a-z0-9-]+\.)+[a-z]{2,}(?::\d+)?(?:[/?#].*)?$/i;

export function normalizeUrl(input: string): string {
  const trimmedInput = input.trim();

  if (!trimmedInput) {
    return "";
  }

  if (/^https?:\/\//i.test(trimmedInput)) {
    return trimmedInput;
  }

  if (trimmedInput.startsWith("//")) {
    return `https:${trimmedInput}`;
  }

  return `https://${trimmedInput}`;
}

export function isValidSourceUrl(input: string): boolean {
  const normalizedUrl = normalizeUrl(input);

  if (!/^https?:\/\//i.test(normalizedUrl)) {
    return false;
  }

  try {
    const parsedUrl = new URL(normalizedUrl);
    const hostname = parsedUrl.hostname;

    return Boolean(
      hostname &&
        (hostname === "localhost" || WEB_DOMAIN_PATTERN.test(hostname)),
    );
  } catch {
    return false;
  }
}
