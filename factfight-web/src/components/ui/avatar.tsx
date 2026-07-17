import { BadgeCheck } from "lucide-react";

import { SafeImage } from "@/components/ui/safe-image";
import { getApprovedImageUrl } from "@/lib/utils/images";

interface AvatarProps {
  readonly avatarUrl: string | null;
  readonly displayName: string;
  readonly size?: "small" | "medium";
  readonly verified?: boolean;
}

export function Avatar({ avatarUrl, displayName, size = "medium", verified = false }: AvatarProps) {
  const imageUrl = getApprovedImageUrl(avatarUrl);
  const initial = displayName.trim().charAt(0).toUpperCase() || "F";
  const dimensions = size === "small" ? "size-10" : "size-12";
  const pixels = size === "small" ? 40 : 48;

  return (
    <span className="relative inline-flex shrink-0">
      <span
        aria-label={`${displayName} avatar`}
        className={`relative inline-flex ${dimensions} items-center justify-center overflow-hidden rounded-full border border-[var(--ff-border)] bg-[var(--ff-surface)] text-sm font-medium text-[var(--ff-navy)]`}
        role="img"
      >
        <span aria-hidden="true">{initial}</span>
        {imageUrl ? (
          <SafeImage
            alt=""
            className="object-cover"
            fill
            sizes={`${pixels}px`}
            src={imageUrl}
          />
        ) : null}
      </span>
      {verified ? (
        <BadgeCheck
          aria-label="Verified account"
          className="absolute -right-1 -bottom-0.5 rounded-full bg-white text-[var(--ff-ai)]"
          fill="white"
          size={17}
          strokeWidth={2}
        />
      ) : null}
    </span>
  );
}
