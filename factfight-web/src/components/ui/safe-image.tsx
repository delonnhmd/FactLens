"use client";

import Image from "next/image";
import { useState } from "react";

interface SafeImageProps {
  readonly alt: string;
  readonly className?: string;
  readonly fill?: boolean;
  readonly height?: number;
  readonly priority?: boolean;
  readonly sizes: string;
  readonly src: string;
  readonly width?: number;
}

export function SafeImage({ alt, className, fill, height, priority, sizes, src, width }: SafeImageProps) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return null;
  }

  return (
    <Image
      alt={alt}
      className={className}
      fill={fill}
      height={height}
      onError={() => setFailed(true)}
      priority={priority}
      sizes={sizes}
      src={src}
      width={width}
    />
  );
}
