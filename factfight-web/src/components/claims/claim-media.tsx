import { ExternalLink, Play } from "lucide-react";

import { SafeImage } from "@/components/ui/safe-image";
import type { PublicClaim } from "@/lib/types/claim";
import { resolveClaimMedia } from "@/lib/utils/images";

interface ClaimMediaProps {
  readonly claim: PublicClaim;
  readonly priority?: boolean;
}

export function ClaimMedia({ claim, priority = false }: ClaimMediaProps) {
  const media = resolveClaimMedia(claim);

  if (media.kind === "none") {
    return null;
  }

  if (media.kind === "external") {
    return (
      <a
        className="inline-flex items-center gap-2 rounded-[var(--ff-radius-card)] border border-[var(--ff-border)] bg-[var(--ff-surface)] px-3 py-2 text-sm font-medium text-[var(--ff-navy)]"
        href={media.sourceUrl}
        rel="noopener noreferrer"
        target="_blank"
      >
        <ExternalLink aria-hidden="true" size={16} strokeWidth={1.8} />
        Open external media
      </a>
    );
  }

  const src = media.kind === "image" ? media.url : media.thumbnailUrl;

  const content = (
    <div className="relative aspect-video overflow-hidden rounded-[var(--ff-radius-card)] border border-[var(--ff-border)] bg-[var(--ff-surface)]">
      <SafeImage
        alt={media.kind === "youtube" ? `Video preview for ${claim.title}` : `Image for ${claim.title}`}
        className="object-cover"
        fill
        priority={priority}
        sizes="(max-width: 768px) 100vw, 680px"
        src={src}
      />
      {media.kind === "youtube" ? (
        <span className="absolute inset-0 flex items-center justify-center bg-black/10">
          <span className="flex size-12 items-center justify-center rounded-full bg-white/95 text-[var(--ff-navy)]">
            <Play aria-hidden="true" fill="currentColor" size={21} />
            <span className="sr-only">Open video</span>
          </span>
        </span>
      ) : null}
    </div>
  );

  return media.kind === "youtube" ? (
    <a href={media.sourceUrl} rel="noopener noreferrer" target="_blank">
      {content}
    </a>
  ) : (
    content
  );
}
