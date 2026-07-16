// Shared claim-media resolver. One source of truth for "what media does this
// claim show, and how" — used by both the feed card (ClaimCard) and the claim
// detail screen so their media block behaves identically.
//
// Resolution order (a claim can technically have both an image and a video):
//   1. Uploaded image  -> render the image.
//   2. YouTube video   -> render the YouTube thumbnail + play overlay.
//   3. Other video URL -> render a compact link chip (no native player deps).
//   4. Nothing         -> render nothing (no empty box, no layout gap).
import type { ClaimMedia } from "../types/claim";
import { getYouTubeThumbnailUrl, getYouTubeVideoId } from "./videoUrl";

export type ResolvedClaimMedia =
  | {
      kind: "image";
      // `uri` is the display source (thumbnail-first, lighter for lists);
      // `fullUri` is the full-resolution image (used on the detail screen).
      uri: string;
      fullUri: string;
    }
  | { kind: "youtube"; url: string; videoId: string; thumbnailUrl: string }
  | { kind: "link"; url: string; platform: string }
  | { kind: "none" };

function firstNonEmpty(...values: Array<string | null | undefined>): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }

  return null;
}

export function resolveClaimMedia(media: ClaimMedia | null | undefined): ResolvedClaimMedia {
  if (!media) {
    return { kind: "none" };
  }

  // 1. Uploaded image wins. `thumbnailUrl` is already `thumbnail_url ?? image_url`
  //    from the mapper, so it is present whenever any image exists.
  const displayImage = firstNonEmpty(media.thumbnailUrl, media.imageUrl);
  const fullImage = firstNonEmpty(media.imageUrl, media.thumbnailUrl);

  if (displayImage && fullImage) {
    return { kind: "image", uri: displayImage, fullUri: fullImage };
  }

  // 2/3. Video: prefer an explicit YouTube URL, fall back to any video URL.
  const videoUrl = firstNonEmpty(media.youtubeUrl, media.videoUrl);

  if (videoUrl) {
    const videoId = getYouTubeVideoId(videoUrl);

    if (videoId) {
      return {
        kind: "youtube",
        url: videoUrl,
        videoId,
        thumbnailUrl:
          getYouTubeThumbnailUrl(videoUrl) ?? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
      };
    }

    return { kind: "link", url: videoUrl, platform: media.videoPlatform ?? "Video" };
  }

  return { kind: "none" };
}
