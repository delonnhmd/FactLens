export const ONBOARDING_PENDING_PREFIX = "factfight:onboarding:pending:";
export const ONBOARDING_SEEN_PREFIX = "factfight:onboarding:seen:";
export const FIRST_CLAIM_SEEN_PREFIX = "factfight:first-claim:seen:";

export function getOnboardingPendingKey(userId: string): string {
  return `${ONBOARDING_PENDING_PREFIX}${userId}`;
}
export function getOnboardingSeenKey(userId: string): string {
  return `${ONBOARDING_SEEN_PREFIX}${userId}`;
}

export function getFirstClaimSeenKey(userId: string, claimId: string): string {
  return `${FIRST_CLAIM_SEEN_PREFIX}${userId}:${claimId}`;
}
