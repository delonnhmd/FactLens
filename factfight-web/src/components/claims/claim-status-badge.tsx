import type { ClaimStatus } from "@/lib/types/claim";
import { getClaimStatusLabel } from "@/lib/utils/claim-display";

interface ClaimStatusBadgeProps {
  readonly status: ClaimStatus | null;
}

export function ClaimStatusBadge({ status }: ClaimStatusBadgeProps) {
  const isTrue = status === "FINALIZED_TRUE" || status === "COMMUNITY_TRUE";
  const isFake = status === "FINALIZED_FAKE" || status === "COMMUNITY_FAKE";
  const isUncertain =
    status === "EARLY_VERDICT" || status === "INSUFFICIENT_DATA" || status === "NEEDS_MORE_EVIDENCE";
  const colors = isTrue
    ? "border-[color-mix(in_srgb,var(--ff-true)_35%,var(--ff-border))] bg-[color-mix(in_srgb,var(--ff-true)_9%,white)] text-[var(--ff-true)]"
    : isFake
      ? "border-[color-mix(in_srgb,var(--ff-fake)_35%,var(--ff-border))] bg-[color-mix(in_srgb,var(--ff-fake)_8%,white)] text-[var(--ff-fake)]"
      : isUncertain
        ? "border-[color-mix(in_srgb,var(--ff-unsure)_40%,var(--ff-border))] bg-[color-mix(in_srgb,var(--ff-unsure)_10%,white)] text-[#8A5700]"
        : "border-[var(--ff-border)] bg-[var(--ff-surface)] text-[var(--ff-text-secondary)]";

  return (
    <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${colors}`}>
      {getClaimStatusLabel(status)}
    </span>
  );
}
