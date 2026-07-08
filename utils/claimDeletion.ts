// AUTHOR SELF-DELETE (NEW, additive) — the 3-hour / finalization rule, shared by
// the feed card and the claim detail screen so both show/hide the delete action
// with the SAME logic the backend enforces.
//
// Mirrors DELETE /api/claims/{claim_id} (backend/main.py): author-only, blocked
// once the claim is finalized (verdict_calculated_at → verdictCalculatedAt) OR
// more than 3 hours after created_at — whichever comes first. The backend is the
// authority; this only decides whether to render the button.
import type { Claim } from "../types/claim";

export const CLAIM_DELETE_WINDOW_MS = 3 * 60 * 60 * 1000;

// Milliseconds left in the delete window, or 0 if finalized / expired / unknown.
export function getClaimDeleteWindowMsRemaining(claim: Claim, nowMs: number = Date.now()): number {
  // Finalized === verdict calculated (same field the backend checks).
  if (claim.verdictCalculatedAt) {
    return 0;
  }

  const createdMs = new Date(claim.createdAt).getTime();

  // Unreadable created_at → treat as closed (fail closed, like the backend).
  if (!Number.isFinite(createdMs)) {
    return 0;
  }

  return Math.max(0, createdMs + CLAIM_DELETE_WINDOW_MS - nowMs);
}

// True only when the current user is the author AND the window is still open.
export function canAuthorDeleteClaim(
  claim: Claim,
  currentUserId: string | null | undefined,
  nowMs: number = Date.now(),
): boolean {
  if (!currentUserId || claim.authorId !== currentUserId) {
    return false;
  }

  return getClaimDeleteWindowMsRemaining(claim, nowMs) > 0;
}

// "2h 5m" / "12m" — for the optional "Deletable for …" hint on the menu label.
export function formatDeleteWindowRemaining(msRemaining: number): string {
  const totalMinutes = Math.floor(msRemaining / (60 * 1000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  return `${Math.max(1, minutes)}m`;
}
