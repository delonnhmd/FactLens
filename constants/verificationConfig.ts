// PHASE 3 STEP 17
import type { VerificationMode } from "../types/verification";

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;

export const DEFAULT_VERIFICATION_MODE: VerificationMode = "test";

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
    phase4StartMs: 20 * HOUR_MS,
    publishMs: 24 * HOUR_MS,
    minVotes: 15,
    expectedParticipation: 30,
    suspiciousWindowMs: 30 * MINUTE_MS,
  },
  test: {
    mode: "test",
    aiScanMs: MINUTE_MS,
    phase1EndMs: 3 * MINUTE_MS,
    phase2EndMs: 7 * MINUTE_MS,
    phase3EndMs: 10 * MINUTE_MS,
    phase4StartMs: 10 * MINUTE_MS,
    publishMs: 15 * MINUTE_MS,
    minVotes: 5,
    expectedParticipation: 10,
    suspiciousWindowMs: 2 * MINUTE_MS,
  },
};

export function getVerificationModeConfig(mode: VerificationMode = DEFAULT_VERIFICATION_MODE) {
  return VERIFICATION_MODE_CONFIG[mode];
}
