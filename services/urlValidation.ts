// PHASE 2 STEP 8
const supportedVideoHosts = [
  "youtube.com",
  "youtu.be",
  "tiktok.com",
  "x.com",
  "twitter.com",
  "facebook.com",
  "instagram.com",
];

const videoExtensions = [".mp4", ".mov", ".webm", ".m4v"];

export function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value.trim());
}

export function isValidHttpUrl(value: string): boolean {
  if (!isHttpUrl(value)) {
    return false;
  }

  try {
    const parsedUrl = new URL(value.trim());
    return Boolean(parsedUrl.hostname);
  } catch {
    return false;
  }
}

export function isValidVideoUrl(value: string): boolean {
  if (!isValidHttpUrl(value)) {
    return false;
  }

  const trimmedValue = value.trim().toLowerCase();

  try {
    const parsedUrl = new URL(trimmedValue);
    const hostname = parsedUrl.hostname.replace(/^www\./, "");
    const supportedHost = supportedVideoHosts.some((host) => hostname === host || hostname.endsWith(`.${host}`));
    const supportedExtension = videoExtensions.some((extension) => parsedUrl.pathname.endsWith(extension));

    return supportedHost || supportedExtension;
  } catch {
    return false;
  }
}

export function containsProhibitedContent(value: string, prohibitedTerms: string[]): boolean {
  const normalizedValue = value.toLowerCase();
  return prohibitedTerms.some((term) => normalizedValue.includes(term.toLowerCase()));
}

