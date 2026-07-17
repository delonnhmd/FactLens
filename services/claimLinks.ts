// PHASE 2 STEP 8
import { SHARE_BASE_URL } from "../constants/launchConfig";

export function generateClaimSlug(title: string): string {
  const slug = title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72);

  return slug || "claim";
}

export function generateClaimShareUrl(claimId: string): string {
  return `${SHARE_BASE_URL}/claim/${claimId}`;
}

export function isYouTubeUrl(url: string): boolean {
  try {
    const hostname = new URL(url.trim()).hostname.replace(/^www\./, "").toLowerCase();
    return hostname === "youtube.com" || hostname.endsWith(".youtube.com") || hostname === "youtu.be";
  } catch {
    return false;
  }
}
