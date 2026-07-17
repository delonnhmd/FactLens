import "server-only";

import { publicEnvironment } from "@/lib/validation/env";

import { getSafeExternalUrl, getYouTubeThumbnail } from "./urls";

const supabaseHostname = new URL(publicEnvironment.supabaseUrl).hostname.toLowerCase();
const youtubeThumbnailHosts = new Set(["img.youtube.com", "i.ytimg.com"]);

export function getApprovedImageUrl(value: string | null | undefined): string | null {
  const safeUrl = getSafeExternalUrl(value);

  if (!safeUrl) {
    return null;
  }

  const parsed = new URL(safeUrl);
  const hostname = parsed.hostname.toLowerCase();

  if (
    hostname === supabaseHostname &&
    parsed.pathname.startsWith("/storage/v1/object/public/")
  ) {
    return safeUrl;
  }

  if (youtubeThumbnailHosts.has(hostname) && parsed.protocol === "https:") {
    return safeUrl;
  }

  return null;
}

export type ResolvedClaimMedia =
  | { readonly kind: "image"; readonly url: string }
  | { readonly kind: "youtube"; readonly thumbnailUrl: string; readonly sourceUrl: string }
  | { readonly kind: "external"; readonly sourceUrl: string }
  | { readonly kind: "none" };

export function resolveClaimMedia(input: {
  readonly imageUrl: string | null;
  readonly thumbnailUrl: string | null;
  readonly videoUrl: string | null;
}): ResolvedClaimMedia {
  const imageUrl =
    getApprovedImageUrl(input.thumbnailUrl) ?? getApprovedImageUrl(input.imageUrl);

  if (imageUrl) {
    return { kind: "image", url: imageUrl };
  }

  const safeVideoUrl = getSafeExternalUrl(input.videoUrl);
  const youtubeThumbnail = safeVideoUrl ? getYouTubeThumbnail(safeVideoUrl) : null;

  if (safeVideoUrl && youtubeThumbnail && getApprovedImageUrl(youtubeThumbnail)) {
    return { kind: "youtube", thumbnailUrl: youtubeThumbnail, sourceUrl: safeVideoUrl };
  }

  if (safeVideoUrl) {
    return { kind: "external", sourceUrl: safeVideoUrl };
  }

  return { kind: "none" };
}
