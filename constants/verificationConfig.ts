// PHASE 3 STEP 17
// PHASE 3 STEP 24
// PHASE 3 STEP 28
// PHASE 3 STEP 29
// PHASE 4 STEP 26
import { APP_CONFIG } from "./appConfig";
import type { VerificationMode } from "../types/verification";

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;

export const VERIFICATION_MODE: VerificationMode = APP_CONFIG.CLAIM_VOTING_MODE;
export const DEFAULT_VERIFICATION_MODE: VerificationMode = VERIFICATION_MODE;

export const TEST_VERIFICATION_CONFIG = {
  mode: "test",
  voteWindowMinutes: APP_CONFIG.TEST_VOTE_CLOSE_MINUTES,
  scoreLockMinutes: APP_CONFIG.TEST_SCORE_LOCK_MINUTES,
  expiresMinutes: APP_CONFIG.TEST_EXPIRES_MINUTES,
  minVotesRequired: APP_CONFIG.TEST_MIN_VOTES_REQUIRED,
  expectedParticipation: APP_CONFIG.TEST_EXPECTED_PARTICIPATION,
} as const;

export const PRODUCTION_VERIFICATION_CONFIG = {
  mode: "production",
  // 24H MODEL: voting stays open the full 24 hours and the claim finalizes at
  // that same mark (server-side sweep). The old 20h-vote/24h-publish split
  // left a 4-hour "Locked" dead zone with no result showing.
  voteWindowMinutes: 24 * 60,
  scoreLockMinutes: 24 * 60,
  expiresMinutes: 24 * 60,
  minVotesRequired: 15,
  expectedParticipation: 30,
} as const;

export const VERIFICATION_AI_WEIGHT = 0.4;
export const VERIFICATION_COMMUNITY_WEIGHT = 0.6;

export const VERIFICATION_THRESHOLDS = {
  true: 0.65,
  fake: 0.34,
  earlyTrue: 0.85,
  earlyFake: 0.15,
};

export interface VerificationModeConfig {
  mode: VerificationMode;
  aiScanMs: number;
  phase1EndMs: number;
  phase2EndMs: number;
  phase3EndMs: number;
  phase4StartMs: number;
  publishMs: number;
  minVotes: number;
  expectedParticipation: number;
  suspiciousWindowMs: number;
}

export const VERIFICATION_MODE_CONFIG: Record<VerificationMode, VerificationModeConfig> = {
  production: {
    mode: "production",
    aiScanMs: 15 * MINUTE_MS,
    phase1EndMs: 6 * HOUR_MS,
    phase2EndMs: 12 * HOUR_MS,
    phase3EndMs: 20 * HOUR_MS,
    phase4StartMs: PRODUCTION_VERIFICATION_CONFIG.voteWindowMinutes * MINUTE_MS,
    publishMs: PRODUCTION_VERIFICATION_CONFIG.scoreLockMinutes * MINUTE_MS,
    minVotes: PRODUCTION_VERIFICATION_CONFIG.minVotesRequired,
    expectedParticipation: PRODUCTION_VERIFICATION_CONFIG.expectedParticipation,
    suspiciousWindowMs: 30 * MINUTE_MS,
  },
  test: {
    mode: "test",
    aiScanMs: MINUTE_MS,
    phase1EndMs: 3 * MINUTE_MS,
    phase2EndMs: 7 * MINUTE_MS,
    phase3EndMs: 10 * MINUTE_MS,
    phase4StartMs: TEST_VERIFICATION_CONFIG.voteWindowMinutes * MINUTE_MS,
    publishMs: TEST_VERIFICATION_CONFIG.scoreLockMinutes * MINUTE_MS,
    minVotes: TEST_VERIFICATION_CONFIG.minVotesRequired,
    expectedParticipation: TEST_VERIFICATION_CONFIG.expectedParticipation,
    suspiciousWindowMs: 2 * MINUTE_MS,
  },
};

export function getVerificationModeConfig(mode: VerificationMode = DEFAULT_VERIFICATION_MODE) {
  return VERIFICATION_MODE_CONFIG[mode];
}
