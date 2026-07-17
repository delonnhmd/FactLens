const allowedExternalProtocols = new Set(["http:", "https:"]);

export function getSafeExternalUrl(value: string | null | undefined): string | null {
  const candidate = value?.trim();

  if (!candidate || candidate.startsWith("//") || candidate.includes("\\")) {
    return null;
  }

  try {
    const parsed = new URL(candidate);

    if (
      !allowedExternalProtocols.has(parsed.protocol) ||
      !parsed.hostname ||
      parsed.username ||
      parsed.password
    ) {
      return null;
    }

    return parsed.toString();
  } catch {
    return null;
  }
}

export function getSourceDomain(value: string | null | undefined): string | null {
  const safeUrl = getSafeExternalUrl(value);

  if (!safeUrl) {
    return null;
  }

  return new URL(safeUrl).hostname.replace(/^www\./i, "").toLowerCase();
}

export function getYouTubeThumbnail(value: string | null | undefined): string | null {
  const safeUrl = getSafeExternalUrl(value);

  if (!safeUrl) {
    return null;
  }

  const parsed = new URL(safeUrl);
  const hostname = parsed.hostname.replace(/^www\./i, "").toLowerCase();
  let videoId: string | null = null;

  if (hostname === "youtu.be") {
    videoId = parsed.pathname.split("/").filter(Boolean)[0] ?? null;
  } else if (hostname === "youtube.com" || hostname.endsWith(".youtube.com")) {
    if (parsed.pathname === "/watch") {
      videoId = parsed.searchParams.get("v");
    } else {
      const segments = parsed.pathname.split("/").filter(Boolean);
      if (["embed", "shorts", "live"].includes(segments[0] ?? "")) {
        videoId = segments[1] ?? null;
      }
    }
  }

  if (!videoId || !/^[A-Za-z0-9_-]{6,20}$/.test(videoId)) {
    return null;
  }

  return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
}
