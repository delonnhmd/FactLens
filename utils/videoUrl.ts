// PHASE 3 STEP 8
export type VideoPlatform = "YouTube" | "TikTok" | "X" | "Facebook" | "Instagram" | "Video Link";

const WEB_DOMAIN_PATTERN = /^(?:[a-z0-9-]+\.)+[a-z]{2,}(?::\d+)?(?:[/?#].*)?$/i;

function getParsedUrl(url: string): URL | null {
  const normalizedUrl = normalizeUrl(url);

  if (!/^https?:\/\//i.test(normalizedUrl)) {
    return null;
  }

  try {
    const parsedUrl = new URL(normalizedUrl);
    return parsedUrl.hostname ? parsedUrl : null;
  } catch {
    return null;
  }
}

function getNormalizedHostname(url: URL): string {
  return url.hostname.replace(/^www\./i, "").toLowerCase();
}

function matchesHost(hostname: string, host: string): boolean {
  return hostname === host || hostname.endsWith(`.${host}`);
}

export function normalizeUrl(url: string): string {
  const trimmedUrl = url.trim();

  if (!trimmedUrl) {
    return "";
  }

  if (/^https?:\/\//i.test(trimmedUrl)) {
    return trimmedUrl;
  }

  if (trimmedUrl.startsWith("//")) {
    return `https:${trimmedUrl}`;
  }

  if (WEB_DOMAIN_PATTERN.test(trimmedUrl)) {
    return `https://${trimmedUrl}`;
  }

  return trimmedUrl;
}

export function isValidWebUrl(url: string): boolean {
  const normalizedUrl = normalizeUrl(url);

  if (!/^https?:\/\//i.test(normalizedUrl)) {
    return false;
  }

  try {
    const parsedUrl = new URL(normalizedUrl);
    return Boolean(parsedUrl.hostname && (parsedUrl.hostname.includes(".") || parsedUrl.hostname === "localhost"));
  } catch {
    return false;
  }
}

export function detectVideoPlatform(url: string): VideoPlatform | null {
  const parsedUrl = getParsedUrl(url);

  if (!parsedUrl) {
    return null;
  }

  const hostname = getNormalizedHostname(parsedUrl);

  if (matchesHost(hostname, "youtube.com") || hostname === "youtu.be") {
    return "YouTube";
  }

  if (matchesHost(hostname, "tiktok.com")) {
    return "TikTok";
  }

  if (matchesHost(hostname, "x.com") || matchesHost(hostname, "twitter.com")) {
    return "X";
  }

  if (matchesHost(hostname, "facebook.com") || hostname === "fb.watch") {
    return "Facebook";
  }

  if (matchesHost(hostname, "instagram.com")) {
    return "Instagram";
  }

  return "Video Link";
}

export function isSupportedVideoUrl(url: string): boolean {
  return Boolean(detectVideoPlatform(url));
}

export function getYouTubeVideoId(url: string): string | null {
  const parsedUrl = getParsedUrl(url);

  if (!parsedUrl) {
    return null;
  }

  const hostname = getNormalizedHostname(parsedUrl);

  if (hostname === "youtu.be") {
    return parsedUrl.pathname.split("/").filter(Boolean)[0] ?? null;
  }

  if (!matchesHost(hostname, "youtube.com")) {
    return null;
  }

  const watchId = parsedUrl.searchParams.get("v");

  if (watchId) {
    return watchId;
  }

  const pathParts = parsedUrl.pathname.split("/").filter(Boolean);
  const embeddedPathIndex = pathParts.findIndex((part) => ["embed", "shorts", "live"].includes(part));

  if (embeddedPathIndex >= 0) {
    return pathParts[embeddedPathIndex + 1] ?? null;
  }

  return null;
}

export function getYouTubeThumbnailUrl(url: string): string | null {
  const videoId = getYouTubeVideoId(url);

  if (!videoId) {
    return null;
  }

  return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
}
